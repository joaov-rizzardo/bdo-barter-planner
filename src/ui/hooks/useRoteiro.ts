import { useMemo } from 'react';
import { custoPorTroca } from '../../core/barter/cost';
import { limitesDoNavio, type ItemQty } from '../../core/cargo/cargo';
import { MAX_BARTER } from '../../core/data/tierRules';
import { chaveDoPasso, replanejar } from '../../core/progress/replan';
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
  /** Pack de 1 slot levado no inventário do personagem. */
  inventario: ItemQty[];
  /** A viagem passa do peso livre em algum passo (sobrepeso liberado). */
  emSobrepeso: boolean;
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

  const problemas = useMemo(() => validarConfiguracaoDeRota(route, ilhas), [route, ilhas]);

  const { restantes, concluidas, trocasPlanejadas, feitas } = useMemo(() => {
    const { trades, concluidas: feitasIds } = replanejar(cadeia.trades, trocasFeitas);
    return {
      restantes: trades,
      concluidas: feitasIds,
      trocasPlanejadas: cadeia.trades.reduce((t, x) => t + x.plannedTrades, 0),
      feitas: cadeia.trades.reduce(
        (t, x) => t + Math.min(Math.max(trocasFeitas[x.id] ?? 0, 0), x.plannedTrades),
        0,
      ),
    };
  }, [cadeia.trades, trocasFeitas]);

  const trocasDoRoteiro = usarProgresso ? restantes : cadeia.trades;

  /**
   * O solver é a parte cara do roteiro (pode levar segundos em planos
   * grandes), por isso ele fica num memo só dele: marcar um passo no
   * checklist não recalcula a rota.
   */
  const plano = useMemo(() => {
    const base = route.baseIslandId;
    if (!base || problemas.some((p) => p.code !== 'descarga_sem_armazem')) return null;

    return routeSolver.solve(trocasDoRoteiro, {
      baseIslandId: base,
      // O espaço livre informado nas Configurações é o limite da simulação.
      limits: limitesDoNavio(ship),
      items,
      distances: createDistanceProvider(ilhas, route.distanceOverrides),
      // Onde dá para passar 1 slot para o inventário do personagem.
      wharfIslandIds: ilhas
        .filter((i) => i.hasWharfManager && i.x !== null && i.y !== null)
        .map((i) => i.id),
    });
  }, [trocasDoRoteiro, problemas, route, ship, items, ilhas]);

  const viagens = useMemo((): ViagemDoRoteiro[] => {
    if (!plano) return [];
    const porId = new Map(trocasDoRoteiro.map((t) => [t.id, t]));
    let barganha = MAX_BARTER;

    return plano.trips.map((trip) => {
      let barganhaDaViagem = 0;
      const tradeIdsDaViagem = trip.stops.flatMap((s) => s.tradeIds);
      const passos = trip.steps.map((step, indice): PassoDoRoteiro => {
        const trade = step.kind === 'trade' ? (porId.get(step.tradeId) ?? null) : null;
        const custoBarganha =
          step.kind === 'trade' && trade
            ? custoPorTroca(trade.baseBarterCost, barter) * step.times
            : 0;
        barganha -= custoBarganha;
        barganhaDaViagem += custoBarganha;
        const key = chaveDoPasso(step, tradeIdsDaViagem, indice);
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
        inventario: trip.inventory,
        emSobrepeso: trip.peakWeightLt > ship.freeWeightLt,
      };
    });
  }, [plano, trocasDoRoteiro, barter, passosConcluidos, ship.freeWeightLt]);

  return useMemo(
    () => ({
      plano,
      faltas: cadeia.faltas,
      viagens,
      problemas,
      restantes,
      concluidas,
      trocasPlanejadas,
      trocasFeitas: feitas,
      recalculado: usarProgresso,
    }),
    [
      plano,
      cadeia.faltas,
      viagens,
      problemas,
      restantes,
      concluidas,
      trocasPlanejadas,
      feitas,
      usarProgresso,
    ],
  );
}
