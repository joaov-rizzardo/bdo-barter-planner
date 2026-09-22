import type { ItemIndex } from '../core/models/itemIndex';
import type { Island, Trade } from '../core/models/types';
import { fmtInteiro } from './format';

export function nomeDaIlha(islandId: string, ilhas: readonly Island[]): string {
  return ilhas.find((i) => i.id === islandId)?.namePt ?? `Porto ${islandId}`;
}

/** "Ilha de Tashu: 100× Barra de Ferro → 1× [Nível 1] Rosa Azul Seca". */
export function descreverTroca(trade: Trade, items: ItemIndex, ilhas: readonly Island[]): string {
  return (
    `${nomeDaIlha(trade.islandId, ilhas)}: ` +
    `${fmtInteiro(trade.inputQtyPerTrade)}× ${items.nameOf(trade.inputItemId)} → ` +
    `${fmtInteiro(trade.outputQtyPerTrade)}× ${items.nameOf(trade.outputItemId)}`
  );
}
