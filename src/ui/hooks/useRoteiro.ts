import { useMemo } from 'react';
import { custoPorTroca } from '../../core/barter/cost';
import { MAX_BARTER } from '../../core/data/tierRules';
import { replanejar } from '../../core/progress/replan';
import { createDistanceProvider } from '../../core/routing/distance';
import { routeSolver } from '../../core/routing/solver';
import type { RoutePlan, TripStep } from '../../core/routing/types';
import { validarConfiguracaoDeRota } from '../../core/settings/ports';
import type { ProblemaDeConfiguracao } from '../../core/settings/ports';
import type { Trade } from '../../core/models/types';
import { useDataStore } from '../../store/dataStore';
import { useProgressStore } from '../../store/progressStore';
import { useSettingsStore } from '../../store/settingsStore';
import { useCadeia } from './useCadeia';
import type { CadeiaDoPlano } from './useCadeia';
import { useIlhas } from './useIlhas';

export interface PassoDoRoteiro {
  key: string;
  step: TripStep;
  concluido: boolean;
  /** Barganha gasta neste passo (0 fora das trocas). */
  custoBarganha: number;
  /** Barganha disponível depois do passo. */
  barganhaRestante: number;
  trade: Trade | null;
}

export interface ViagemDoRoteiro {
  index: number;
  distancia: number;
  picoPesoLt: number;
  picoSlots: number;
  passos: PassoDoRoteiro[];
  barganhaDaViagem: number;
}

export interface Roteiro {
  plano: RoutePlan | null;
  /** Entradas sem origem no plano; o roteiro assume que estão no armazém. */
  faltas: CadeiaDoPlano['faltas'];
  viagens: ViagemDoRoteiro[];
  problemas: ProblemaDeConfiguracao[];
  /** Trocas que ainda faltam depois do progresso marcado. */
  restantes: Trade[];
  concluidas: string[];
  trocasPlanejadas: number;
  trocasFeitas: number;
}

/**
 * Monta o roteiro: resolve a cadeia, desconta o progresso já registrado
 * (recalculando o restante a partir do ponto atual) e roda o solver.
 */
export function useRoteiro(): Roteiro {
  const cadeia = useCadeia();
  const items = useDataStore((s) => s.items);
  const { barter, ship, route } = useSettingsStore((s) => s.settings);
  const trocasFeitas = useProgressStore((s) => s.trocasFeitas);
  const passosConcluidos = useProgressStore((s) => s.passosConcluidos);
  const ilhas = useIlhas();

  return useMemo(() => {
    const problemas = validarConfiguracaoDeRota(route, ilhas);
    const { trades: restantes, concluidas } = replanejar(cadeia.trades, trocasFeitas);

    const trocasPlanejadas = cadeia.trades.reduce((t, x) => t + x.plannedTrades, 0);
    const feitas = cadeia.trades.reduce(
      (t, x) => t + Math.min(Math.max(trocasFeitas[x.id] ?? 0, 0), x.plannedTrades),
      0,
    );

    const base = route.baseIslandId;
    if (!base || problemas.some((p) => p.code !== 'descarga_sem_armazem')) {
      return {
        plano: null,
        faltas: cadeia.faltas,
        viagens: [],
        problemas,
        restantes,
        concluidas,
        trocasPlanejadas,
        trocasFeitas: feitas,
      };
    }

    const plano = routeSolver.solve(restantes, {
      baseIslandId: base,
      // O espaço livre informado nas Configurações é o limite da simulação.
      limits: { maxWeightLt: ship.freeWeightLt, slots: ship.freeSlots },
      items,
      distances: createDistanceProvider(ilhas, route.distanceOverrides),
    });

    const porId = new Map(restantes.map((t) => [t.id, t]));
    let barganha = MAX_BARTER;

    const viagens: ViagemDoRoteiro[] = plano.trips.map((trip) => {
      let barganhaDaViagem = 0;
      const passos = trip.steps.map((step, indice): PassoDoRoteiro => {
        const trade = step.kind === 'trade' ? (porId.get(step.tradeId) ?? null) : null;
        const custoBarganha =
          step.kind === 'trade' && trade
            ? custoPorTroca(trade.baseBarterCost, barter) * step.times
            : 0;
        barganha -= custoBarganha;
        barganhaDaViagem += custoBarganha;
        const key =
          step.kind === 'trade' ? `t:${step.tradeId}` : `${step.kind}:${trip.index}:${indice}`;
        return {
          key,
          step,
          concluido: passosConcluidos[key] ?? false,
          custoBarganha,
          barganhaRestante: barganha,
          trade,
        };
      });
      return {
        index: trip.index,
        distancia: trip.distance,
        picoPesoLt: trip.peakWeightLt,
        picoSlots: trip.peakSlots,
        passos,
        barganhaDaViagem,
      };
    });

    return {
      plano,
      faltas: cadeia.faltas,
      viagens,
      problemas,
      restantes,
      concluidas,
      trocasPlanejadas,
      trocasFeitas: feitas,
    };
  }, [
    cadeia.trades,
    cadeia.faltas,
    items,
    barter,
    ship,
    route,
    trocasFeitas,
    passosConcluidos,
    ilhas,
  ]);
}
