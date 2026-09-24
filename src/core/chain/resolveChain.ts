import { balanco, sobras } from '../balance/itemBalance';
import type { ItemIndex } from '../models/itemIndex';
import { tierRank } from '../models/itemIndex';
import type { Trade } from '../models/types';
import type { RouteIndex } from './routeIndex';
import { custoBaseEfetivo, maxTrocasEfetivo } from './routeIndex';

export type ChainDiagnosticLevel = 'erro' | 'aviso' | 'info';

export type ChainDiagnosticCode =
  | 'sem_origem'
  | 'cadeia_incompleta'
  | 'sobra_de_itens'
  | 'produto_final'
  | 'compra_no_mercado'
  | 'estoque_necessario';

export interface ChainDiagnostic {
  level: ChainDiagnosticLevel;
  code: ChainDiagnosticCode;
  message: string;
  itemId?: string;
  tradeId?: string;
  quantity?: number;
}

export interface ItemQty {
  itemId: string;
  qty: number;
}

/** Uma troca precedente que o usuário poderia adicionar para suprir o item. */
export interface OpcaoDePrecedente {
  routeKey: string;
  islandId: string;
  giveItemId: string;
  giveQty: number;
  /** Menor e maior quantidade recebida por troca (a rota pode ter faixa). */
  receiveQty: number;
  receiveQtyMax: number;
  maxTrades: number;
  baseBarterCost: number;
}

/** Item que o plano consome sem ter de onde tirar. */
export interface FaltaDeOrigem {
  itemId: string;
  qty: number;
  /**
   * `false` quando nenhuma cadeia de rotas leva esse item até o mercado ou até
   * um item que o usuário possa ter em estoque — aí não há troca precedente
   * possível em todo o caminho.
   */
  possivel: boolean;
  /** Trocas que produzem o item, para o usuário escolher e informar. */
  opcoes: OpcaoDePrecedente[];
}

export interface ChainOptions {
  /** Ilhas preferidas ao ordenar as sugestões (base e ilhas já usadas no plano). */
  preferIslandIds?: readonly string[];
  /** Quantas opções de troca precedente listar por item. */
  maxOpcoes?: number;
}

export interface ChainResult {
  /** Trocas do plano, em ordem de execução por tier. */
  trades: Trade[];
  diagnostics: ChainDiagnostic[];
  /** Entradas sem origem: o usuário precisa informar a troca precedente ou o estoque. */
  faltas: FaltaDeOrigem[];
  /** Materiais T0 a comprar no mercado central. */
  shoppingList: ItemQty[];
  /** Itens que o usuário declarou ter em estoque, com a quantidade exigida pelo plano. */
  fromStock: ItemQty[];
  /** Itens produzidos além do que o plano consome. */
  leftovers: ItemQty[];
}

function soma(mapa: Map<string, number>, chave: string, valor: number): void {
  mapa.set(chave, (mapa.get(chave) ?? 0) + valor);
}

/**
 * Verifica se existe alguma cadeia de rotas que leve do mercado (bem T0) até o
 * item pedido. É a checagem de "toda a cadeia": se der `false`, não existe
 * troca precedente possível em nenhum caminho.
 */
function criarVerificadorDeOrigem(
  itemIndex: ItemIndex,
  routeIndex: RouteIndex,
): (itemId: string) => boolean {
  const memoria = new Map<string, boolean>();

  const alcancavel = (itemId: string, visitando: Set<string>): boolean => {
    const lembrado = memoria.get(itemId);
    if (lembrado !== undefined) return lembrado;
    if (itemIndex.isMarketMaterial(itemId)) {
      memoria.set(itemId, true);
      return true;
    }
    if (visitando.has(itemId)) return false; // ciclo: não resolve por aqui
    visitando.add(itemId);

    let resultado = false;
    for (const rota of routeIndex.produzindoTier(itemId)) {
      if (alcancavel(rota.giveItemId, visitando)) {
        resultado = true;
        break;
      }
    }

    visitando.delete(itemId);
    memoria.set(itemId, resultado);
    return resultado;
  };

  return (itemId) => alcancavel(itemId, new Set());
}

/**
 * Confere a cadeia de trocas do plano.
 *
 * Nada é adicionado automaticamente: cada entrada precisa vir do estoque
 * declarado na troca, de outra troca informada pelo usuário ou — no caso de bem
 * terrestre — do mercado central. O que ficar sem origem aparece em `faltas`,
 * com as trocas precedentes possíveis, e vira diagnóstico para a tela mostrar.
 */
export function resolveChain(
  trades: readonly Trade[],
  itemIndex: ItemIndex,
  routeIndex: RouteIndex,
  options: ChainOptions = {},
): ChainResult {
  const preferIslands = new Set(options.preferIslandIds ?? []);
  const maxOpcoes = options.maxOpcoes ?? 5;
  const temOrigemNaCadeia = criarVerificadorDeOrigem(itemIndex, routeIndex);

  const atuais: Trade[] = trades.map((t) => ({ ...t }));
  const diagnostics: ChainDiagnostic[] = [];
  const faltas: FaltaDeOrigem[] = [];

  const b = balanco(atuais);

  // 1. Entradas sem origem, do tier mais alto para o mais baixo.
  const deficits = [...b.need]
    .map(([itemId, qtd]) => ({ itemId, qty: qtd - (b.supply.get(itemId) ?? 0) }))
    .filter((f) => f.qty > 0 && !itemIndex.isMarketMaterial(f.itemId))
    .sort(
      (a, c) =>
        tierRank(itemIndex.tierOf(c.itemId)) - tierRank(itemIndex.tierOf(a.itemId)) ||
        a.itemId.localeCompare(c.itemId),
    );

  for (const deficit of deficits) {
    const nome = itemIndex.nameOf(deficit.itemId);
    const opcoes = opcoesDePrecedente(deficit.itemId, routeIndex, itemIndex, preferIslands).slice(
      0,
      maxOpcoes,
    );
    const possivel = opcoes.length > 0 && temOrigemNaCadeia(deficit.itemId);

    faltas.push({ itemId: deficit.itemId, qty: deficit.qty, possivel, opcoes });
    diagnostics.push({
      level: 'erro',
      code: possivel ? 'cadeia_incompleta' : 'sem_origem',
      message: possivel
        ? `Faltam ${deficit.qty}× ${nome}: marque o estoque na troca ou adicione a troca precedente ` +
          `(${opcoes.length} porto(s) fazem essa troca).`
        : `Não existe troca precedente possível para ${nome} em nenhum ponto da cadeia: ` +
          'marque que você tem o item em estoque ou remova a troca.',
      itemId: deficit.itemId,
      quantity: deficit.qty,
    });
  }

  // 2. Compras no mercado (bens terrestres sem estoque declarado).
  const shoppingList: ItemQty[] = [];
  for (const [itemId, qtd] of b.need) {
    if (!itemIndex.isMarketMaterial(itemId)) continue;
    const falta = qtd - (b.supply.get(itemId) ?? 0);
    if (falta > 0) shoppingList.push({ itemId, qty: falta });
  }
  shoppingList.sort((a, c) => itemIndex.nameOf(a.itemId).localeCompare(itemIndex.nameOf(c.itemId)));
  for (const compra of shoppingList) {
    diagnostics.push({
      level: 'info',
      code: 'compra_no_mercado',
      message: `Comprar ${compra.qty}× ${itemIndex.nameOf(compra.itemId)} no mercado central.`,
      itemId: compra.itemId,
      quantity: compra.qty,
    });
  }

  // 3. O que precisa estar no armazém antes de sair.
  const estoque = new Map<string, number>();
  for (const t of atuais) {
    if (t.hasStock) soma(estoque, t.inputItemId, t.inputQtyPerTrade * t.plannedTrades);
  }
  const fromStock: ItemQty[] = [...estoque]
    .map(([itemId, qty]) => ({ itemId, qty }))
    .sort((a, c) => itemIndex.nameOf(a.itemId).localeCompare(itemIndex.nameOf(c.itemId)));
  for (const item of fromStock) {
    diagnostics.push({
      level: 'info',
      code: 'estoque_necessario',
      message: `Precisa de ${item.qty}× ${itemIndex.nameOf(item.itemId)} no estoque antes de sair.`,
      itemId: item.itemId,
      quantity: item.qty,
    });
  }

  // 4. Sobras e produto final.
  const consumidos = new Set(atuais.filter((t) => !t.hasStock).map((t) => t.inputItemId));
  const leftovers: ItemQty[] = [];
  for (const [itemId, qty] of sobras(b)) {
    leftovers.push({ itemId, qty });
    const eConsumido = consumidos.has(itemId);
    diagnostics.push({
      level: eConsumido ? 'aviso' : 'info',
      code: eConsumido ? 'sobra_de_itens' : 'produto_final',
      message: eConsumido
        ? `Sobram ${qty}× ${itemIndex.nameOf(itemId)} sem troca seguinte no plano.`
        : `Produto final do plano: ${qty}× ${itemIndex.nameOf(itemId)}.`,
      itemId,
      quantity: qty,
    });
  }
  leftovers.sort((a, c) => itemIndex.nameOf(a.itemId).localeCompare(itemIndex.nameOf(c.itemId)));

  atuais.sort((a, c) => rankDaTroca(a, itemIndex) - rankDaTroca(c, itemIndex));

  return { trades: atuais, diagnostics, faltas, shoppingList, fromStock, leftovers };
}

/**
 * Posição da troca na ordem de execução: o tier da saída, ou, quando a saída
 * não tem tier (Moeda Corvo), logo depois do tier da entrada.
 */
function rankDaTroca(trade: Trade, itemIndex: ItemIndex): number {
  const saida = itemIndex.tierOf(trade.outputItemId);
  return saida ? tierRank(saida) : tierRank(itemIndex.tierOf(trade.inputItemId)) + 0.5;
}

/** Rotas que produzem o item, ordenadas pelas mais convenientes primeiro. */
function opcoesDePrecedente(
  itemId: string,
  routeIndex: RouteIndex,
  itemIndex: ItemIndex,
  preferIslands: ReadonlySet<string>,
): OpcaoDePrecedente[] {
  return [...routeIndex.produzindoTier(itemId)]
    .sort((a, c) => {
      const ilhaA = preferIslands.has(a.islandId) ? 0 : 1;
      const ilhaC = preferIslands.has(c.islandId) ? 0 : 1;
      if (ilhaA !== ilhaC) return ilhaA - ilhaC;

      const fonteA = a.source === 'normal' ? 0 : 1;
      const fonteC = c.source === 'normal' ? 0 : 1;
      if (fonteA !== fonteC) return fonteA - fonteC;

      // menos peso de entrada por unidade recebida
      const pesoA = (a.giveQty * itemIndex.weightOf(a.giveItemId)) / a.receiveQtyMin;
      const pesoC = (c.giveQty * itemIndex.weightOf(c.giveItemId)) / c.receiveQtyMin;
      if (pesoA !== pesoC) return pesoA - pesoC;

      if (a.receiveQtyMin !== c.receiveQtyMin) return c.receiveQtyMin - a.receiveQtyMin;
      return a.key.localeCompare(c.key);
    })
    .map((rota) => ({
      routeKey: rota.key,
      islandId: rota.islandId,
      giveItemId: rota.giveItemId,
      giveQty: rota.giveQty,
      receiveQty: rota.receiveQtyMin,
      receiveQtyMax: rota.receiveQtyMax,
      maxTrades: maxTrocasEfetivo(rota),
      baseBarterCost: custoBaseEfetivo(rota),
    }));
}
