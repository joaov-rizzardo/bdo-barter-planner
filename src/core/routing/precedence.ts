import type { Trade } from '../models/types';

/**
 * Precedência entre trocas: B depende de A quando a saída de A é a entrada de B
 * e B não foi marcada como "tenho em estoque".
 */
export function dependencias(trades: readonly Trade[]): Map<string, Set<string>> {
  const porSaida = new Map<string, string[]>();
  for (const t of trades) {
    const lista = porSaida.get(t.outputItemId);
    if (lista) lista.push(t.id);
    else porSaida.set(t.outputItemId, [t.id]);
  }

  const mapa = new Map<string, Set<string>>();
  for (const t of trades) {
    const deps = new Set<string>();
    if (!t.hasStock) {
      for (const id of porSaida.get(t.inputItemId) ?? []) {
        if (id !== t.id) deps.add(id);
      }
    }
    mapa.set(t.id, deps);
  }
  return mapa;
}

/**
 * Ordem topológica das trocas (produção antes do consumo). Em caso de ciclo,
 * devolve a ordem parcial possível e lista as trocas que ficaram presas.
 */
export function ordemTopologica(trades: readonly Trade[]): {
  ordem: Trade[];
  ciclo: Trade[];
} {
  const deps = dependencias(trades);
  const pendentes = new Map(trades.map((t) => [t.id, t]));
  const prontos = new Set<string>();
  const ordem: Trade[] = [];

  let progrediu = true;
  while (progrediu && pendentes.size > 0) {
    progrediu = false;
    for (const [id, trade] of [...pendentes]) {
      const faltando = [...(deps.get(id) ?? [])].some((d) => pendentes.has(d) && !prontos.has(d));
      if (faltando) continue;
      ordem.push(trade);
      prontos.add(id);
      pendentes.delete(id);
      progrediu = true;
    }
  }

  return { ordem, ciclo: [...pendentes.values()] };
}

/** Verdadeiro se a sequência respeita todas as precedências. */
export function ordemValida(
  sequencia: readonly Trade[],
  deps: ReadonlyMap<string, Set<string>>,
): boolean {
  const vistos = new Set<string>();
  const noPlano = new Set(sequencia.map((t) => t.id));
  for (const trade of sequencia) {
    for (const dep of deps.get(trade.id) ?? []) {
      // Dependência de outra viagem (não está nesta sequência) já foi feita antes.
      if (noPlano.has(dep) && !vistos.has(dep)) return false;
    }
    vistos.add(trade.id);
  }
  return true;
}
