import { custoBaseEfetivo } from '../chain/routeIndex';
import type { Trade } from '../models/types';
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

/** As trocas marcadas, prontas para `usePlanStore().adicionar`. */
export function trocasSelecionadas(itens: readonly ItemDeRevisao[]): Omit<Trade, 'id'>[] {
  return itens.filter((i) => i.selecionada).map(novaTrocaDaRevisao);
}
