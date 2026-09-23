import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, appSettingsSchema, normalizeSettings } from './defaults';

describe('normalização das configurações', () => {
  it('completa campos ausentes com os padrões', () => {
    const s = normalizeSettings({ ship: { freeSlots: 40 } });
    expect(s.ship.freeSlots).toBe(40);
    expect(s.ship.freeWeightLt).toBe(DEFAULT_SETTINGS.ship.freeWeightLt);
    expect(s.barter).toEqual(DEFAULT_SETTINGS.barter);
    expect(s.route.portOverrides).toEqual({});
  });

  it('limita valores negativos, altos e não numéricos', () => {
    const s = normalizeSettings({
      barter: { levelReduction: 3, viceCaptainPercent: 250 },
      ship: { freeWeightLt: Number.NaN, freeSlots: 0 },
    });
    expect(s.barter.levelReduction).toBe(1);
    expect(s.barter.viceCaptainPercent).toBe(100);
    expect(s.ship.freeWeightLt).toBe(1);
    expect(s.ship.freeSlots).toBe(1);
  });

  it('aceita configurações salvas no formato antigo', () => {
    const s = normalizeSettings({
      barter: { levelReductionOverride: 0.125 },
      ship: { maxWeightLt: 9000, slots: 17 },
    });
    expect(s.barter.levelReduction).toBe(0.125);
    expect(s.ship.freeWeightLt).toBe(9000);
    expect(s.ship.freeSlots).toBe(17);
  });

  it('remove portos de descarga repetidos', () => {
    const s = normalizeSettings({ route: { unloadIslandIds: ['182', '182', '181'] } });
    expect(s.route.unloadIslandIds).toEqual(['182', '181']);
  });

  it('os padrões passam pelo schema de persistência', () => {
    expect(appSettingsSchema.safeParse(DEFAULT_SETTINGS).success).toBe(true);
    expect(appSettingsSchema.safeParse(normalizeSettings(null)).success).toBe(true);
  });
});

describe('sobrepeso nas configurações', () => {
  it('vem desligado, no modo de transferência', () => {
    const s = normalizeSettings(null);
    expect(s.ship.allowOverweight).toBe(false);
    expect(s.ship.overweightMode).toBe('transferencia');
  });

  it('configuração antiga ganha capacidade total igual ao espaço livre', () => {
    const s = normalizeSettings({ ship: { maxWeightLt: 9000, slots: 17 } });
    expect(s.ship.totalWeightLt).toBe(9000);
  });

  it('a capacidade total nunca fica abaixo do espaço livre', () => {
    const s = normalizeSettings({ ship: { freeWeightLt: 9000, totalWeightLt: 5000 } });
    expect(s.ship.totalWeightLt).toBe(9000);
  });

  it('modo desconhecido volta para transferência', () => {
    const s = normalizeSettings({ ship: { allowOverweight: true, overweightMode: 'xpto' } });
    expect(s.ship.allowOverweight).toBe(true);
    expect(s.ship.overweightMode).toBe('transferencia');
  });
});

describe('venda de T7 nas configurações', () => {
  it('vem ligada, inclusive em configurações salvas antes dela', () => {
    expect(normalizeSettings(null).ship.sellT7).toBe(true);
    expect(normalizeSettings({ ship: { freeWeightLt: 9000 } }).ship.sellT7).toBe(true);
  });

  it('respeita quando o usuário desliga', () => {
    expect(normalizeSettings({ ship: { sellT7: false } }).ship.sellT7).toBe(false);
  });
});
