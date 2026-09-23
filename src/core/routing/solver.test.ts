import { describe, expect, it } from 'vitest';
import { createDistanceProvider } from './distance';
import { cadeiaEmCadeia, contexto, ilhaEm, itemsDeTeste, troca } from './fixtures';
import { createRouteSolver } from './solver';
import type { Island } from '../models/types';
import type { RouteContext } from './types';

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

describe('solver com sobrepeso', () => {
  it('sem sobrepeso, a troca que não cabe vira aviso', () => {
    const plano = solver.solve([cadeiaEmCadeia[2]!], contexto({ maxWeightLt: 900 }));
    expect(plano.warnings.map((w) => w.code)).toEqual(['troca_nao_cabe']);
  });

  it('com sobrepeso liberado, a mesma troca cabe em uma viagem', () => {
    const plano = solver.solve(
      [cadeiaEmCadeia[2]!],
      contexto({ maxWeightLt: 900, overweight: { limitLt: 2000, mode: 'qualquer' } }),
    );
    expect(plano.warnings).toEqual([]);
    expect(plano.trips).toHaveLength(1);
  });

  it('em sobrepeso sem gerente de cais, o resto da cadeia vai para outra viagem', () => {
    const plano = solver.solve(
      cadeiaEmCadeia,
      contexto({ maxWeightLt: 700, overweight: { limitLt: 2000, mode: 'qualquer' } }),
    );
    expect(plano.trips.length).toBeGreaterThan(1);
    const trocas = plano.trips.flatMap((t) => t.stops.flatMap((s) => s.tradeIds));
    expect(trocas.sort()).toEqual(['tA', 'tB', 'tC']);
  });
});

/** Contexto com um mapa desenhado para o teste. */
function mapa(ilhas: Island[], limites?: Partial<RouteContext['limits']>): RouteContext {
  return {
    baseIslandId: 'base',
    limits: { maxWeightLt: 10_000, slots: 25, ...limites },
    items: itemsDeTeste,
    distances: createDistanceProvider([ilhaEm('base', 0, 0), ...ilhas]),
  };
}

describe('agrupamento por distância', () => {
  it('junta as trocas da mesma região em vez de cantos opostos do mapa', () => {
    const ctx = mapa(
      [ilhaEm('L1', -100, 0), ilhaEm('L2', -110, 10), ilhaEm('R1', 100, 0), ilhaEm('R2', 110, 10)],
      { maxWeightLt: 1900 },
    );
    // Trocas independentes e iguais: só a posição no mapa muda.
    const t = (id: string, islandId: string) =>
      troca({
        id,
        islandId,
        inputItemId: 'i1',
        inputQtyPerTrade: 1,
        outputItemId: 'i3',
        outputQtyPerTrade: 1,
        hasStock: true,
      });
    // Na ordem de entrada, os pares óbvios seriam L1+R1 e L2+R2.
    const plano = solver.solve([t('l1', 'L1'), t('r1', 'R1'), t('l2', 'L2'), t('r2', 'R2')], ctx);

    expect(plano.trips).toHaveLength(2);
    const grupos = plano.trips.map((v) =>
      v.stops
        .flatMap((s) => s.tradeIds)
        .sort()
        .join('+'),
    );
    expect(grupos.sort()).toEqual(['l1+l2', 'r1+r2']);
  });

  it('leva a troca seguinte na mesma viagem quando o item já está a bordo e o desvio é curto', () => {
    const ctx = mapa([ilhaEm('A', 100, 0), ilhaEm('A2', 110, 0), ilhaEm('B', 0, 900)], {
      maxWeightLt: 1000,
    });
    const tA = troca({ id: 'tA', islandId: 'A', outputItemId: 'i1' });
    const tA2 = troca({
      id: 'tA2',
      islandId: 'A2',
      inputItemId: 'i1',
      inputQtyPerTrade: 1,
      outputItemId: 'i2',
    });
    const tB = troca({ id: 'tB', islandId: 'B', outputItemId: 'i3' });

    // Cabem duas trocas por viagem; a ordem de entrada favorece o par tB+tA.
    const plano = solver.solve([tB, tA, tA2], ctx);

    const viagemDeTA = plano.trips.find((v) => v.stops.some((s) => s.tradeIds.includes('tA')));
    // tA produz o i1 que tA2 consome: as duas ficam juntas, e tB vai sozinha.
    expect(viagemDeTA?.stops.flatMap((s) => s.tradeIds)).toEqual(['tA', 'tA2']);
    expect(plano.totalDistance).toBeLessThan(2100);
  });

  it('o resultado é estável: o mesmo plano dá sempre o mesmo roteiro', () => {
    const ctx = mapa([ilhaEm('A', 100, 0), ilhaEm('B', 0, 200), ilhaEm('C', -150, 50)], {
      maxWeightLt: 1900,
    });
    const trades = ['A', 'B', 'C'].map((ilha, i) =>
      troca({
        id: `t${i}`,
        islandId: ilha,
        inputItemId: 'i1',
        inputQtyPerTrade: 1,
        outputItemId: 'i3',
        outputQtyPerTrade: 1,
        hasStock: true,
      }),
    );
    const a = solver.solve(trades, ctx);
    const b = solver.solve(trades, ctx);
    expect(b.totalDistance).toBe(a.totalDistance);
    expect(b.trips.map((t) => t.stops.flatMap((s) => s.tradeIds))).toEqual(
      a.trips.map((t) => t.stops.flatMap((s) => s.tradeIds)),
    );
  });
});

describe('solver com venda de T7', () => {
  const trades = [
    troca({
      id: 't7',
      islandId: 'A',
      inputItemId: 'i1',
      inputQtyPerTrade: 1,
      outputItemId: 'i7',
      plannedTrades: 2,
      hasStock: true,
    }),
    troca({
      id: 't6',
      islandId: 'C',
      inputItemId: 'i1',
      inputQtyPerTrade: 1,
      outputItemId: 'i6',
      plannedTrades: 2,
      hasStock: true,
    }),
  ];

  it('vendendo os T7 no caminho, as duas trocas cabem numa viagem só', () => {
    const semVenda = solver.solve(trades, contexto({ maxWeightLt: 5000 }, ['B']));
    const comVenda = solver.solve(trades, contexto({ maxWeightLt: 5000 }, ['B'], true));

    expect(semVenda.trips).toHaveLength(2);
    expect(comVenda.trips).toHaveLength(1);
    expect(comVenda.trips[0]?.sold).toEqual([{ itemId: 'i7', qty: 2 }]);
  });

  describe('marinheiros', () => {
    // Cada troca carrega 1.000 materiais (300 LT) na base.
    const a = troca({ id: 'a', islandId: 'A', inputQtyPerTrade: 1000 });
    const b = troca({ id: 'b', islandId: 'B', inputQtyPerTrade: 1000 });
    const comMarinheiros = (maxWeightLt: number, sailorsLt: number[]): RouteContext => ({
      ...contexto({ maxWeightLt }),
      sailorsLt,
    });

    it('desequipa só os marinheiros necessários para caber mais trocas', () => {
      // Livre: 400 LT. As duas juntas pedem 600: faltam 200, um marinheiro de 250 resolve.
      const plano = solver.solve([a, b], comMarinheiros(400, [200, 250, 200]));

      expect(plano.trips).toHaveLength(1);
      expect(plano.trips[0]?.sailorsUnequipped).toBe(1);
      expect(plano.trips[0]?.sailorsUnequippedLt).toBe(250);
    });

    it('viagem que cabe com todos a bordo não desequipa ninguém', () => {
      const plano = solver.solve([a, b], comMarinheiros(1000, [200, 200]));

      expect(plano.trips).toHaveLength(1);
      expect(plano.trips[0]?.sailorsUnequipped).toBe(0);
      expect(plano.trips[0]?.sailorsUnequippedLt).toBe(0);
    });

    it('não junta viagens quando nem todos os marinheiros liberam espaço suficiente', () => {
      const plano = solver.solve([a, b], comMarinheiros(400, [100]));

      expect(plano.trips).toHaveLength(2);
      expect(plano.trips.every((t) => t.sailorsUnequipped === 0)).toBe(true);
    });

    it('prefere desequipar a navegar em sobrepeso e transferir para o inventário', () => {
      // A primeira troca rende 9 T1 (900 LT) e a segunda gasta 1 deles: o sobrepeso
      // nasce no meio da viagem, onde só a transferência (ou menos marinheiros) resolve.
      const pesada = troca({ id: 'p', islandId: 'A', outputQtyPerTrade: 9 });
      const seguinte = troca({
        id: 's',
        islandId: 'B',
        inputItemId: 'i1',
        inputQtyPerTrade: 1,
        outputItemId: 'i2',
      });
      const ctx: RouteContext = {
        ...contexto({ maxWeightLt: 800, overweight: { limitLt: 2000, mode: 'transferencia' } }, [
          'base',
          'A',
        ]),
        sailorsLt: [200, 200],
      };
      const semMarinheiros = solver.solve([pesada, seguinte], { ...ctx, sailorsLt: [] });
      expect(semMarinheiros.trips[0]?.inventory).toHaveLength(1);

      const plano = solver.solve([pesada, seguinte], ctx);
      expect(plano.trips).toHaveLength(1);
      expect(plano.trips[0]?.sailorsUnequipped).toBe(2);
      expect(plano.trips[0]?.inventory).toEqual([]);
      expect(plano.trips[0]?.peakWeightLt).toBeLessThanOrEqual(1200);
    });

    it('a folga dos marinheiros também sobe o teto do sobrepeso', () => {
      const ctx: RouteContext = {
        ...contexto({ maxWeightLt: 100, overweight: { limitLt: 200, mode: 'qualquer' } }),
        sailorsLt: [200],
      };
      const plano = solver.solve([a], ctx);

      expect(plano.warnings).toEqual([]);
      expect(plano.trips[0]?.sailorsUnequipped).toBe(1);
    });
  });
});
