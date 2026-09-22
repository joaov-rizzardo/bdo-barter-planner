import { describe, expect, it } from 'vitest';
import { cadeiaEmCadeia, contexto, troca } from './fixtures';
import { simularViagem } from './simulate';

describe('simulação da viagem', () => {
  it('carrega na base só o que não é produzido na própria viagem', () => {
    const r = simularViagem(cadeiaEmCadeia, contexto(), 0);

    expect(r.ok).toBe(true);
    // 2 trocas × 100 unidades do material T0; i1 e i2 saem das trocas anteriores
    expect(r.trip.loadAtBase).toEqual([{ itemId: 'm', qty: 200 }]);
    expect(r.trip.unloadAtBase).toEqual([{ itemId: 'i3', qty: 2 }]);
  });

  it('gera os passos na ordem carregar → navegar → trocar → voltar → descarregar', () => {
    const r = simularViagem(cadeiaEmCadeia, contexto(), 0);
    expect(r.trip.steps.map((s) => s.kind)).toEqual([
      'load',
      'sail',
      'trade',
      'sail',
      'trade',
      'sail',
      'trade',
      'sail',
      'unload',
    ]);
    expect(r.trip.distance).toBe(400);
    expect(r.trip.stops.map((s) => s.islandId)).toEqual(['A', 'B', 'C']);
  });

  it('recalcula peso e slots depois de cada troca', () => {
    const r = simularViagem(cadeiaEmCadeia, contexto(), 0);
    const pesos = r.trip.steps.filter((s) => s.kind !== 'sail').map((s) => s.weightLt);
    // 200 material (60 LT) → 2×i1 (200) → 2×i2 (800) → 2×i3 (1800) → descarrega (0)
    expect(pesos).toEqual([60, 200, 800, 1800, 0]);
    expect(r.trip.peakWeightLt).toBe(1800);
    expect(r.trip.peakSlots).toBe(1);
  });

  it('conta um slot por unidade em itens T5+', () => {
    const t = troca({
      id: 't5',
      islandId: 'A',
      inputItemId: 'i1',
      inputQtyPerTrade: 1,
      outputItemId: 'i5',
      outputQtyPerTrade: 1,
      plannedTrades: 4,
      hasStock: true,
    });
    const r = simularViagem([t], contexto(), 0);
    expect(r.trip.peakSlots).toBe(4);
  });

  it('falha no passo em que o peso estoura, dizendo o motivo', () => {
    const r = simularViagem(cadeiaEmCadeia, contexto({ maxWeightLt: 900 }), 0);

    expect(r.ok).toBe(false);
    expect(r.falha).toMatchObject({ tradeId: 'tC', motivo: 'peso' });
    expect(r.falha?.pesoLt).toBe(1800);
  });

  it('falha por slots quando o navio tem poucos espaços', () => {
    const t = troca({
      id: 't5',
      islandId: 'A',
      inputItemId: 'i1',
      inputQtyPerTrade: 1,
      outputItemId: 'i5',
      outputQtyPerTrade: 1,
      plannedTrades: 6,
      hasStock: true,
    });
    const r = simularViagem([t], contexto({ slots: 5 }), 0);
    expect(r.ok).toBe(false);
    expect(r.falha).toMatchObject({ motivo: 'slots', slots: 6 });
  });

  it('não navega quando a troca é na própria base', () => {
    const t = troca({ id: 'x', islandId: 'base', hasStock: true });
    const r = simularViagem([t], contexto(), 0);
    expect(r.trip.distance).toBe(0);
    expect(r.trip.steps.map((s) => s.kind)).toEqual(['load', 'trade', 'unload']);
  });
});
