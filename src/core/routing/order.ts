import type { Trade } from '../models/types';
import type { DistanceProvider } from './distance';
import { dependencias, ordemTopologica, ordemValida } from './precedence';

/** Acima deste número de trocas por viagem usamos a heurística. */
export const MAX_TROCAS_EXATO = 10;

export interface OrdenacaoResultado {
  ordem: Trade[];
  distancia: number;
  estrategia: 'exata' | 'heuristica';
}

function distanciaTotal(
  sequencia: readonly Trade[],
  base: string,
  distances: DistanceProvider,
): number {
  let total = 0;
  let atual = base;
  for (const trade of sequencia) {
    total += distances.between(atual, trade.islandId);
    atual = trade.islandId;
  }
  return total + distances.between(atual, base);
}

/**
 * Ordena as trocas de uma viagem minimizando a distância e respeitando a
 * precedência. Até `MAX_TROCAS_EXATO` trocas resolve de forma exata
 * (programação dinâmica sobre subconjuntos); acima disso usa vizinho mais
 * próximo + 2-opt, rejeitando movimentos que violem a precedência.
 */
export function ordenarTrocas(
  trades: readonly Trade[],
  base: string,
  distances: DistanceProvider,
  maxExato: number = MAX_TROCAS_EXATO,
): OrdenacaoResultado {
  if (trades.length <= 1) {
    return {
      ordem: [...trades],
      distancia: distanciaTotal(trades, base, distances),
      estrategia: 'exata',
    };
  }

  const deps = dependencias(trades);
  const noPlano = new Set(trades.map((t) => t.id));
  /** Dependências relevantes: só as que estão nesta viagem. */
  const depsLocais = new Map(
    trades.map((t) => [t.id, new Set([...(deps.get(t.id) ?? [])].filter((d) => noPlano.has(d)))]),
  );

  if (trades.length <= maxExato) {
    const exata = ordenarExato(trades, base, distances, depsLocais);
    if (exata) return { ...exata, estrategia: 'exata' };
  }

  const heuristica = ordenarHeuristico(trades, base, distances, depsLocais);
  return { ...heuristica, estrategia: 'heuristica' };
}

/** Held-Karp com máscara de precedência. */
function ordenarExato(
  trades: readonly Trade[],
  base: string,
  distances: DistanceProvider,
  deps: ReadonlyMap<string, Set<string>>,
): { ordem: Trade[]; distancia: number } | null {
  const n = trades.length;
  const indice = new Map(trades.map((t, i) => [t.id, i]));
  const mascaraDeps = trades.map((t) => {
    let mascara = 0;
    for (const dep of deps.get(t.id) ?? []) {
      const i = indice.get(dep);
      if (i !== undefined) mascara |= 1 << i;
    }
    return mascara;
  });

  const total = 1 << n;
  const INF = Number.POSITIVE_INFINITY;
  const custo: number[][] = Array.from({ length: total }, () => new Array<number>(n).fill(INF));
  const anterior: number[][] = Array.from({ length: total }, () => new Array<number>(n).fill(-1));

  for (let i = 0; i < n; i += 1) {
    if (mascaraDeps[i] !== 0) continue;
    custo[1 << i]![i] = distances.between(base, trades[i]!.islandId);
  }

  for (let mascara = 1; mascara < total; mascara += 1) {
    for (let ultimo = 0; ultimo < n; ultimo += 1) {
      const atual = custo[mascara]![ultimo]!;
      if (atual === INF || !(mascara & (1 << ultimo))) continue;
      for (let proximo = 0; proximo < n; proximo += 1) {
        if (mascara & (1 << proximo)) continue;
        // só entra quando todas as dependências já foram visitadas
        if ((mascaraDeps[proximo]! & mascara) !== mascaraDeps[proximo]!) continue;
        const novaMascara = mascara | (1 << proximo);
        const novoCusto =
          atual + distances.between(trades[ultimo]!.islandId, trades[proximo]!.islandId);
        if (novoCusto < custo[novaMascara]![proximo]!) {
          custo[novaMascara]![proximo] = novoCusto;
          anterior[novaMascara]![proximo] = ultimo;
        }
      }
    }
  }

  const completa = total - 1;
  let melhor = INF;
  let melhorUltimo = -1;
  for (let i = 0; i < n; i += 1) {
    const valor = custo[completa]![i]!;
    if (valor === INF) continue;
    const comVolta = valor + distances.between(trades[i]!.islandId, base);
    if (comVolta < melhor) {
      melhor = comVolta;
      melhorUltimo = i;
    }
  }
  if (melhorUltimo < 0) return null; // precedência impossível (ciclo)

  const ordemInvertida: Trade[] = [];
  let mascara = completa;
  let atual = melhorUltimo;
  while (atual >= 0) {
    ordemInvertida.push(trades[atual]!);
    const anteriorIndice = anterior[mascara]![atual]!;
    mascara &= ~(1 << atual);
    atual = anteriorIndice;
  }

  return { ordem: ordemInvertida.reverse(), distancia: melhor };
}

/** Vizinho mais próximo respeitando precedência + 2-opt com validação. */
function ordenarHeuristico(
  trades: readonly Trade[],
  base: string,
  distances: DistanceProvider,
  deps: ReadonlyMap<string, Set<string>>,
): { ordem: Trade[]; distancia: number } {
  const restantes = new Map(trades.map((t) => [t.id, t]));
  const visitados = new Set<string>();
  const ordem: Trade[] = [];
  let atual = base;

  while (restantes.size > 0) {
    const candidatos = [...restantes.values()].filter((t) =>
      [...(deps.get(t.id) ?? [])].every((d) => visitados.has(d) || !restantes.has(d)),
    );
    // Sem candidato liberado significa ciclo: cai para a ordem topológica parcial.
    const elegiveis = candidatos.length > 0 ? candidatos : [...restantes.values()];
    let escolhido = elegiveis[0]!;
    let melhor = distances.between(atual, escolhido.islandId);
    for (const candidato of elegiveis.slice(1)) {
      const d = distances.between(atual, candidato.islandId);
      if (d < melhor) {
        melhor = d;
        escolhido = candidato;
      }
    }
    ordem.push(escolhido);
    visitados.add(escolhido.id);
    restantes.delete(escolhido.id);
    atual = escolhido.islandId;
  }

  let melhorOrdem = ordem;
  let melhorDistancia = distanciaTotal(melhorOrdem, base, distances);
  let melhorou = true;
  while (melhorou) {
    melhorou = false;
    for (let i = 0; i < melhorOrdem.length - 1; i += 1) {
      for (let j = i + 1; j < melhorOrdem.length; j += 1) {
        const candidata = [
          ...melhorOrdem.slice(0, i),
          ...melhorOrdem.slice(i, j + 1).reverse(),
          ...melhorOrdem.slice(j + 1),
        ];
        if (!ordemValida(candidata, deps)) continue;
        const distancia = distanciaTotal(candidata, base, distances);
        if (distancia < melhorDistancia - 1e-9) {
          melhorOrdem = candidata;
          melhorDistancia = distancia;
          melhorou = true;
        }
      }
    }
  }

  return { ordem: melhorOrdem, distancia: melhorDistancia };
}

/** Ordem topológica usada como fallback quando a precedência tem ciclo. */
export function ordemDeFallback(trades: readonly Trade[]): Trade[] {
  const { ordem, ciclo } = ordemTopologica(trades);
  return [...ordem, ...ciclo];
}
