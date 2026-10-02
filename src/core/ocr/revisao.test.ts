import { describe, expect, it } from 'vitest';
import { CROW_COIN_BASE_COST, CROW_COIN_ID } from '../data/tierRules';
import { ItemIndex } from '../models/itemIndex';
import type { BarterItem, BarterRoute, Trade } from '../models/types';
import type { TrocaLida } from './casamento';
import { novaTrocaDaRevisao, trocasSelecionadas } from './paraTroca';
import {
  FILTRO_CONFERIR,
  FILTRO_TODOS,
  degrauDaTroca,
  editarItem,
  escolherRota,
  incluirLeitura,
  marcarVisiveis,
  montarRevisao,
  motivosParaConferir,
  passaNoFiltro,
  resumoPorDegrau,
} from './revisao';

const item = (id: string, tier: BarterItem['tier']): BarterItem => ({
  id,
  name: id,
  namePt: id,
  tier,
  weightLt: 100,
  stacks: true,
  icon: null,
});

const items = new ItemIndex(
  [item('t1', 'level_1'), item('t2', 'level_2'), item('t6', 'level_6'), item('t7', 'level_7')],
  [{ id: 'm', name: 'm', namePt: 'Material', weightLt: 0.3, icon: null }],
);

const rota = (parcial: Partial<BarterRoute> & Pick<BarterRoute, 'key'>): BarterRoute => ({
  islandId: 'A',
  source: 'normal',
  giveItemId: 't6',
  giveTier: 'level_6',
  giveQty: 1,
  receiveItemId: 't7',
  receiveTier: 'level_7',
  receiveQtyMin: 1,
  receiveQtyMax: 1,
  parleyRequired: 0,
  maxTrades: 5,
  kind: 'tier',
  ...parcial,
});

const lida = (
  r: BarterRoute,
  opcoes: Partial<Omit<TrocaLida, 'linha'>> & {
    restante?: number | null;
    qtdSaida?: number | null;
  } = {},
): TrocaLida => {
  const { restante = 5, qtdSaida = null, ...resto } = opcoes;
  const caixa = { x: 0, y: 0, largura: 1, altura: 1 };
  return {
    linha: {
      ilhaTexto: '',
      entradaTexto: '',
      saidaTexto: '',
      restante,
      barganha: 10743,
      quantidadeEntrada: caixa,
      quantidadeSaida: caixa,
      alturaDigito: 8,
      geometria: { bx: 0, by: 0, h: 60 },
      qtdEntrada: null,
      qtdSaida,
    },
    rota: r,
    recebePorTroca: r.receiveQtyMax,
    confianca: 0.95,
    ambigua: false,
    alternativas: [],
    outrosPortos: [],
    origemDaQuantidade: 'maximo_da_faixa',
    ...resto,
  };
};

const t6t7 = rota({ key: 'r67' });
const t1t2 = rota({
  key: 'r12',
  islandId: 'B',
  giveItemId: 't1',
  giveTier: 'level_1',
  receiveItemId: 't2',
  receiveTier: 'level_2',
  receiveQtyMin: 2,
  receiveQtyMax: 3,
  maxTrades: 10,
});
const moeda = rota({
  key: 'rm',
  islandId: 'C',
  receiveItemId: CROW_COIN_ID,
  receiveTier: null,
  receiveQtyMin: 100,
  receiveQtyMax: 190,
  maxTrades: 0,
  kind: 'crow_coin',
});
const mercado = rota({
  key: 'r01',
  islandId: 'D',
  giveItemId: 'm',
  giveTier: null,
  giveQty: 100,
  receiveItemId: 't1',
  receiveTier: 'level_1',
  maxTrades: 10,
});

describe('montagem da revisão', () => {
  it('marca as confiáveis e usa restante, teto e o número do ícone', () => {
    const [a, b] = montarRevisao(
      [{ origem: 'p1', trocas: [lida(t6t7, { restante: 3 }), lida(t1t2, { qtdSaida: 2 })] }],
      [],
    );
    expect(a).toMatchObject({ selecionada: true, remainingTrades: 3, plannedTrades: 3 });
    expect(b).toMatchObject({ selecionada: true, recebePorTroca: 2, plannedTrades: 5 });
  });

  it('número do ícone fora da faixa vira o máximo e pede conferência', () => {
    const [a] = montarRevisao([{ origem: 'p1', trocas: [lida(t1t2, { qtdSaida: 7 })] }], []);
    expect(a!.recebePorTroca).toBe(3);
    expect(motivosParaConferir(a!)).toEqual(['quantidade_nao_lida']);
  });

  it('sem restante lido, usa o teto da rota (reserva da Moeda Corvo incluída)', () => {
    const [a] = montarRevisao([{ origem: 'p1', trocas: [lida(moeda, { restante: null })] }], []);
    expect(a).toMatchObject({ remainingTrades: 1, plannedTrades: 1 });
    expect(motivosParaConferir(a!)).toContain('restante_nao_lido');
  });

  it('não marca ambígua, sem restante nem o que já está no plano', () => {
    const noPlano: Trade = {
      id: 'x',
      islandId: 'D',
      inputItemId: 'm',
      inputQtyPerTrade: 100,
      outputItemId: 't1',
      outputQtyPerTrade: 1,
      remainingTrades: 10,
      plannedTrades: 10,
      baseBarterCost: 14286,
      hasStock: false,
    };
    const itens = montarRevisao(
      [
        {
          origem: 'p1',
          trocas: [
            lida(t6t7, { ambigua: true, alternativas: [t1t2] }),
            lida(t1t2, { restante: 0 }),
            lida(mercado),
          ],
        },
      ],
      [noPlano],
    );
    expect(itens.map((i) => i.selecionada)).toEqual([false, false, false]);
    expect(itens[0]).toMatchObject({ rotaConfirmada: false, opcoes: [t6t7, t1t2] });
    expect(itens[2]!.jaNoPlano).toBe(true);
  });

  it('a mesma troca em duas prints aparece uma vez, com a leitura mais confiável', () => {
    const itens = montarRevisao(
      [
        { origem: 'p1', trocas: [lida(t6t7, { confianca: 0.8, restante: 4 })] },
        { origem: 'p2', trocas: [lida(t6t7, { confianca: 0.99, restante: 5 })] },
      ],
      [],
    );
    expect(itens).toHaveLength(1);
    expect(itens[0]).toMatchObject({ origem: 'p2', remainingTrades: 5 });
  });

  it('a leitura nova da mesma troca não desfaz o que o usuário editou', () => {
    const [a] = montarRevisao([{ origem: 'p1', trocas: [lida(t6t7, { confianca: 0.8 })] }], []);
    const editado = editarItem(a!, { plannedTrades: 2 });
    const depois = incluirLeitura([editado], { origem: 'p2', trocas: [lida(t6t7)] }, []);
    expect(depois).toEqual([editado]);

    const semEdicao = incluirLeitura([a!], { origem: 'p2', trocas: [lida(t6t7)] }, []);
    expect(semEdicao[0]!.origem).toBe('p2');
  });

  it('escolher a rota de uma ambígua confirma, recalcula e marca', () => {
    const [a] = montarRevisao(
      [
        {
          origem: 'p1',
          trocas: [lida(t6t7, { ambigua: true, alternativas: [t1t2], qtdSaida: 2 })],
        },
      ],
      [],
    );
    const escolhido = escolherRota(a!, t1t2, []);
    expect(escolhido).toMatchObject({
      rota: t1t2,
      rotaConfirmada: true,
      selecionada: true,
      recebePorTroca: 2,
    });
    expect(motivosParaConferir(escolhido)).toEqual([]);
  });
});

describe('filtro por degrau', () => {
  const itens = montarRevisao(
    [
      {
        origem: 'p1',
        trocas: [
          lida(t6t7),
          lida(mercado),
          lida(moeda, { qtdSaida: 150 }),
          lida(t1t2, { qtdSaida: 2 }),
          lida(rota({ key: 'r67b', islandId: 'E' }), { ambigua: true }),
        ],
      },
    ],
    [],
  );

  it('dá o degrau pela rota: Mercado, Nível N e Moeda Corvo', () => {
    expect(degrauDaTroca(mercado, items).rotulo).toBe('Mercado → Nível 1');
    expect(degrauDaTroca(t6t7, items).rotulo).toBe('Nível 6 → Nível 7');
    expect(degrauDaTroca(moeda, items).rotulo).toBe('→ Moeda Corvo');
  });

  it('lista Todos, os degraus em ordem, Moeda Corvo e Para conferir, com contagens', () => {
    expect(resumoPorDegrau(itens, items)).toEqual([
      { chave: FILTRO_TODOS, rotulo: 'Todos', total: 5, marcadas: 4 },
      { chave: 'level_0>level_1', rotulo: 'Mercado → Nível 1', total: 1, marcadas: 1 },
      { chave: 'level_1>level_2', rotulo: 'Nível 1 → Nível 2', total: 1, marcadas: 1 },
      { chave: 'level_6>level_7', rotulo: 'Nível 6 → Nível 7', total: 2, marcadas: 1 },
      { chave: 'moeda_corvo', rotulo: '→ Moeda Corvo', total: 1, marcadas: 1 },
      { chave: FILTRO_CONFERIR, rotulo: '⚠ Para conferir', total: 1, marcadas: 0 },
    ]);
  });

  it('marca e desmarca só as visíveis, pulando a ambígua', () => {
    const visiveis = new Set(
      itens.filter((i) => passaNoFiltro(i, 'level_6>level_7', items)).map((i) => i.id),
    );
    const desmarcadas = marcarVisiveis(itens, visiveis, false);
    expect(desmarcadas.alteradas).toBe(1);
    expect(desmarcadas.itens.filter((i) => i.selecionada)).toHaveLength(3);

    const marcadas = marcarVisiveis(desmarcadas.itens, visiveis, true);
    expect(marcadas.alteradas).toBe(1);
    expect(marcadas.puladas).toEqual([{ id: itens[4]!.id, motivo: 'ambigua' }]);
  });
});

describe('troca para o plano', () => {
  it('usa a barganha calculada pela rota, nunca a lida da print', () => {
    const [a] = montarRevisao([{ origem: 'p1', trocas: [lida(moeda, { qtdSaida: 150 })] }], []);
    expect(novaTrocaDaRevisao(a!)).toEqual({
      islandId: 'C',
      inputItemId: 't6',
      inputQtyPerTrade: 1,
      outputItemId: CROW_COIN_ID,
      outputQtyPerTrade: 150,
      remainingTrades: 5,
      plannedTrades: 1,
      baseBarterCost: CROW_COIN_BASE_COST,
      hasStock: false,
      routeKey: 'rm',
    });
  });

  it('leva só as marcadas', () => {
    const itens = montarRevisao(
      [{ origem: 'p1', trocas: [lida(t6t7), lida(t1t2, { restante: 0 })] }],
      [],
    );
    expect(trocasSelecionadas(itens).map((t) => t.routeKey)).toEqual(['r67']);
  });
});
