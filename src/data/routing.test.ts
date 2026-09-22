import { describe, expect, it } from 'vitest';
import type { Trade } from '../core/models/types';
import { createDistanceProvider } from '../core/routing/distance';
import { createRouteSolver } from '../core/routing/solver';
import { montarCadeiaManual } from './cadeiaManual';
import { loadGameData } from './index';

const { data, items, routes } = loadGameData();
const solver = createRouteSolver();

/** Plano real: a cadeia até um T7, informada troca por troca. */
function planoT7(): Trade[] {
  const t7 = data.barterItems.find((i) => i.tier === 'level_7')!;
  return montarCadeiaManual(t7.id, 2, items, routes);
}

describe('rota com os dados reais', () => {
  const trades = planoT7();
  const ctx = {
    baseIslandId: '182', // Ilha de Iliya (tem armazém)
    limits: { maxWeightLt: 12_000, slots: 25 },
    items,
    distances: createDistanceProvider(data.islands),
  };

  it('roteiriza a cadeia respeitando peso e slots do navio', () => {
    const plano = solver.solve(trades, ctx);

    expect(plano.trips.length).toBeGreaterThan(0);
    for (const viagem of plano.trips) {
      expect(viagem.peakWeightLt).toBeLessThanOrEqual(ctx.limits.maxWeightLt);
      expect(viagem.peakSlots).toBeLessThanOrEqual(ctx.limits.slots);
      expect(viagem.steps[0]?.kind).toBe('load');
      expect(viagem.steps[viagem.steps.length - 1]?.kind).toBe('unload');
    }
    expect(plano.warnings.filter((w) => w.code === 'troca_nao_cabe')).toEqual([]);
  });

  it('cada troca aparece uma única vez e depois da que a alimenta', () => {
    const plano = solver.solve(trades, ctx);
    const sequencia = plano.trips.flatMap((t) => t.stops.flatMap((s) => s.tradeIds));

    expect(sequencia).toHaveLength(trades.length);
    expect(new Set(sequencia).size).toBe(trades.length);

    const posicao = new Map(sequencia.map((id, i) => [id, i]));
    for (const trade of trades) {
      if (trade.hasStock) continue;
      const produtores = trades.filter((t) => t.outputItemId === trade.inputItemId);
      for (const produtor of produtores) {
        expect(posicao.get(produtor.id)!).toBeLessThan(posicao.get(trade.id)!);
      }
    }
  });

  it('navio minúsculo força mais viagens do que um navio grande', () => {
    const grande = solver.solve(trades, ctx);
    const pequeno = solver.solve(trades, {
      ...ctx,
      limits: { maxWeightLt: 2_000, slots: 5 },
    });
    expect(pequeno.trips.length).toBeGreaterThan(grande.trips.length);
  });
});
