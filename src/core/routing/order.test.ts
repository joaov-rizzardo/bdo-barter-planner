import { describe, expect, it } from 'vitest';
import { createDistanceProvider } from './distance';
import { cadeiaEmCadeia, ilhasQuadrado, troca } from './fixtures';
import { ordenarTrocas } from './order';
import { dependencias, ordemValida } from './precedence';

const distances = createDistanceProvider(ilhasQuadrado);

describe('ordenação exata', () => {
  it('acha o menor circuito do quadrado quando não há precedência', () => {
    const independentes = [
      troca({ id: 'a', islandId: 'A', hasStock: true }),
      troca({ id: 'b', islandId: 'B', hasStock: true }),
      troca({ id: 'c', islandId: 'C', hasStock: true }),
    ];
    const r = ordenarTrocas([...independentes].reverse(), 'base', distances);

    expect(r.estrategia).toBe('exata');
    expect(r.distancia).toBe(400); // base -> A -> B -> C -> base
    expect(r.ordem.map((t) => t.islandId)).toEqual(['A', 'B', 'C']);
  });

  it('respeita a precedência mesmo custando mais distância', () => {
    // A cadeia obriga A -> B -> C; o circuito ótimo sem precedência seria o mesmo,
    // então inverte-se a geometria: a cadeia começa em C.
    const cadeiaInvertida = [
      troca({ id: 'tC', islandId: 'C', inputItemId: 'm', outputItemId: 'i1', plannedTrades: 1 }),
      troca({
        id: 'tB',
        islandId: 'B',
        inputItemId: 'i1',
        inputQtyPerTrade: 1,
        outputItemId: 'i2',
      }),
      troca({
        id: 'tA',
        islandId: 'A',
        inputItemId: 'i2',
        inputQtyPerTrade: 1,
        outputItemId: 'i3',
      }),
    ];
    const r = ordenarTrocas(cadeiaInvertida, 'base', distances);

    expect(r.ordem.map((t) => t.islandId)).toEqual(['C', 'B', 'A']);
    expect(ordemValida(r.ordem, dependencias(cadeiaInvertida))).toBe(true);
    expect(r.distancia).toBe(400);
  });

  it('mantém duas trocas na mesma ilha sem custo extra', () => {
    const r = ordenarTrocas(
      [
        troca({ id: 'a1', islandId: 'A', hasStock: true }),
        troca({ id: 'a2', islandId: 'A', hasStock: true }),
      ],
      'base',
      distances,
    );
    expect(r.distancia).toBe(200);
  });
});

describe('heurística', () => {
  it('respeita precedência e não fica pior que a solução exata', () => {
    const exata = ordenarTrocas(cadeiaEmCadeia, 'base', distances);
    const heuristica = ordenarTrocas(cadeiaEmCadeia, 'base', distances, 0);

    expect(heuristica.estrategia).toBe('heuristica');
    expect(ordemValida(heuristica.ordem, dependencias(cadeiaEmCadeia))).toBe(true);
    expect(heuristica.distancia).toBeGreaterThanOrEqual(exata.distancia);
    expect(heuristica.distancia).toBe(400);
  });

  it('funciona com mais trocas do que o limite exato', () => {
    const muitas = Array.from({ length: 12 }, (_, i) =>
      troca({ id: `t${i}`, islandId: ilhasQuadrado[(i % 3) + 1]!.id, hasStock: true }),
    );
    const r = ordenarTrocas(muitas, 'base', distances);
    expect(r.estrategia).toBe('heuristica');
    expect(r.ordem).toHaveLength(12);
    // agrupa as paradas por ilha: no máximo 4 trechos com custo
    expect(r.distancia).toBe(400);
  });
});
