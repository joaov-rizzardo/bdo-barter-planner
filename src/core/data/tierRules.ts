import type { Tier } from '../models/types';

export const MAX_BARTER = 1_000_000;
export const REFRESH_VOUCHER_VALUE = 250_000;

/** Regra padrão por degrau de permuta (sugestão e validação; editável na UI). */
export interface TierRule {
  from: Tier;
  to: Tier;
  /** Proporções permitidas como [qtdEntrada, qtdSaida]. `null` = vem do item (T0). */
  ratios: ReadonlyArray<readonly [number, number]> | null;
  maxTrades: number;
  baseBarterCost: number;
}

export const TIER_RULES: readonly TierRule[] = [
  { from: 'level_0', to: 'level_1', ratios: null, maxTrades: 10, baseBarterCost: 14286 },
  {
    from: 'level_1',
    to: 'level_2',
    ratios: [
      [1, 1],
      [1, 2],
      [1, 3],
    ],
    maxTrades: 10,
    baseBarterCost: 14286,
  },
  {
    from: 'level_2',
    to: 'level_3',
    ratios: [
      [1, 1],
      [1, 2],
      [1, 3],
    ],
    maxTrades: 10,
    baseBarterCost: 14286,
  },
  { from: 'level_3', to: 'level_4', ratios: [[1, 2]], maxTrades: 10, baseBarterCost: 14286 },
  { from: 'level_4', to: 'level_5', ratios: [[1, 1]], maxTrades: 6, baseBarterCost: 14286 },
  { from: 'level_5', to: 'level_6', ratios: [[1, 1]], maxTrades: 5, baseBarterCost: 14286 },
  { from: 'level_6', to: 'level_7', ratios: [[1, 1]], maxTrades: 5, baseBarterCost: 14286 },
  { from: 'level_4', to: 'great_ocean', ratios: null, maxTrades: 10, baseBarterCost: 14286 },
];

/** Custo base da troca de T4 por Moedas do Corvo. */
export const CROW_COIN_BASE_COST = 21650;

/** Id da Moeda Corvo nos dados do jogo (`receiveItemId` das rotas `crow_coin`). */
export const CROW_COIN_ID = '10';

/**
 * Teto de trocas das rotas de Moeda Corvo que vêm com `maxTrades: 0` (as de
 * sub-grupo): as rotas normais de moeda aceitam 1 troca.
 */
export const CROW_COIN_MAX_TRADES = 1;

/** Pesos padrão por tier, em LT. */
export const DEFAULT_TIER_WEIGHTS: Readonly<Record<Tier, number>> = {
  level_0: 0,
  level_1: 100,
  level_2: 400,
  level_3: 900,
  level_4: 1000,
  level_5: 1000,
  level_6: 2000,
  level_7: 2000,
  great_ocean: 1000,
};

/** T1–T4 empilham; T5+ e Oceano ocupam um slot por unidade. */
export const STACKABLE_TIERS: ReadonlySet<Tier> = new Set<Tier>([
  'level_0',
  'level_1',
  'level_2',
  'level_3',
  'level_4',
]);

export function tierRuleFor(from: Tier, to?: Tier): TierRule | undefined {
  return TIER_RULES.find((r) => r.from === from && (to === undefined || r.to === to));
}

/** Tier de saída padrão para um tier de entrada. */
export function nextTier(from: Tier): Tier | undefined {
  return TIER_RULES.find((r) => r.from === from)?.to;
}
