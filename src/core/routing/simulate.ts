import {
  adicionar,
  itensDaCarga,
  pesoDaCarga,
  remover,
  slotsDaCarga,
  type Cargo,
  type ItemQty,
} from '../cargo/cargo';
import type { Trade } from '../models/types';
import type { RouteContext, Trip, TripStep, TripStop } from './types';

export interface FalhaDeCarga {
  tradeId: string | null;
  motivo: 'peso' | 'slots';
  pesoLt: number;
  slots: number;
}

export interface SimulacaoResultado {
  ok: boolean;
  trip: Trip;
  falha: FalhaDeCarga | null;
}

/** O que precisa entrar no navio na base para a viagem funcionar. */
function calcularCarregamento(trades: readonly Trade[]): Map<string, number> {
  let cargo = new Map<string, number>();
  const preload = new Map<string, number>();

  for (const trade of trades) {
    const precisa = trade.inputQtyPerTrade * trade.plannedTrades;
    const disponivel = cargo.get(trade.inputItemId) ?? 0;
    const falta = precisa - disponivel;
    if (falta > 0) {
      preload.set(trade.inputItemId, (preload.get(trade.inputItemId) ?? 0) + falta);
      cargo.set(trade.inputItemId, disponivel + falta);
    }
    cargo = remover(cargo, trade.inputItemId, precisa) ?? cargo;
    cargo = adicionar(cargo, trade.outputItemId, trade.outputQtyPerTrade * trade.plannedTrades);
  }
  return preload;
}

/**
 * Simula uma viagem parada a parada: carrega na base, executa as trocas na
 * ordem recebida, volta e descarrega. Recalcula peso e slots depois de cada
 * passo e falha no primeiro momento em que a carga não couber.
 */
export function simularViagem(
  trades: readonly Trade[],
  ctx: RouteContext,
  index: number,
): SimulacaoResultado {
  const { items, limits, distances, baseIslandId } = ctx;
  const steps: TripStep[] = [];
  let cargo: Cargo = calcularCarregamento(trades);
  let falha: FalhaDeCarga | null = null;
  let picoPeso = 0;
  let picoSlots = 0;

  const medir = (tradeId: string | null): { weightLt: number; slots: number } => {
    const weightLt = pesoDaCarga(cargo, items);
    const slots = slotsDaCarga(cargo, items);
    picoPeso = Math.max(picoPeso, weightLt);
    picoSlots = Math.max(picoSlots, slots);
    if (!falha) {
      if (weightLt > limits.maxWeightLt)
        falha = { tradeId, motivo: 'peso', pesoLt: weightLt, slots };
      else if (slots > limits.slots) falha = { tradeId, motivo: 'slots', pesoLt: weightLt, slots };
    }
    return { weightLt, slots };
  };

  const loadAtBase: ItemQty[] = itensDaCarga(cargo);
  steps.push({ kind: 'load', islandId: baseIslandId, items: loadAtBase, ...medir(null) });

  let posicao = baseIslandId;
  let distancia = 0;
  const stops: TripStop[] = [];

  for (const trade of trades) {
    if (trade.islandId !== posicao) {
      const trecho = distances.between(posicao, trade.islandId);
      distancia += trecho;
      steps.push({
        kind: 'sail',
        fromIslandId: posicao,
        islandId: trade.islandId,
        distance: trecho,
        weightLt: pesoDaCarga(cargo, items),
        slots: slotsDaCarga(cargo, items),
      });
      posicao = trade.islandId;
    }

    const entrada = trade.inputQtyPerTrade * trade.plannedTrades;
    const saida = trade.outputQtyPerTrade * trade.plannedTrades;
    cargo = remover(cargo, trade.inputItemId, entrada) ?? cargo;
    cargo = adicionar(cargo, trade.outputItemId, saida);

    steps.push({
      kind: 'trade',
      islandId: trade.islandId,
      tradeId: trade.id,
      times: trade.plannedTrades,
      input: { itemId: trade.inputItemId, qty: entrada },
      output: { itemId: trade.outputItemId, qty: saida },
      ...medir(trade.id),
    });

    const ultima = stops[stops.length - 1];
    if (ultima && ultima.islandId === trade.islandId) ultima.tradeIds.push(trade.id);
    else stops.push({ islandId: trade.islandId, tradeIds: [trade.id] });
  }

  if (posicao !== baseIslandId) {
    const volta = distances.between(posicao, baseIslandId);
    distancia += volta;
    steps.push({
      kind: 'sail',
      fromIslandId: posicao,
      islandId: baseIslandId,
      distance: volta,
      weightLt: pesoDaCarga(cargo, items),
      slots: slotsDaCarga(cargo, items),
    });
  }

  const unloadAtBase = itensDaCarga(cargo);
  steps.push({
    kind: 'unload',
    islandId: baseIslandId,
    items: unloadAtBase,
    weightLt: 0,
    slots: 0,
  });

  return {
    ok: falha === null,
    falha,
    trip: {
      index,
      stops,
      steps,
      distance: distancia,
      loadAtBase,
      unloadAtBase,
      peakWeightLt: picoPeso,
      peakSlots: picoSlots,
    },
  };
}
