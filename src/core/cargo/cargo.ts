import type { ItemIndex } from '../models/itemIndex';

/** Carga do navio: quantidade por item. */
export type Cargo = ReadonlyMap<string, number>;

export interface CargoLimits {
  maxWeightLt: number;
  slots: number;
}

export interface ItemQty {
  itemId: string;
  qty: number;
}

export function pesoDaCarga(cargo: Cargo, items: ItemIndex): number {
  let total = 0;
  for (const [itemId, qtd] of cargo) total += qtd * items.weightOf(itemId);
  return total;
}

/**
 * Slots ocupados: item que empilha (T0–T4) ocupa um slot por tipo;
 * T5+ e Oceano ocupam um slot por unidade.
 */
export function slotsDaCarga(cargo: Cargo, items: ItemIndex): number {
  let total = 0;
  for (const [itemId, qtd] of cargo) {
    if (qtd <= 0) continue;
    total += items.stacksOf(itemId) ? 1 : qtd;
  }
  return total;
}

export function cabeNoNavio(cargo: Cargo, limits: CargoLimits, items: ItemIndex): boolean {
  return (
    pesoDaCarga(cargo, items) <= limits.maxWeightLt && slotsDaCarga(cargo, items) <= limits.slots
  );
}

export function adicionar(cargo: Cargo, itemId: string, qty: number): Map<string, number> {
  const novo = new Map(cargo);
  novo.set(itemId, (novo.get(itemId) ?? 0) + qty);
  return novo;
}

/** Remove do porão; devolve `null` se não houver quantidade suficiente. */
export function remover(cargo: Cargo, itemId: string, qty: number): Map<string, number> | null {
  const atual = cargo.get(itemId) ?? 0;
  if (atual < qty) return null;
  const novo = new Map(cargo);
  if (atual === qty) novo.delete(itemId);
  else novo.set(itemId, atual - qty);
  return novo;
}

export function itensDaCarga(cargo: Cargo): ItemQty[] {
  return [...cargo]
    .filter(([, qty]) => qty > 0)
    .map(([itemId, qty]) => ({ itemId, qty }))
    .sort((a, b) => a.itemId.localeCompare(b.itemId));
}
