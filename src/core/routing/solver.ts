import type { Trade } from '../models/types';
import { MAX_TROCAS_EXATO, ordenarTrocas } from './order';
import { ordemTopologica } from './precedence';
import { simularViagem } from './simulate';
import type { RouteContext, RouteSolver, RouteWarning, Trip } from './types';

export interface SolverOptions {
  /** Acima deste número de trocas por viagem, usa a heurística. */
  maxTrocasExato?: number;
}

/**
 * Estratégia padrão:
 * 1. ordena as trocas por precedência (produção antes do consumo);
 * 2. vai acumulando trocas na viagem atual enquanto a carga simulada couber;
 * 3. ordena as paradas de cada viagem (exata até ~10 trocas, senão heurística).
 */
export function createRouteSolver(options: SolverOptions = {}): RouteSolver {
  const maxExato = options.maxTrocasExato ?? MAX_TROCAS_EXATO;

  return {
    name: `padrao(exato<=${maxExato})`,
    solve(trades, ctx) {
      const warnings: RouteWarning[] = [];
      const trips: Trip[] = [];

      if (trades.length === 0) {
        return { solver: this.name, trips, totalDistance: 0, warnings };
      }

      const { ordem, ciclo } = ordemTopologica(trades);
      if (ciclo.length > 0) {
        warnings.push({
          code: 'precedencia_circular',
          message:
            `Há ${ciclo.length} troca(s) em dependência circular; ` +
            'elas foram colocadas no fim do roteiro.',
          ...(ciclo[0] ? { tradeId: ciclo[0].id } : {}),
        });
      }
      const sequencia = [...ordem, ...ciclo];

      for (const trade of sequencia) {
        if (!ctx.distances.temCoordenada(trade.islandId)) {
          warnings.push({
            code: 'porto_sem_coordenada',
            message:
              'Porto sem posição no mapa: a distância desse trecho conta como zero no roteiro.',
            islandId: trade.islandId,
            tradeId: trade.id,
          });
        }
      }

      let atual: Trade[] = [];
      let viagemAtual = montarViagem(atual, ctx, trips.length, maxExato);

      const fechar = () => {
        if (viagemAtual) trips.push(viagemAtual);
        atual = [];
        viagemAtual = null;
      };

      for (const trade of sequencia) {
        const tentativa = [...atual, trade];
        const simulada = montarViagem(tentativa, ctx, trips.length, maxExato);

        if (simulada) {
          atual = tentativa;
          viagemAtual = simulada;
          continue;
        }

        if (atual.length === 0) {
          // A troca não cabe nem sozinha: entra em viagem própria, com aviso.
          const forcada = simularViagem([trade], ctx, trips.length);
          warnings.push({
            code: 'troca_nao_cabe',
            message:
              `Uma troca sozinha já passa da capacidade do navio ` +
              `(${Math.round(forcada.trip.peakWeightLt)} LT / ${forcada.trip.peakSlots} slots): ` +
              'reduza as trocas ou aumente o navio.',
            tradeId: trade.id,
            islandId: trade.islandId,
          });
          trips.push(forcada.trip);
          continue;
        }

        fechar();
        const sozinha = montarViagem([trade], ctx, trips.length, maxExato);
        if (sozinha) {
          atual = [trade];
          viagemAtual = sozinha;
        } else {
          const forcada = simularViagem([trade], ctx, trips.length);
          warnings.push({
            code: 'troca_nao_cabe',
            message:
              `Uma troca sozinha já passa da capacidade do navio ` +
              `(${Math.round(forcada.trip.peakWeightLt)} LT / ${forcada.trip.peakSlots} slots): ` +
              'reduza as trocas ou aumente o navio.',
            tradeId: trade.id,
            islandId: trade.islandId,
          });
          trips.push(forcada.trip);
        }
      }
      fechar();

      const viagens = trips.map((t, i) => ({ ...t, index: i }));
      return {
        solver: this.name,
        trips: viagens,
        totalDistance: viagens.reduce((total, t) => total + t.distance, 0),
        warnings,
      };
    },
  };
}

/** Ordena e simula; devolve `null` quando a carga não cabe. */
function montarViagem(
  trades: readonly Trade[],
  ctx: RouteContext,
  index: number,
  maxExato: number,
): Trip | null {
  if (trades.length === 0) return null;
  const { ordem } = ordenarTrocas(trades, ctx.baseIslandId, ctx.distances, maxExato);
  const simulada = simularViagem(ordem, ctx, index);
  return simulada.ok ? simulada.trip : null;
}

export const routeSolver = createRouteSolver();
