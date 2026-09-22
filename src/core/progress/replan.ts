import type { Trade } from '../models/types';
import { ordemTopologica } from '../routing/precedence';

/** Quantas trocas de cada troca planejada já foram feitas no jogo. */
export type ProgressoDeTrocas = Readonly<Record<string, number>>;

/**
 * Sufixo do id usado quando o replanejamento divide uma troca em duas: a parte
 * coberta pelo estoque em mãos e o resto.
 */
export const SUFIXO_ESTOQUE = '#estoque';

/** Id da troca do plano por trás de uma troca dividida pelo replanejamento. */
export function idOriginalDaTroca(tradeId: string): string {
  const [original] = tradeId.split('#');
  return original ?? tradeId;
}

/**
 * Registra (ou desfaz) as trocas de um passo do roteiro no progresso. A
 * quantidade é sempre somada no id original, então marcar as duas metades de
 * uma troca dividida soma corretamente.
 */
export function registrarProgresso(
  progresso: ProgressoDeTrocas,
  tradeId: string,
  quantidade: number,
  concluido: boolean,
): Record<string, number> {
  const id = idOriginalDaTroca(tradeId);
  const passo = Number.isFinite(quantidade) ? Math.max(Math.trunc(quantidade), 0) : 0;
  const atual = progresso[id] ?? 0;
  const feitas = concluido ? atual + passo : Math.max(atual - passo, 0);

  const novo = { ...progresso };
  if (feitas <= 0) delete novo[id];
  else novo[id] = feitas;
  return novo;
}

export interface Replanejamento {
  /** Trocas que ainda faltam, já com o estoque em mãos considerado. */
  trades: Trade[];
  /** O que sobrou no armazém/porão depois do que já foi feito. */
  inventario: Map<string, number>;
  /** Ids das trocas totalmente concluídas. */
  concluidas: string[];
}

function feitasDe(trade: Trade, progresso: ProgressoDeTrocas): number {
  const bruto = progresso[trade.id] ?? 0;
  if (!Number.isFinite(bruto) || bruto <= 0) return 0;
  return Math.min(Math.trunc(bruto), trade.plannedTrades);
}

function consumir(inventario: Map<string, number>, itemId: string, qtd: number): void {
  const disponivel = inventario.get(itemId) ?? 0;
  inventario.set(itemId, Math.max(disponivel - qtd, 0));
}

function produzir(inventario: Map<string, number>, itemId: string, qtd: number): void {
  inventario.set(itemId, (inventario.get(itemId) ?? 0) + qtd);
}

/**
 * Recalcula o que falta do plano a partir do progresso registrado.
 *
 * Trocas concluídas saem do roteiro; trocas parciais continuam com o restante.
 * O que as trocas já feitas produziram e ninguém consumiu conta como estoque:
 * a parte do restante coberta por esse estoque é marcada com `hasStock`, para
 * que a cadeia não recrie trocas precedentes já realizadas.
 */
export function replanejar(trades: readonly Trade[], progresso: ProgressoDeTrocas): Replanejamento {
  const { ordem, ciclo } = ordemTopologica(trades);
  const sequencia = [...ordem, ...ciclo];

  const inventario = new Map<string, number>();
  const concluidas: string[] = [];

  // 1. Efeito do que já foi feito.
  for (const trade of sequencia) {
    const feitas = feitasDe(trade, progresso);
    if (feitas === 0) continue;
    if (!trade.hasStock) consumir(inventario, trade.inputItemId, trade.inputQtyPerTrade * feitas);
    produzir(inventario, trade.outputItemId, trade.outputQtyPerTrade * feitas);
    if (feitas >= trade.plannedTrades) concluidas.push(trade.id);
  }

  // 2. O que falta, cobrindo com o estoque em mãos quando possível.
  const restantes: Trade[] = [];
  for (const trade of sequencia) {
    const faltam = trade.plannedTrades - feitasDe(trade, progresso);
    if (faltam <= 0) continue;

    if (trade.hasStock) {
      restantes.push({ ...trade, plannedTrades: faltam });
      continue;
    }

    const disponivel = inventario.get(trade.inputItemId) ?? 0;
    const cobertas = Math.min(faltam, Math.floor(disponivel / trade.inputQtyPerTrade));

    if (cobertas > 0) {
      restantes.push({
        ...trade,
        id: `${trade.id}${SUFIXO_ESTOQUE}`,
        plannedTrades: cobertas,
        hasStock: true,
      });
      consumir(inventario, trade.inputItemId, cobertas * trade.inputQtyPerTrade);
    }
    if (faltam - cobertas > 0) {
      restantes.push({ ...trade, plannedTrades: faltam - cobertas });
    }
  }

  return { trades: restantes, inventario, concluidas };
}
