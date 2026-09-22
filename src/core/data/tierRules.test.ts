import { describe, expect, it } from 'vitest';
import { DEFAULT_TIER_WEIGHTS, STACKABLE_TIERS, nextTier, tierRuleFor } from './tierRules';

describe('regras de tier', () => {
  it('encadeia os tiers de T0 até T7', () => {
    expect(nextTier('level_0')).toBe('level_1');
    expect(nextTier('level_4')).toBe('level_5');
    expect(nextTier('level_7')).toBeUndefined();
  });

  it('T4→T5 só aceita 1:1 e tem no máximo 6 trocas', () => {
    const regra = tierRuleFor('level_4', 'level_5');
    expect(regra?.ratios).toEqual([[1, 1]]);
    expect(regra?.maxTrades).toBe(6);
  });

  it('T5 em diante não empilha', () => {
    expect(STACKABLE_TIERS.has('level_4')).toBe(true);
    expect(STACKABLE_TIERS.has('level_5')).toBe(false);
    expect(DEFAULT_TIER_WEIGHTS.level_6).toBe(2000);
  });
});
