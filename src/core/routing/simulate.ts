import {
  adicionar,
  itensDaCarga,
  limiteDeSobrepeso,
  melhorTransferencia,
  pesoDaCarga,
  remover,
  slotsDaCarga,
  t7Vendaveis,
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

/** Junta a carga que volta no porão com o pack que veio no inventário. */
function juntarItens(...listas: readonly ItemQty[][]): ItemQty[] {
  const total = new Map<string, number>();
  for (const lista of listas) {
    for (const { itemId, qty } of lista) total.set(itemId, (total.get(itemId) ?? 0) + qty);
  }
  return itensDaCarga(total);
}

/**
 * Simula uma viagem parada a parada: carrega na base, executa as trocas na
 * ordem recebida, volta e descarrega. Recalcula peso e slots depois de cada
 * passo e falha no primeiro momento em que a carga não couber.
 *
 * Sobrepeso (quando ligado nas Configurações): uma troca pode passar do peso
 * livre até o teto de `limits.overweight.limitLt`, mas o navio fica travado —
 * nenhuma outra troca acontece antes de aliviar. O alívio é a transferência de
 * **1 slot** para o inventário do personagem no gerente de cais mais próximo,
 * uma única vez por viagem; no modo `transferencia` o sobrepeso só é aceito
 * quando essa transferência devolve o peso para dentro do limite.
 *
 * Venda de T7 (quando `ctx.sellT7`): só acontece quando é preciso aliviar, em
 * dois momentos — **antes** de uma troca que deixaria o navio acima do peso ou
 * dos slots (para na doca que menos desvia do caminho até o porto da troca) e
 * **depois** de uma troca que deixou o navio pesado, se o próprio porto tem
 * gerente de cais. O vendido sai da carga e não volta para a base. T7 que
 * ainda vai ser gasto numa troca seguinte da viagem nunca é vendido.
 */
export function simularViagem(
  trades: readonly Trade[],
  ctx: RouteContext,
  index: number,
): SimulacaoResultado {
  const { items, limits, distances, baseIslandId } = ctx;
  const teto = limiteDeSobrepeso(limits);
  const modo = limits.overweight?.mode ?? null;
  const gerentes = ctx.wharfIslandIds ?? [];

  const steps: TripStep[] = [];
  let cargo: Cargo = calcularCarregamento(trades);
  let falha: FalhaDeCarga | null = null;
  let picoPeso = 0;
  let picoSlots = 0;
  let posicao = baseIslandId;
  let distancia = 0;
  let emSobrepeso = false;
  const inventory: ItemQty[] = [];
  const sold: ItemQty[] = [];

  const peso = () => pesoDaCarga(cargo, items);
  const slots = () => slotsDaCarga(cargo, items);

  const medir = (): { weightLt: number; slots: number } => {
    const estado = { weightLt: peso(), slots: slots() };
    picoPeso = Math.max(picoPeso, estado.weightLt);
    picoSlots = Math.max(picoSlots, estado.slots);
    return estado;
  };

  const falhar = (
    tradeId: string | null,
    motivo: FalhaDeCarga['motivo'],
    estado: { weightLt: number; slots: number },
  ) => {
    falha ??= { tradeId, motivo, pesoLt: estado.weightLt, slots: estado.slots };
  };

  const navegarPara = (destino: string) => {
    if (destino === posicao) return;
    const trecho = distances.between(posicao, destino);
    distancia += trecho;
    steps.push({
      kind: 'sail',
      fromIslandId: posicao,
      islandId: destino,
      distance: trecho,
      weightLt: peso(),
      slots: slots(),
    });
    posicao = destino;
  };

  const gerenteMaisProximo = (): string | null => {
    let melhor: string | null = null;
    let menor = Infinity;
    for (const id of gerentes) {
      const d = distances.between(posicao, id);
      if (d < menor) {
        menor = d;
        melhor = id;
      }
    }
    return melhor;
  };

  /** Gerente de cais que menos alonga o caminho da posição atual até `destino`. */
  const docaNoCaminho = (destino: string): string | null => {
    let melhor: string | null = null;
    let menor = Infinity;
    for (const id of gerentes) {
      const d = distances.between(posicao, id) + distances.between(id, destino);
      if (d < menor) {
        menor = d;
        melhor = id;
      }
    }
    return melhor;
  };

  /**
   * Vende os T7 livres num gerente de cais. Com `destino`, vai até a doca que
   * menos desvia do caminho até lá; sem `destino`, só vende se a parada atual
   * tiver gerente de cais (o navio pesado não pode sair navegando).
   */
  const venderT7 = (destino: string | null, reservado: ReadonlyMap<string, number>): boolean => {
    if (!ctx.sellT7) return false;
    const vendaveis = t7Vendaveis(cargo, items, reservado);
    if (vendaveis.length === 0) return false;

    const doca =
      destino === null ? (gerentes.includes(posicao) ? posicao : null) : docaNoCaminho(destino);
    if (doca === null) return false;

    navegarPara(doca);
    for (const { itemId, qty } of vendaveis) cargo = remover(cargo, itemId, qty) ?? cargo;
    sold.push(...vendaveis);
    steps.push({ kind: 'sell', islandId: doca, items: vendaveis, ...medir() });
    emSobrepeso = peso() > limits.maxWeightLt;
    return true;
  };

  /**
   * Manda o melhor pack de 1 slot para o inventário, no gerente de cais mais
   * próximo. `exigirAlivio` só aceita a transferência se o peso voltar para
   * dentro do limite do navio.
   */
  const tentarTransferencia = (
    exigirAlivio: boolean,
    reservado: ReadonlyMap<string, number>,
  ): boolean => {
    if (inventory.length > 0) return false; // uma transferência por viagem
    const candidato = melhorTransferencia(cargo, items, reservado);
    if (!candidato) return false;
    const restante = remover(cargo, candidato.itemId, candidato.qty);
    if (!restante) return false;
    if (exigirAlivio && pesoDaCarga(restante, items) > limits.maxWeightLt) return false;

    const destino = gerenteMaisProximo();
    if (destino === null) return false;
    // Sem sobrepeso liberado, só dá para usar o gerente da própria parada:
    // navegar até outro porto já estouraria o peso.
    if (!limits.overweight && peso() > limits.maxWeightLt && destino !== posicao) return false;

    navegarPara(destino);
    cargo = restante;
    inventory.push(candidato);
    steps.push({ kind: 'transfer', islandId: destino, item: candidato, ...medir() });
    emSobrepeso = peso() > limits.maxWeightLt;
    return true;
  };

  /** Entradas ainda por gastar a partir da troca `i`: não podem ser transferidas. */
  const reservas: Map<string, number>[] = [];
  {
    let acumulado = new Map<string, number>();
    for (let i = trades.length - 1; i >= 0; i -= 1) {
      const trade = trades[i]!;
      acumulado = new Map(acumulado);
      acumulado.set(
        trade.inputItemId,
        (acumulado.get(trade.inputItemId) ?? 0) + trade.inputQtyPerTrade * trade.plannedTrades,
      );
      reservas[i] = acumulado;
    }
  }
  const reservaEm = (i: number): Map<string, number> => reservas[i] ?? new Map();

  const loadAtBase: ItemQty[] = itensDaCarga(cargo);
  const inicial = medir();
  steps.push({ kind: 'load', islandId: baseIslandId, items: loadAtBase, ...inicial });
  if (inicial.weightLt > limits.maxWeightLt) falhar(null, 'peso', inicial);
  else if (inicial.slots > limits.slots) falhar(null, 'slots', inicial);

  const stops: TripStop[] = [];

  for (const [i, trade] of trades.entries()) {
    const entrada = trade.inputQtyPerTrade * trade.plannedTrades;
    const saida = trade.outputQtyPerTrade * trade.plannedTrades;

    // Venda antecipada: se a troca vai deixar o navio pesado (ou ele já está
    // em sobrepeso), vende os T7 livres no caminho até o porto da troca.
    const depois = adicionar(
      remover(cargo, trade.inputItemId, entrada) ?? cargo,
      trade.outputItemId,
      saida,
    );
    if (
      emSobrepeso ||
      pesoDaCarga(depois, items) > limits.maxWeightLt ||
      slotsDaCarga(depois, items) > limits.slots
    ) {
      venderT7(trade.islandId, reservaEm(i));
    }

    // Em sobrepeso o navio está travado: ou a transferência alivia, ou a
    // viagem acaba aqui e a troca fica para a próxima.
    if (emSobrepeso && !tentarTransferencia(true, reservaEm(i))) {
      falhar(trade.id, 'peso', medir());
      emSobrepeso = false;
    }

    navegarPara(trade.islandId);

    cargo = remover(cargo, trade.inputItemId, entrada) ?? cargo;
    cargo = adicionar(cargo, trade.outputItemId, saida);

    const estado = medir();
    steps.push({
      kind: 'trade',
      islandId: trade.islandId,
      tradeId: trade.id,
      times: trade.plannedTrades,
      input: { itemId: trade.inputItemId, qty: entrada },
      output: { itemId: trade.outputItemId, qty: saida },
      ...estado,
    });

    // Venda na hora: a troca deixou o navio pesado e o porto tem gerente de cais.
    if (peso() > limits.maxWeightLt || slots() > limits.slots) venderT7(null, reservaEm(i + 1));

    if (peso() > limits.maxWeightLt) {
      if (!limits.overweight || estado.weightLt > teto) falhar(trade.id, 'peso', estado);
      else if (modo === 'transferencia') {
        if (!tentarTransferencia(true, reservaEm(i + 1))) falhar(trade.id, 'peso', estado);
      } else emSobrepeso = true;
    }

    if (slots() > limits.slots && !tentarTransferencia(false, reservaEm(i + 1)))
      falhar(trade.id, 'slots', estado);
    if (slots() > limits.slots) falhar(trade.id, 'slots', estado);

    const ultima = stops[stops.length - 1];
    if (ultima && ultima.islandId === trade.islandId) ultima.tradeIds.push(trade.id);
    else stops.push({ islandId: trade.islandId, tradeIds: [trade.id] });
  }

  navegarPara(baseIslandId);

  const unloadAtBase = juntarItens(itensDaCarga(cargo), inventory);
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
      inventory,
      sold,
      peakWeightLt: picoPeso,
      peakSlots: picoSlots,
    },
  };
}
