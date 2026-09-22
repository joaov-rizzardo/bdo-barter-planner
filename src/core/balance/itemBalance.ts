import type { Trade } from '../models/types';

export interface Balanco {
  /** Quanto o plano consome de cada item (trocas com estoque não contam). */
  need: Map<string, number>;
  /** Quanto o plano produz de cada item. */
  supply: Map<string, number>;
}

function soma(mapa: Map<string, number>, chave: string, valor: number): void {
  mapa.set(chave, (mapa.get(chave) ?? 0) + valor);
}

/**
 * Balanço bruto do plano. Uma troca marcada com estoque não gera demanda:
 * o item de entrada já está a bordo.
 */
export function balanco(trades: readonly Trade[]): Balanco {
  const need = new Map<string, number>();
  const supply = new Map<string, number>();
  for (const t of trades) {
    if (!t.hasStock) soma(need, t.inputItemId, t.inputQtyPerTrade * t.plannedTrades);
    soma(supply, t.outputItemId, t.outputQtyPerTrade * t.plannedTrades);
  }
  return { need, supply };
}

/** Itens produzidos além do que o plano consome. */
export function sobras(b: Balanco): Map<string, number> {
  const resultado = new Map<string, number>();
  for (const [itemId, qtd] of b.supply) {
    const sobra = qtd - (b.need.get(itemId) ?? 0);
    if (sobra > 0) resultado.set(itemId, sobra);
  }
  return resultado;
}

export interface ItemBalanceRow {
  itemId: string;
  needed: number;
  produced: number;
  /** Quanto falta (precisa vir de troca precedente, estoque ou mercado). */
  deficit: number;
  /** Quanto sobra depois de atender o plano. */
  leftover: number;
  /** Quanto o plano espera encontrar no armazém (trocas marcadas com estoque). */
  fromStock: number;
}

/** Uma linha por item envolvido no plano, para a tabela de balanço. */
export function itemBalance(trades: readonly Trade[]): ItemBalanceRow[] {
  const { need, supply } = balanco(trades);
  const estoque = new Map<string, number>();
  for (const t of trades) {
    if (t.hasStock) soma(estoque, t.inputItemId, t.inputQtyPerTrade * t.plannedTrades);
  }

  const ids = new Set([...need.keys(), ...supply.keys(), ...estoque.keys()]);
  return [...ids].map((itemId) => {
    const needed = need.get(itemId) ?? 0;
    const produced = supply.get(itemId) ?? 0;
    return {
      itemId,
      needed,
      produced,
      deficit: Math.max(needed - produced, 0),
      leftover: Math.max(produced - needed, 0),
      fromStock: estoque.get(itemId) ?? 0,
    };
  });
}
