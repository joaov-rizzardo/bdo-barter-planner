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
  /** `true` quando o roteiro exibido já descontou o progresso marcado. */
  recalculado: boolean;
}

export interface OpcoesDoRoteiro {
  /**
   * Quando `true`, o solver recebe só o que falta (trocas feitas saem do
   * roteiro). O padrão é `false`: marcar uma troca **não** a remove da lista,
   * ela só aparece riscada — o roteiro fica estável durante a viagem.
   */
  usarProgresso?: boolean;
}

/**
 * Monta o roteiro: resolve a cadeia e roda o solver com o plano inteiro, de
 * modo que marcar uma troca só a risque na lista. Com `usarProgresso`, o
 * solver recebe apenas o restante e o roteiro é remontado do ponto atual.
 */
export function useRoteiro({ usarProgresso = false }: OpcoesDoRoteiro = {}): Roteiro {
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
        recalculado: usarProgresso,
      };
    }

    const trocasDoRoteiro = usarProgresso ? restantes : cadeia.trades;

    const plano = routeSolver.solve(trocasDoRoteiro, {
      baseIslandId: base,
      // O espaço livre informado nas Configurações é o limite da simulação.
      limits: { maxWeightLt: ship.freeWeightLt, slots: ship.freeSlots },
      items,
      distances: createDistanceProvider(ilhas, route.distanceOverrides),
    });

    const porId = new Map(trocasDoRoteiro.map((t) => [t.id, t]));
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
      recalculado: usarProgresso,
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
    usarProgresso,
  ]);
}
