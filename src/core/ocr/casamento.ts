import type { ItemIndex } from '../models/itemIndex';
import type { BarterRoute, Island } from '../models/types';
import type { LinhaDePermuta } from './layout';
import { normalizarNome, semelhanca, tierDaEtiqueta } from './texto';

/** Linha da janela já com as quantidades lidas dos ícones (`null`: não deu para ler). */
export interface LinhaLida extends LinhaDePermuta {
  qtdEntrada: number | null;
  qtdSaida: number | null;
}

export interface TrocaLida {
  linha: LinhaLida;
  rota: BarterRoute;
  /** Recebe por troca: o número do ícone quando cabe na faixa da rota, senão o máximo. */
  recebePorTroca: number;
  /** 0 a 1: quão bem o texto lido bate com a rota escolhida. */
  confianca: number;
  /** A segunda melhor rota ficou perto: vale conferir. */
  ambigua: boolean;
  /** Outras rotas que ficaram perto da escolhida (no máximo 2), para o usuário conferir. */
  alternativas: BarterRoute[];
  /**
   * Os outros portos com os mesmos itens de entrada e saída da escolhida: a saída quando o
   * nome do porto não foi lido direito. Primeiro os que aceitam o número lido no ícone,
   * depois do mais para o menos provável.
   */
  outrosPortos: BarterRoute[];
  /** De onde veio `recebePorTroca`: número lido no ícone ou máximo da faixa da rota. */
  origemDaQuantidade: 'icone' | 'maximo_da_faixa';
}

export interface DadosDoCasamento {
  islands: readonly Island[];
  routes: readonly BarterRoute[];
  items: ItemIndex;
}

const PESO_ILHA = 1;
const PESO_ENTRADA = 1.2;
const PESO_SAIDA = 1.2;
/** Diferença de nota abaixo da qual a segunda rota deixa a leitura ambígua. */
const MARGEM_AMBIGUA = 0.03;
/** Rotas até essa diferença da melhor aparecem como alternativas. */
const MARGEM_ALTERNATIVA = 0.06;

/** Semelhança do texto lido com uma ilha ou item, guardada por id. */
type Semelhanca = (id: string) => number;

function memo(calcular: Semelhanca): Semelhanca {
  const cache = new Map<string, number>();
  return (id) => {
    let valor = cache.get(id);
    if (valor === undefined) {
      valor = calcular(id);
      cache.set(id, valor);
    }
    return valor;
  };
}

/**
 * Pontuação de 0 a 1 de uma rota para a linha lida: semelhança do nome da
 * ilha, dos itens (com a etiqueta de tier) e das quantidades dos ícones. A
 * quantidade de entrada pesa menos: o "1" pequeno é o dígito que mais engana.
 */
function pontuar(
  linha: LinhaLida,
  rota: BarterRoute,
  ilha: Semelhanca,
  entrada: Semelhanca,
  saida: Semelhanca,
): number {
  let qtd = 0;
  if (linha.qtdEntrada !== null) qtd += linha.qtdEntrada === rota.giveQty ? 0.05 : -0.05;
  if (linha.qtdSaida !== null) {
    const naFaixa = linha.qtdSaida >= rota.receiveQtyMin && linha.qtdSaida <= rota.receiveQtyMax;
    qtd += naFaixa ? 0.1 : -0.1;
  }
  const total =
    PESO_ILHA * ilha(rota.islandId) +
    PESO_ENTRADA * entrada(rota.giveItemId) +
    PESO_SAIDA * saida(rota.receiveItemId);
  return total / (PESO_ILHA + PESO_ENTRADA + PESO_SAIDA) + qtd;
}

/**
 * Encontra a rota do jogo que corresponde a cada linha lida. Compara com
 * todas as rotas (não só as da ilha lida): nomes de ilha cortados ou que só
 * existem em inglês nos dados ainda casam pelos itens e pelas quantidades.
 */
export function casarLinhas(linhas: readonly LinhaLida[], dados: DadosDoCasamento): TrocaLida[] {
  const nomesDeIlha = new Map(
    dados.islands.map((i) => [i.id, [normalizarNome(i.namePt), normalizarNome(i.name)]]),
  );
  const nomesDeItem = new Map<string, string[]>();
  const nomes = (itemId: string) => {
    let n = nomesDeItem.get(itemId);
    if (!n) {
      const info = dados.items.get(itemId);
      n = info ? [normalizarNome(info.namePt), normalizarNome(info.name)] : [];
      nomesDeItem.set(itemId, n);
    }
    return n;
  };
  const maior = (lido: string, conhecidos: readonly string[]) =>
    Math.max(0, ...conhecidos.map((n) => semelhanca(lido, n)));

  const itemLido = (texto: string): Semelhanca => {
    const lido = normalizarNome(texto);
    const tierLido = tierDaEtiqueta(texto);
    return memo((itemId) => {
      const s = maior(lido, nomes(itemId));
      const tier = dados.items.tierOf(itemId);
      return tierLido && tier && tier !== 'level_0' && tierLido !== tier ? s * 0.8 : s;
    });
  };

  const lidas: TrocaLida[] = [];
  for (const linha of linhas) {
    const ilhaLida = normalizarNome(linha.ilhaTexto);
    const ilha = memo((id) => maior(ilhaLida, nomesDeIlha.get(id) ?? []));
    const entrada = itemLido(linha.entradaTexto);
    const saida = itemLido(linha.saidaTexto);

    const notas = dados.routes
      .map((rota) => ({ rota, nota: pontuar(linha, rota, ilha, entrada, saida) }))
      .sort((a, b) => b.nota - a.nota);
    const melhor = notas[0];
    if (!melhor) continue;
    // Rotas repetidas (mesmo porto e mesmos itens) não contam como dúvida.
    const assinatura = (r: BarterRoute) => `${r.islandId}|${r.giveItemId}|${r.receiveItemId}`;
    const segunda = notas.find((n) => assinatura(n.rota) !== assinatura(melhor.rota))?.nota ?? 0;
    const vistas = new Set([assinatura(melhor.rota)]);
    const alternativas: BarterRoute[] = [];
    for (const n of notas) {
      if (alternativas.length >= 2 || melhor.nota - n.nota > MARGEM_ALTERNATIVA) break;
      if (vistas.has(assinatura(n.rota))) continue;
      vistas.add(assinatura(n.rota));
      alternativas.push(n.rota);
    }

    const { rota } = melhor;
    // Mesmos itens em outros portos, sem repetir a escolhida nem as alternativas.
    const outrosPortos: BarterRoute[] = [];
    for (const n of notas) {
      const r = n.rota;
      if (r.giveItemId !== rota.giveItemId || r.receiveItemId !== rota.receiveItemId) continue;
      if (vistas.has(assinatura(r))) continue;
      vistas.add(assinatura(r));
      outrosPortos.push(r);
    }
    // Primeiro os que aceitam o número lido no ícone (a ordem de nota se mantém dentro de cada grupo).
    const aceita = (r: BarterRoute) =>
      linha.qtdSaida !== null &&
      linha.qtdSaida >= r.receiveQtyMin &&
      linha.qtdSaida <= r.receiveQtyMax;
    outrosPortos.sort((a, b) => Number(aceita(b)) - Number(aceita(a)));
    const naFaixa =
      linha.qtdSaida !== null &&
      linha.qtdSaida >= rota.receiveQtyMin &&
      linha.qtdSaida <= rota.receiveQtyMax;
    lidas.push({
      linha,
      rota,
      recebePorTroca: naFaixa ? linha.qtdSaida! : rota.receiveQtyMax,
      confianca: Math.min(1, Math.max(0, melhor.nota)),
      ambigua: melhor.nota - segunda < MARGEM_AMBIGUA,
      alternativas,
      outrosPortos,
      origemDaQuantidade: naFaixa ? 'icone' : 'maximo_da_faixa',
    });
  }
  return lidas;
}
