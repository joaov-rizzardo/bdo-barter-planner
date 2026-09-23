import type { ItemIndex } from '../models/itemIndex';
import type { OverweightMode, ShipSettings } from '../models/types';

/** Carga do navio: quantidade por item. */
export type Cargo = ReadonlyMap<string, number>;

/** Sobrepeso permitido, no mesmo referencial de `maxWeightLt` (espaço livre). */
export interface OverweightRule {
  limitLt: number;
  mode: OverweightMode;
}

export interface CargoLimits {
  maxWeightLt: number;
  slots: number;
  /** Ausente quando navegar com sobrepeso está desligado. */
  overweight?: OverweightRule;
}

/**
 * Converte as configurações do navio nos limites da simulação. O peso da
 * simulação é sempre o **espaço livre**; o teto de 150% é medido sobre a
 * capacidade total, e o que já está a bordo é `total - livre`, logo sobra
 * `livre + 0,5 x total` de carga planejada antes de estourar os 150%.
 */
export function limitesDoNavio(ship: ShipSettings): CargoLimits {
  const base: CargoLimits = { maxWeightLt: ship.freeWeightLt, slots: ship.freeSlots };
  if (!ship.allowOverweight) return base;
  return {
    ...base,
    overweight: {
      limitLt: ship.freeWeightLt + 0.5 * ship.totalWeightLt,
      mode: ship.overweightMode,
    },
  };
}

/** Peso máximo aceito, já contando o sobrepeso quando ele está ligado. */
export function limiteDeSobrepeso(limits: CargoLimits): number {
  if (!limits.overweight) return limits.maxWeightLt;
  return Math.max(limits.overweight.limitLt, limits.maxWeightLt);
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

/**
 * Melhor pack de **1 slot** para mandar ao inventário do personagem: o que
 * empilha vai inteiro (12 T4 = 1 slot), o que não empilha vai 1 unidade.
 * Escolhe o que tira mais peso do navio. `reservado` protege o que ainda vai
 * ser gasto nas próximas trocas da viagem.
 */
export function melhorTransferencia(
  cargo: Cargo,
  items: ItemIndex,
  reservado: ReadonlyMap<string, number> = new Map(),
): ItemQty | null {
  let melhor: ItemQty | null = null;
  let melhorPeso = 0;
  for (const [itemId, qtd] of [...cargo].sort(([a], [b]) => a.localeCompare(b))) {
    const livre = qtd - (reservado.get(itemId) ?? 0);
    if (livre <= 0) continue;
    const qty = items.stacksOf(itemId) ? livre : 1;
    const peso = qty * items.weightOf(itemId);
    if (peso > melhorPeso) {
      melhorPeso = peso;
      melhor = { itemId, qty };
    }
  }
  return melhor;
}

/**
 * T7 que podem ser vendidos no gerente de cais: tudo o que está a bordo menos
 * o que ainda vai ser gasto nas próximas trocas da viagem (`reservado`).
 */
export function t7Vendaveis(
  cargo: Cargo,
  items: ItemIndex,
  reservado: ReadonlyMap<string, number> = new Map(),
): ItemQty[] {
  const vendaveis: ItemQty[] = [];
  for (const [itemId, qtd] of cargo) {
    if (items.tierOf(itemId) !== 'level_7') continue;
    const livre = qtd - (reservado.get(itemId) ?? 0);
    if (livre > 0) vendaveis.push({ itemId, qty: livre });
  }
  return vendaveis.sort((a, b) => a.itemId.localeCompare(b.itemId));
}

export function itensDaCarga(cargo: Cargo): ItemQty[] {
  return [...cargo]
    .filter(([, qty]) => qty > 0)
    .map(([itemId, qty]) => ({ itemId, qty }))
    .sort((a, b) => a.itemId.localeCompare(b.itemId));
}
