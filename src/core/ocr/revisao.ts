import { maxTrocasEfetivo } from '../chain/routeIndex';
import type { ItemIndex } from '../models/itemIndex';
import type { BarterRoute, Tier, Trade } from '../models/types';
import type { TrocaLida } from './casamento';

/** Abaixo disso a leitura pede conferência mesmo sem outra rota parecida. */
export const CONFIANCA_MINIMA = 0.75;

/** Uma troca lida das prints, como aparece na revisão antes de ir para o plano. */
export interface ItemDeRevisao {
  /** Estável durante a revisão: print de origem + posição na print. */
  id: string;
  /** Nome da print de onde a troca veio. */
  origem: string;
  leitura: TrocaLida;
  /** Rota escolhida: a mais provável, ou a que o usuário escolheu entre as opções. */
  rota: BarterRoute;
  /** A mais provável seguida das alternativas próximas. */
  opcoes: BarterRoute[];
  /** `false` enquanto a leitura for ambígua e o usuário não escolheu a rota. */
  rotaConfirmada: boolean;
  recebePorTroca: number;
  remainingTrades: number;
  plannedTrades: number;
  hasStock: boolean;
  selecionada: boolean;
  /** A mesma troca (porto e itens) já está no plano. */
  jaNoPlano: boolean;
}

export type MotivoParaConferir =
  'ambigua' | 'confianca_baixa' | 'quantidade_nao_lida' | 'restante_nao_lido';

export type MotivoParaPular = 'sem_restante' | 'ambigua' | 'ja_no_plano';

/** Leitura de uma print: nome do arquivo (ou "Print colada 2") e as trocas casadas. */
export interface LeituraDePrint {
  origem: string;
  trocas: readonly TrocaLida[];
}

/** Mesmo porto e mesmos itens: rotas repetidas nos dados contam como a mesma troca. */
const assinatura = (r: Pick<BarterRoute, 'islandId' | 'giveItemId' | 'receiveItemId'>) =>
  `${r.islandId}|${r.giveItemId}|${r.receiveItemId}`;

const temFaixa = (r: BarterRoute) => r.receiveQtyMin !== r.receiveQtyMax;

function estaNoPlano(rota: BarterRoute, plano: readonly Trade[]): boolean {
  const chave = assinatura(rota);
  return plano.some(
    (t) =>
      t.routeKey === rota.key ||
      assinatura({
        islandId: t.islandId,
        giveItemId: t.inputItemId,
        receiveItemId: t.outputItemId,
      }) === chave,
  );
}

/**
 * Valores da troca para uma rota: recebe o número do ícone quando ele cabe na
 * faixa (senão o máximo); restante da print (senão o teto da rota);
 * planejadas = restante, limitado ao teto.
 */
function valoresDaRota(leitura: TrocaLida, rota: BarterRoute) {
  const qtd = leitura.linha.qtdSaida;
  const recebePorTroca =
    qtd !== null && qtd >= rota.receiveQtyMin && qtd <= rota.receiveQtyMax
      ? qtd
      : rota.receiveQtyMax;
  const teto = maxTrocasEfetivo(rota);
  const remainingTrades = leitura.linha.restante ?? teto;
  return { recebePorTroca, remainingTrades, plannedTrades: Math.min(remainingTrades, teto) };
}

/**
 * Monta a lista da revisão a partir das prints lidas. A mesma troca vista em
 * duas prints (rolagem da janela) aparece uma vez só, com a leitura de maior
 * confiança. Começam marcadas só as confiáveis, com trocas restantes e fora
 * do plano.
 */
export function montarRevisao(
  leituras: readonly LeituraDePrint[],
  plano: readonly Trade[],
): ItemDeRevisao[] {
  const porAssinatura = new Map<string, ItemDeRevisao>();
  for (const { origem, trocas } of leituras) {
    for (const [i, leitura] of trocas.entries()) {
      const rota = leitura.rota;
      const jaNoPlano = estaNoPlano(rota, plano);
      const item: ItemDeRevisao = {
        id: `${origem}#${i}`,
        origem,
        leitura,
        rota,
        opcoes: [rota, ...leitura.alternativas],
        rotaConfirmada: !leitura.ambigua,
        ...valoresDaRota(leitura, rota),
        hasStock: false,
        selecionada: false,
        jaNoPlano,
      };
      item.selecionada = motivoParaPular(item) === null;

      const chave = assinatura(rota);
      const anterior = porAssinatura.get(chave);
      if (!anterior || leitura.confianca > anterior.leitura.confianca) {
        porAssinatura.set(chave, item);
      }
    }
  }
  return [...porAssinatura.values()];
}

/** O usuário escolheu a rota de uma troca (entre as opções da leitura). */
export function escolherRota(
  item: ItemDeRevisao,
  rota: BarterRoute,
  plano: readonly Trade[],
): ItemDeRevisao {
  return {
    ...item,
    rota,
    rotaConfirmada: true,
    ...valoresDaRota(item.leitura, rota),
    jaNoPlano: estaNoPlano(rota, plano),
    selecionada: true,
  };
}

/** Por que a troca merece um olhar antes de ir para o plano (vazio: leitura confiável). */
export function motivosParaConferir(item: ItemDeRevisao): MotivoParaConferir[] {
  const motivos: MotivoParaConferir[] = [];
  if (!item.rotaConfirmada) motivos.push('ambigua');
  else if (item.leitura.confianca < CONFIANCA_MINIMA) motivos.push('confianca_baixa');
  const { qtdSaida } = item.leitura.linha;
  const qtdNaFaixa =
    qtdSaida !== null && qtdSaida >= item.rota.receiveQtyMin && qtdSaida <= item.rota.receiveQtyMax;
  if (temFaixa(item.rota) && !qtdNaFaixa) motivos.push('quantidade_nao_lida');
  if (item.leitura.linha.restante === null) motivos.push('restante_nao_lido');
  return motivos;
}

/**
 * Por que a marcação em lote pula a troca (`null`: pode marcar). O clique
 * direto na troca continua livre: a regra só protege o "marcar todas".
 */
export function motivoParaPular(item: ItemDeRevisao): MotivoParaPular | null {
  if (!item.rotaConfirmada) return 'ambigua';
  if (item.remainingTrades <= 0) return 'sem_restante';
  if (item.jaNoPlano) return 'ja_no_plano';
  return null;
}

// ---------------------------------------------------------------------------
// Filtro por degrau

export const FILTRO_TODOS = 'todos';
export const FILTRO_CONFERIR = 'conferir';
const DEGRAU_MOEDA = 'moeda_corvo';

export interface Degrau {
  chave: string;
  rotulo: string;
  ordem: number;
}

const ORDEM_DOS_TIERS: readonly Tier[] = [
  'level_0',
  'level_1',
  'level_2',
  'level_3',
  'level_4',
  'level_5',
  'level_6',
  'level_7',
  'great_ocean',
];

function rotuloDoTier(tier: Tier | null | undefined): string {
  if (!tier) return 'Outros';
  if (tier === 'level_0') return 'Mercado';
  if (tier === 'great_ocean') return 'Oceano';
  return `Nível ${tier.slice('level_'.length)}`;
}

/**
 * Degrau da troca pela rota casada: tier de entrada → tier de saída. Bem do
 * mercado é "Mercado"; Moeda Corvo é um degrau só, qualquer que seja a entrada.
 */
export function degrauDaTroca(rota: BarterRoute, items: ItemIndex): Degrau {
  if (rota.kind === 'crow_coin' || items.isOffShip(rota.receiveItemId)) {
    return { chave: DEGRAU_MOEDA, rotulo: '→ Moeda Corvo', ordem: 1000 };
  }
  const de = items.tierOf(rota.giveItemId);
  const para = items.tierOf(rota.receiveItemId);
  const indice = (t: Tier | undefined) => (t ? ORDEM_DOS_TIERS.indexOf(t) : 99);
  return {
    chave: `${de ?? 'outro'}>${para ?? 'outro'}`,
    rotulo: `${rotuloDoTier(de)} → ${rotuloDoTier(para)}`,
    ordem: indice(de) * 100 + indice(para),
  };
}

export interface OpcaoDeFiltro {
  chave: string;
  rotulo: string;
  total: number;
  marcadas: number;
}

/** O item aparece no filtro? `todos`, `conferir` ou a chave de um degrau. */
export function passaNoFiltro(item: ItemDeRevisao, filtro: string, items: ItemIndex): boolean {
  if (filtro === FILTRO_TODOS) return true;
  if (filtro === FILTRO_CONFERIR) return motivosParaConferir(item).length > 0;
  return degrauDaTroca(item.rota, items).chave === filtro;
}

/**
 * Botões do filtro: "Todos" primeiro, os degraus presentes do menor para o
 * maior (Moeda Corvo no fim) e "Para conferir" por último, quando houver.
 * Cada um com o total de trocas e quantas estão marcadas.
 */
export function resumoPorDegrau(
  itens: readonly ItemDeRevisao[],
  items: ItemIndex,
): OpcaoDeFiltro[] {
  const contar = (lista: readonly ItemDeRevisao[]) => ({
    total: lista.length,
    marcadas: lista.filter((i) => i.selecionada).length,
  });

  const degraus = new Map<string, { degrau: Degrau; lista: ItemDeRevisao[] }>();
  for (const item of itens) {
    const degrau = degrauDaTroca(item.rota, items);
    const grupo = degraus.get(degrau.chave) ?? { degrau, lista: [] };
    grupo.lista.push(item);
    degraus.set(degrau.chave, grupo);
  }

  const opcoes: OpcaoDeFiltro[] = [{ chave: FILTRO_TODOS, rotulo: 'Todos', ...contar(itens) }];
  for (const { degrau, lista } of [...degraus.values()].sort(
    (a, b) => a.degrau.ordem - b.degrau.ordem,
  )) {
    opcoes.push({ chave: degrau.chave, rotulo: degrau.rotulo, ...contar(lista) });
  }
  const conferir = itens.filter((i) => motivosParaConferir(i).length > 0);
  if (conferir.length > 0) {
    opcoes.push({ chave: FILTRO_CONFERIR, rotulo: '⚠ Para conferir', ...contar(conferir) });
  }
  return opcoes;
}

export interface ResultadoDaMarcacao {
  itens: ItemDeRevisao[];
  /** Quantas mudaram de estado. */
  alteradas: number;
  /** Ao marcar: as que ficaram de fora e por quê. */
  puladas: { id: string; motivo: MotivoParaPular }[];
}

/**
 * "Marcar todas" / "Desmarcar todas" só nas trocas visíveis no filtro. Ao
 * marcar, pula as ambíguas sem rota escolhida, as sem trocas restantes e as
 * que já estão no plano.
 */
export function marcarVisiveis(
  itens: readonly ItemDeRevisao[],
  visiveis: ReadonlySet<string>,
  marcar: boolean,
): ResultadoDaMarcacao {
  let alteradas = 0;
  const puladas: ResultadoDaMarcacao['puladas'] = [];
  const novos = itens.map((item) => {
    if (!visiveis.has(item.id) || item.selecionada === marcar) return item;
    if (marcar) {
      const motivo = motivoParaPular(item);
      if (motivo) {
        puladas.push({ id: item.id, motivo });
        return item;
      }
    }
    alteradas += 1;
    return { ...item, selecionada: marcar };
  });
  return { itens: novos, alteradas, puladas };
}
