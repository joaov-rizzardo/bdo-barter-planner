import { describe, expect, it } from 'vitest';
import { cadeiaEmCadeia, contexto, troca } from './fixtures';
import { createRouteSolver } from './solver';

const solver = createRouteSolver();

describe('solver de rota', () => {
  it('plano vazio não gera viagem', () => {
    const plano = solver.solve([], contexto());
    expect(plano.trips).toEqual([]);
    expect(plano.totalDistance).toBe(0);
  });

  it('resolve a cadeia em uma viagem, na ordem da precedência', () => {
    const plano = solver.solve([...cadeiaEmCadeia].reverse(), contexto());

    expect(plano.trips).toHaveLength(1);
    expect(plano.trips[0]?.stops.map((s) => s.islandId)).toEqual(['A', 'B', 'C']);
    expect(plano.totalDistance).toBe(400);
    expect(plano.warnings).toEqual([]);
  });

  it('divide em viagens quando a carga não cabe', () => {
    // Cada troca precisa de 1.000 materiais (300 LT); o navio só aguenta 400 LT.
    const a = troca({ id: 'a', islandId: 'A', inputQtyPerTrade: 1000, hasStock: false });
    const b = troca({ id: 'b', islandId: 'B', inputQtyPerTrade: 1000, hasStock: false });
    const plano = solver.solve([a, b], contexto({ maxWeightLt: 400 }));

    expect(plano.trips).toHaveLength(2);
    expect(plano.trips.map((t) => t.stops[0]?.islandId)).toEqual(['A', 'B']);
    expect(plano.trips.every((t) => t.peakWeightLt <= 400)).toBe(true);
    expect(plano.warnings).toEqual([]);
    expect(plano.trips.map((t) => t.index)).toEqual([0, 1]);
  });

  it('mantém a precedência entre viagens diferentes', () => {
    const plano = solver.solve(cadeiaEmCadeia, contexto({ maxWeightLt: 900 }));

    expect(plano.trips.length).toBeGreaterThan(1);
    const ordemDasTrocas = plano.trips.flatMap((t) => t.stops.flatMap((s) => s.tradeIds));
    expect(ordemDasTrocas).toEqual(['tA', 'tB', 'tC']);
  });

  it('avisa quando uma troca sozinha já não cabe', () => {
    const grande = troca({ id: 'g', islandId: 'A', inputQtyPerTrade: 1000 });
    const plano = solver.solve([grande], contexto({ maxWeightLt: 100 }));

    expect(plano.warnings[0]?.code).toBe('troca_nao_cabe');
    expect(plano.warnings[0]?.tradeId).toBe('g');
    // a viagem é emitida de qualquer forma, para o usuário ver o roteiro
    expect(plano.trips).toHaveLength(1);
  });

  it('avisa sobre porto sem posição no mapa', () => {
    const ctx = contexto();
    const semCoordenada = {
      ...ctx,
      distances: { ...ctx.distances, temCoordenada: (id: string) => id !== 'A' },
    };
    const plano = solver.solve([troca({ id: 'a', islandId: 'A', hasStock: true })], semCoordenada);
    expect(plano.warnings[0]?.code).toBe('porto_sem_coordenada');
    expect(plano.warnings[0]?.islandId).toBe('A');
  });

  it('coloca trocas em dependência circular no fim, com aviso', () => {
    const ciclico = [
      troca({ id: 'x', islandId: 'A', inputItemId: 'i1', inputQtyPerTrade: 1, outputItemId: 'i2' }),
      troca({ id: 'y', islandId: 'B', inputItemId: 'i2', inputQtyPerTrade: 1, outputItemId: 'i1' }),
    ];
    const plano = solver.solve(ciclico, contexto());
    expect(plano.warnings.some((w) => w.code === 'precedencia_circular')).toBe(true);
    expect(plano.trips.flatMap((t) => t.stops.flatMap((s) => s.tradeIds))).toHaveLength(2);
  });
});
