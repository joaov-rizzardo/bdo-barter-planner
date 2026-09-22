import { describe, expect, it } from 'vitest';
import type { Island } from '../models/types';
import { createDistanceProvider } from './distance';

const ilha = (id: string, x: number | null, y: number | null): Island => ({
  id,
  name: id,
  namePt: id,
  x,
  y,
  barterer: null,
  npcId: null,
  sourceTier: null,
  targetTier: null,
  hasWarehouse: false,
  hasWharfManager: false,
});

const ilhas = [ilha('a', 0, 0), ilha('b', 300, 400), ilha('c', 0, 100), ilha('sem', null, null)];

describe('distâncias', () => {
  it('usa a euclidiana entre as coordenadas', () => {
    const d = createDistanceProvider(ilhas);
    expect(d.between('a', 'b')).toBe(500);
    expect(d.between('a', 'a')).toBe(0);
  });

  it('a matriz de overrides sobrescreve pares específicos, nos dois sentidos', () => {
    const d = createDistanceProvider(ilhas, [{ from: 'a', to: 'b', distance: 1200 }]);
    expect(d.between('a', 'b')).toBe(1200);
    expect(d.between('b', 'a')).toBe(1200);
    expect(d.between('a', 'c')).toBe(100);
  });

  it('porto sem coordenada tem distância zero e é sinalizado', () => {
    const d = createDistanceProvider(ilhas);
    expect(d.temCoordenada('a')).toBe(true);
    expect(d.temCoordenada('sem')).toBe(false);
    expect(d.temCoordenada('inexistente')).toBe(false);
    expect(d.between('a', 'sem')).toBe(0);
  });
});
