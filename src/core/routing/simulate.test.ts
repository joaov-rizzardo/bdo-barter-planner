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

describe('sobrepeso e transferência para o inventário', () => {
  const sobrepeso = (limitLt: number, mode: 'qualquer' | 'transferencia') =>
    ({ limitLt, mode }) as const;

  it('sem sobrepeso ligado, a troca que estoura o peso falha', () => {
    const r = simularViagem(cadeiaEmCadeia, contexto({ maxWeightLt: 900 }), 0);
    expect(r.ok).toBe(false);
    expect(r.falha).toMatchObject({ tradeId: 'tC', motivo: 'peso' });
  });

  it('modo "qualquer" aceita a última troca em sobrepeso', () => {
    const ctx = contexto({ maxWeightLt: 900, overweight: sobrepeso(2000, 'qualquer') });
    const r = simularViagem(cadeiaEmCadeia, ctx, 0);

    expect(r.ok).toBe(true);
    expect(r.trip.peakWeightLt).toBe(1800);
    expect(r.trip.inventory).toEqual([]);
  });

  it('não passa do teto de sobrepeso', () => {
    const ctx = contexto({ maxWeightLt: 900, overweight: sobrepeso(1500, 'qualquer') });
    const r = simularViagem(cadeiaEmCadeia, ctx, 0);

    expect(r.ok).toBe(false);
    expect(r.falha).toMatchObject({ tradeId: 'tC', motivo: 'peso', pesoLt: 1800 });
  });

  it('em sobrepeso, a troca seguinte só acontece depois de aliviar', () => {
    const ctx = contexto({ maxWeightLt: 700, overweight: sobrepeso(2000, 'qualquer') });
    const r = simularViagem(cadeiaEmCadeia, ctx, 0);

    // tB deixa o navio com 800 LT; sem gerente de cais, tC fica para outra viagem.
    expect(r.ok).toBe(false);
    expect(r.falha).toMatchObject({ tradeId: 'tC', motivo: 'peso' });
  });

  it('modo "transferência" tira 1 slot no gerente de cais mais próximo', () => {
    const trades = [
      troca({
        id: 't1',
        islandId: 'A',
        inputItemId: 'i1',
        inputQtyPerTrade: 1,
        outputItemId: 'i3',
        outputQtyPerTrade: 2,
        hasStock: true,
      }),
      troca({
        id: 't2',
        islandId: 'B',
        inputItemId: 'i1',
        inputQtyPerTrade: 1,
        outputItemId: 'i2',
        outputQtyPerTrade: 1,
        hasStock: true,
      }),
    ];
    const ctx = contexto({ maxWeightLt: 1000, overweight: sobrepeso(2000, 'transferencia') }, [
      'base',
    ]);
    const r = simularViagem(trades, ctx, 0);

    expect(r.ok).toBe(true);
    // 2 x i3 (1800 LT) empilham: um pack só, um slot só.
    expect(r.trip.inventory).toEqual([{ itemId: 'i3', qty: 2 }]);
    const transfer = r.trip.steps.find((s) => s.kind === 'transfer');
    expect(transfer).toMatchObject({ islandId: 'base', item: { itemId: 'i3', qty: 2 } });
    // o pack volta com o personagem e entra na descarga da base
    expect(r.trip.unloadAtBase).toEqual([
      { itemId: 'i2', qty: 1 },
      { itemId: 'i3', qty: 2 },
    ]);
  });

  it('só há uma transferência por viagem', () => {
    const t = (id: string, islandId: string) =>
      troca({
        id,
        islandId,
        inputItemId: 'i1',
        inputQtyPerTrade: 1,
        outputItemId: 'i3',
        outputQtyPerTrade: 2,
        hasStock: true,
      });
    const ctx = contexto({ maxWeightLt: 1000, overweight: sobrepeso(4000, 'transferencia') }, [
      'base',
    ]);
    const r = simularViagem([t('t1', 'A'), t('t2', 'B')], ctx, 0);

    expect(r.ok).toBe(false);
    expect(r.falha).toMatchObject({ tradeId: 't2', motivo: 'peso' });
    expect(r.trip.inventory).toHaveLength(1);
  });

  it('modo "transferência" recusa o sobrepeso que a transferência não resolve', () => {
    const trades = [
      troca({
        id: 't1',
        islandId: 'A',
        inputItemId: 'i1',
        inputQtyPerTrade: 1,
        outputItemId: 'i3',
        outputQtyPerTrade: 2,
        hasStock: true,
      }),
      // t2 consome os dois i3: eles ficam reservados e não podem ir para o inventário.
      troca({
        id: 't2',
        islandId: 'B',
        inputItemId: 'i3',
        inputQtyPerTrade: 2,
        outputItemId: 'i5',
        outputQtyPerTrade: 1,
        hasStock: false,
      }),
    ];
    const ctx = contexto({ maxWeightLt: 900, overweight: sobrepeso(3000, 'transferencia') }, [
      'base',
    ]);
    const r = simularViagem(trades, ctx, 0);

    expect(r.ok).toBe(false);
    expect(r.falha).toMatchObject({ tradeId: 't1', motivo: 'peso' });
    // nada foi para o inventário antes da troca que falhou
    const antesDeT1 = r.trip.steps.slice(
      0,
      r.trip.steps.findIndex((x) => x.kind === 'trade' && x.tradeId === 't1'),
    );
    expect(antesDeT1.some((x) => x.kind === 'transfer')).toBe(false);
  });

  it('a transferência também resolve falta de slot, sem sobrepeso nenhum', () => {
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
    const r = simularViagem([t], contexto({ slots: 5 }, ['A']), 0);

    expect(r.ok).toBe(true);
    // i5 não empilha: vai 1 unidade só, e é o bastante para caber nos 5 slots.
    expect(r.trip.inventory).toEqual([{ itemId: 'i5', qty: 1 }]);
    expect(r.trip.steps.filter((s) => s.kind === 'sail')).toHaveLength(2);
  });
});
