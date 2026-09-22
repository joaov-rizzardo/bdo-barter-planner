import type { Island } from '../models/types';

export interface DistanceProvider {
  /** Distância entre dois portos. 0 quando algum deles não tem posição no mapa. */
  between: (a: string, b: string) => number;
  temCoordenada: (islandId: string) => boolean;
}

/** Sobrescreve a distância de um par específico (continentes bloqueiam linha reta). */
export interface DistanceOverride {
  from: string;
  to: string;
  distance: number;
}

const chave = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);

/**
 * Distância euclidiana entre as coordenadas do jogo, com uma matriz opcional
 * de pares sobrescritos.
 */
export function createDistanceProvider(
  islands: readonly Island[],
  overrides: readonly DistanceOverride[] = [],
): DistanceProvider {
  const pontos = new Map(islands.map((i) => [i.id, i]));
  const mapaOverrides = new Map(overrides.map((o) => [chave(o.from, o.to), o.distance]));

  return {
    temCoordenada: (islandId) => {
      const ilha = pontos.get(islandId);
      return !!ilha && ilha.x !== null && ilha.y !== null;
    },
    between: (a, b) => {
      if (a === b) return 0;
      const sobrescrito = mapaOverrides.get(chave(a, b));
      if (sobrescrito !== undefined) return sobrescrito;
      const ia = pontos.get(a);
      const ib = pontos.get(b);
      if (!ia || !ib || ia.x === null || ia.y === null || ib.x === null || ib.y === null) return 0;
      return Math.hypot(ia.x - ib.x, ia.y - ib.y);
    },
  };
}
