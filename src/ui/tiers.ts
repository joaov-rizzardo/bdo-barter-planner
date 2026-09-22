import type { Tier } from '../core/models/types';

const ROTULOS: Record<Tier, string> = {
  level_0: 'T0 (mercado)',
  level_1: 'T1',
  level_2: 'T2',
  level_3: 'T3',
  level_4: 'T4',
  level_5: 'T5',
  level_6: 'T6',
  level_7: 'T7',
  great_ocean: 'Oceano',
};

export const rotuloTier = (tier: Tier | undefined) => (tier ? ROTULOS[tier] : '—');

/** Ordem de exibição dos grupos de tier nos seletores. */
export const TIERS_EM_ORDEM: Tier[] = [
  'level_0',
  'level_1',
  'level_2',
  'level_3',
  'level_4',
  'level_5',
  'level_6',
  'level_7',
  'great_ocean',
];
