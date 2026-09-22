/**
 * Helper de teste: monta à mão a cadeia de trocas que leva do mercado até o
 * item pedido, escolhendo a primeira rota disponível de cada degrau. Serve para
 * exercitar o app como o usuário faria, informando cada troca.
 */
import { custoBaseEfetivo, maxTrocasEfetivo } from '../core/chain/routeIndex';
import type { ItemIndex } from '../core/models/itemIndex';
import type { RouteIndex } from '../core/chain/routeIndex';
import type { Trade } from '../core/models/types';

export function montarCadeiaManual(
  itemAlvo: string,
  quantidade: number,
  items: ItemIndex,
  routes: RouteIndex,
  maxDegraus = 12,
): Trade[] {
  const trades: Trade[] = [];
  let alvo = itemAlvo;
  let qtd = quantidade;

  for (let degrau = 0; degrau < maxDegraus; degrau += 1) {
    const rota = routes.produzindoTier(alvo)[0];
    if (!rota) break;

    const trocas = Math.ceil(qtd / rota.receiveQtyMin);
    trades.unshift({
      id: `manual-${degrau}`,
      islandId: rota.islandId,
      inputItemId: rota.giveItemId,
      inputQtyPerTrade: rota.giveQty,
      outputItemId: rota.receiveItemId,
      outputQtyPerTrade: rota.receiveQtyMin,
      remainingTrades: maxTrocasEfetivo(rota),
      plannedTrades: trocas,
      baseBarterCost: custoBaseEfetivo(rota),
      hasStock: false,
    });

    if (items.isMarketMaterial(rota.giveItemId)) break;
    alvo = rota.giveItemId;
    qtd = rota.giveQty * trocas;
  }

  return trades;
}
