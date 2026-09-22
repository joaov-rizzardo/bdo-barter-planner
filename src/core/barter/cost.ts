import { MAX_BARTER, REFRESH_VOUCHER_VALUE } from '../data/tierRules';
import type { BarterSettings, Trade } from '../models/types';

const PACOTE_ECONOMICO_PADRAO = 0.1;

/** As três reduções aplicáveis, em fração (0–1). */
export function reducoes(s: BarterSettings): {
  nivel: number;
  pacote: number;
  viceCapitao: number;
} {
  return {
    nivel: s.levelReduction,
    pacote: s.economyPackage ? PACOTE_ECONOMICO_PADRAO : 0,
    viceCapitao: s.viceCaptain ? s.viceCaptainPercent / 100 : 0,
  };
}

/**
 * Fator multiplicador aplicado ao custo base. As três reduções são somadas e o
 * resultado é limitado a [0, 1].
 */
export function fatorDeCusto(s: BarterSettings): number {
  const { nivel, pacote, viceCapitao } = reducoes(s);
  return Math.min(Math.max(1 - (nivel + pacote + viceCapitao), 0), 1);
}

/** Redução efetiva total, em fração (0–1). Útil para exibir na UI. */
export function reducaoTotal(s: BarterSettings): number {
  return 1 - fatorDeCusto(s);
}

/** Custo de barganha de uma única troca (sempre arredondado para baixo). */
export function custoPorTroca(baseBarterCost: number, s: BarterSettings): number {
  return Math.floor(baseBarterCost * fatorDeCusto(s));
}

/** Custo total de uma troca planejada (custo por troca × trocas planejadas). */
export function custoDaTroca(trade: Trade, s: BarterSettings): number {
  return custoPorTroca(trade.baseBarterCost, s) * trade.plannedTrades;
}

export interface PassoDeBarganha {
  tradeId: string;
  custoPorTroca: number;
  custoTotal: number;
  /** Barganha acumulada depois deste passo. */
  acumulado: number;
  /** Quantas trocas deste passo ainda cabem na barganha disponível. */
  trocasCobertas: number;
}

export interface ResumoBarganha {
  total: number;
  disponivel: number;
  restante: number;
  excedente: number;
  /** Refreshes/vouchers de +250.000 necessários para cobrir o excedente. */
  vouchersNecessarios: number;
  passos: PassoDeBarganha[];
  /** Índice do passo em que a barganha acaba, ou `null` se couber tudo. */
  indicePassoQueEstoura: number | null;
}

/**
 * Resumo da barganha do plano, na ordem em que as trocas serão executadas.
 * A barganha disponível é sempre o máximo do jogo (`MAX_BARTER`); o resumo diz
 * em qual passo ela acaba.
 */
export function resumoBarganha(trades: readonly Trade[], s: BarterSettings): ResumoBarganha {
  const disponivel = MAX_BARTER;
  let acumulado = 0;
  let indicePassoQueEstoura: number | null = null;

  const passos = trades.map((trade, indice) => {
    const porTroca = custoPorTroca(trade.baseBarterCost, s);
    const custoTotal = porTroca * trade.plannedTrades;
    const sobrandoAntes = Math.max(disponivel - acumulado, 0);
    const trocasCobertas =
      porTroca === 0
        ? trade.plannedTrades
        : Math.min(trade.plannedTrades, Math.floor(sobrandoAntes / porTroca));
    acumulado += custoTotal;
    if (indicePassoQueEstoura === null && acumulado > disponivel) {
      indicePassoQueEstoura = indice;
    }
    return { tradeId: trade.id, custoPorTroca: porTroca, custoTotal, acumulado, trocasCobertas };
  });

  const excedente = Math.max(acumulado - disponivel, 0);
  return {
    total: acumulado,
    disponivel,
    restante: Math.max(disponivel - acumulado, 0),
    excedente,
    vouchersNecessarios: Math.ceil(excedente / REFRESH_VOUCHER_VALUE),
    passos,
    indicePassoQueEstoura,
  };
}
