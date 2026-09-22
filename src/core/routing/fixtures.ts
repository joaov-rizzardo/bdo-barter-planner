/** Cenário pequeno e previsível usado pelos testes de rota. */
import { ItemIndex } from '../models/itemIndex';
import type { BarterItem, Island, MarketMaterial, Trade } from '../models/types';
import { createDistanceProvider } from './distance';
import type { RouteContext } from './types';

const ilha = (id: string, x: number, y: number): Island => ({
  id,
  name: id,
  namePt: id,
  x,
  y,
  barterer: null,
  npcId: null,
  sourceTier: null,
  targetTier: null,
  hasWarehouse: id === 'base',
  hasWharfManager: id === 'base',
});

/** Base na origem e três ilhas formando um quadrado de lado 100. */
export const ilhasQuadrado: Island[] = [
  ilha('base', 0, 0),
  ilha('A', 100, 0),
  ilha('B', 100, 100),
  ilha('C', 0, 100),
];

const barterItem = (
  id: string,
  tier: BarterItem['tier'],
  weightLt: number,
  stacks: boolean,
): BarterItem => ({ id, name: id, namePt: id, tier, weightLt, stacks, icon: null });

const materiais: MarketMaterial[] = [
  { id: 'm', name: 'm', namePt: 'Material', weightLt: 0.3, icon: null },
];

export const itemsDeTeste = new ItemIndex(
  [
    barterItem('i1', 'level_1', 100, true),
    barterItem('i2', 'level_2', 400, true),
    barterItem('i3', 'level_3', 900, true),
    barterItem('i5', 'level_5', 1000, false),
  ],
  materiais,
);

export function troca(p: Partial<Trade> & { id: string; islandId: string }): Trade {
  return {
    inputItemId: 'm',
    inputQtyPerTrade: 100,
    outputItemId: 'i1',
    outputQtyPerTrade: 1,
    remainingTrades: 10,
    plannedTrades: 1,
    baseBarterCost: 14286,
    hasStock: false,
    ...p,
  };
}

export function contexto(limites?: Partial<RouteContext['limits']>): RouteContext {
  return {
    baseIslandId: 'base',
    limits: { maxWeightLt: 10_000, slots: 25, ...limites },
    items: itemsDeTeste,
    distances: createDistanceProvider(ilhasQuadrado),
  };
}

/** Cadeia m → i1 (A) → i2 (B) → i3 (C), duas trocas em cada parada. */
export const cadeiaEmCadeia: Trade[] = [
  troca({ id: 'tA', islandId: 'A', inputItemId: 'm', outputItemId: 'i1', plannedTrades: 2 }),
  troca({
    id: 'tB',
    islandId: 'B',
    inputItemId: 'i1',
    inputQtyPerTrade: 1,
    outputItemId: 'i2',
    plannedTrades: 2,
  }),
  troca({
    id: 'tC',
    islandId: 'C',
    inputItemId: 'i2',
    inputQtyPerTrade: 1,
    outputItemId: 'i3',
    plannedTrades: 2,
  }),
];
