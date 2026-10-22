import { custoDaTroca } from '../barter/cost';
import { custoBaseEfetivo } from '../chain/routeIndex';
import { MAX_BARTER, REFRESH_VOUCHER_VALUE } from '../data/tierRules';
import type { BarterSettings, Trade } from '../models/types';
import type { ItemDeRevisao } from './revisao';

/**
 * Troca do plano a partir de um item da revisão. A barganha é sempre a do
 * cálculo do app (`custoBaseEfetivo` da rota, como no formulário): o valor
 * lido da print é ignorado.
 */
export function novaTrocaDaRevisao(item: ItemDeRevisao): Omit<Trade, 'id'> {
  const { rota } = item;
  return {
    islandId: rota.islandId,
    inputItemId: rota.giveItemId,
    inputQtyPerTrade: rota.giveQty,
    outputItemId: rota.receiveItemId,
    outputQtyPerTrade: item.recebePorTroca,
    remainingTrades: item.remainingTrades,
    plannedTrades: Math.min(item.plannedTrades, item.remainingTrades),
    baseBarterCost: custoBaseEfetivo(rota),
    hasStock: item.hasStock,
    routeKey: rota.key,
  };
}

/**
 * As trocas marcadas, prontas para `usePlanStore().adicionar`. O que já está no
 * plano nunca vai de novo, mesmo marcado.
 */
export function trocasSelecionadas(itens: readonly ItemDeRevisao[]): Omit<Trade, 'id'>[] {
  return itens.filter((i) => i.selecionada && !i.jaNoPlano).map(novaTrocaDaRevisao);
}

export interface BarganhaDaImportacao {
  /** Barganha que o plano atual já gasta. */
  doPlano: number;
  /** O que sobra para a importação: `MAX_BARTER` menos o plano (nunca negativo). */
  livre: number;
  /** Barganha das trocas marcadas, com as reduções das Configurações. */
  selecionadas: number;
  /** Livre menos as marcadas; negativo quando passa do limite. */
  sobra: number;
  /** Refreshes/vouchers de +250.000 para cobrir o que passou do livre. */
  vouchersNecessarios: number;
}

/** Barganha das trocas marcadas frente ao que o plano ainda deixa livre. */
export function barganhaDaImportacao(
  itens: readonly ItemDeRevisao[],
  plano: readonly Trade[],
  s: BarterSettings,
): BarganhaDaImportacao {
  const doPlano = plano.reduce((total, t) => total + custoDaTroca(t, s), 0);
  const selecionadas = trocasSelecionadas(itens).reduce(
    (total, t) => total + custoDaTroca({ ...t, id: '' }, s),
    0,
  );
  const livre = Math.max(MAX_BARTER - doPlano, 0);
  const sobra = livre - selecionadas;
  return {
    doPlano,
    livre,
    selecionadas,
    sobra,
    vouchersNecessarios: sobra < 0 ? Math.ceil(-sobra / REFRESH_VOUCHER_VALUE) : 0,
  };
}
