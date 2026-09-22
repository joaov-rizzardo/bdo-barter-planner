import { beforeEach, describe, expect, it } from 'vitest';
import { sampleGameData } from '../data/sampleData';
import { ItemIndex } from '../models/itemIndex';
import type { Trade } from '../models/types';
import { resolveChain } from './resolveChain';
import { RouteIndex } from './routeIndex';

const itemIndex = ItemIndex.fromGameData(sampleGameData);
let routeIndex: RouteIndex;

beforeEach(() => {
  routeIndex = new RouteIndex(sampleGameData.routes);
});

/** Troca T1 → T2 (2 por troca) na ilha i2. */
function trocaT1T2(overrides: Partial<Trade> = {}): Trade {
  return {
    id: 't1',
    islandId: 'i2',
    inputItemId: '800001',
    inputQtyPerTrade: 1,
    outputItemId: '800015',
    outputQtyPerTrade: 2,
    remainingTrades: 10,
    plannedTrades: 5,
    baseBarterCost: 14286,
    hasStock: false,
    ...overrides,
  };
}

describe('nada é adicionado automaticamente', () => {
  it('o plano devolvido tem exatamente as trocas informadas', () => {
    const r = resolveChain([trocaT1T2()], itemIndex, routeIndex);
    expect(r.trades).toHaveLength(1);
    expect(r.trades[0]?.id).toBe('t1');
  });

  it('com estoque não cobra troca precedente nem compra', () => {
    const r = resolveChain([trocaT1T2({ hasStock: true })], itemIndex, routeIndex);

    expect(r.faltas).toEqual([]);
    expect(r.shoppingList).toEqual([]);
    expect(r.fromStock).toEqual([{ itemId: '800001', qty: 5 }]);
    expect(r.diagnostics.filter((d) => d.level === 'erro')).toEqual([]);
  });
});

describe('entrada sem origem', () => {
  it('aponta a falta e lista as trocas precedentes possíveis', () => {
    const r = resolveChain([trocaT1T2()], itemIndex, routeIndex);

    expect(r.faltas).toHaveLength(1);
    const falta = r.faltas[0]!;
    expect(falta).toMatchObject({ itemId: '800001', qty: 5, possivel: true });
    // duas rotas produzem o T1 na fixture (ferro e ouro); a mais leve vem primeiro
    expect(falta.opcoes.map((o) => o.routeKey)).toEqual(['r-t0-t1', 'r-t0-t1-ouro']);
    expect(falta.opcoes[0]).toMatchObject({
      islandId: 'i1',
      giveItemId: '4052',
      giveQty: 100,
      receiveQty: 1,
      receiveQtyMax: 1,
      maxTrades: 10,
      baseBarterCost: 14286,
    });

    const erro = r.diagnostics.find((d) => d.level === 'erro')!;
    expect(erro.code).toBe('cadeia_incompleta');
    expect(erro.message).toContain('Faltam 5×');
    expect(erro.message).toContain('2 porto(s)');
  });

  it('prefere as ilhas já usadas no plano ao sugerir', () => {
    const r = resolveChain([trocaT1T2()], itemIndex, routeIndex, { preferIslandIds: ['i1'] });
    expect(r.faltas[0]?.opcoes[0]?.islandId).toBe('i1');
  });

  it('limita a quantidade de sugestões', () => {
    const r = resolveChain([trocaT1T2()], itemIndex, routeIndex, { maxOpcoes: 1 });
    expect(r.faltas[0]?.opcoes).toHaveLength(1);
  });

  it('notifica quando nenhuma troca produz o item', () => {
    const t5: Trade = {
      id: 't5',
      islandId: 'i3',
      inputItemId: '800057', // T5 sem nenhuma rota que o produza
      inputQtyPerTrade: 1,
      outputItemId: '800015',
      outputQtyPerTrade: 1,
      remainingTrades: 6,
      plannedTrades: 3,
      baseBarterCost: 14286,
      hasStock: false,
    };
    const r = resolveChain([t5], itemIndex, routeIndex);

    expect(r.faltas[0]).toMatchObject({ itemId: '800057', qty: 3, possivel: false, opcoes: [] });
    const erro = r.diagnostics.find((d) => d.level === 'erro')!;
    expect(erro.code).toBe('sem_origem');
    expect(erro.message).toContain('nenhum ponto da cadeia');
  });

  it('considera toda a cadeia: rota existe, mas o insumo dela não tem origem', () => {
    // O T6 da fixture só sai de um T5 que ninguém produz e que não é bem de mercado.
    const t6: Trade = {
      id: 't6',
      islandId: 'i3',
      inputItemId: '800201',
      inputQtyPerTrade: 1,
      outputItemId: '800015',
      outputQtyPerTrade: 1,
      remainingTrades: 5,
      plannedTrades: 1,
      baseBarterCost: 14286,
      hasStock: false,
    };
    const r = resolveChain([t6], itemIndex, routeIndex);

    const falta = r.faltas[0]!;
    expect(falta.possivel).toBe(false);
    expect(falta.opcoes).toHaveLength(1); // existe a rota T5→T6
    expect(r.diagnostics.find((d) => d.level === 'erro')?.code).toBe('sem_origem');
  });

  it('o mesmo item com estoque marcado não gera falta', () => {
    const r = resolveChain(
      [
        {
          id: 't5',
          islandId: 'i3',
          inputItemId: '800057',
          inputQtyPerTrade: 1,
          outputItemId: '800015',
          outputQtyPerTrade: 1,
          remainingTrades: 6,
          plannedTrades: 3,
          baseBarterCost: 14286,
          hasStock: true,
        },
      ],
      itemIndex,
      routeIndex,
    );
    expect(r.faltas).toEqual([]);
    expect(r.diagnostics.filter((d) => d.level === 'erro')).toEqual([]);
  });
});

describe('mercado, sobras e ordem', () => {
  it('bem terrestre sem estoque entra na lista de compras, não em faltas', () => {
    const t0: Trade = {
      id: 't0',
      islandId: 'i1',
      inputItemId: '4052',
      inputQtyPerTrade: 100,
      outputItemId: '800001',
      outputQtyPerTrade: 1,
      remainingTrades: 10,
      plannedTrades: 5,
      baseBarterCost: 14286,
      hasStock: false,
    };
    const r = resolveChain([t0], itemIndex, routeIndex);

    expect(r.faltas).toEqual([]);
    expect(r.shoppingList).toEqual([{ itemId: '4052', qty: 500 }]);
    expect(r.diagnostics.filter((d) => d.level === 'erro')).toEqual([]);
  });

  it('cadeia informada por inteiro fecha sem erro', () => {
    const t0: Trade = {
      id: 't0',
      islandId: 'i1',
      inputItemId: '4052',
      inputQtyPerTrade: 100,
      outputItemId: '800001',
      outputQtyPerTrade: 1,
      remainingTrades: 10,
      plannedTrades: 5,
      baseBarterCost: 14286,
      hasStock: false,
    };
    const r = resolveChain([trocaT1T2(), t0], itemIndex, routeIndex);

    expect(r.faltas).toEqual([]);
    expect(r.shoppingList).toEqual([{ itemId: '4052', qty: 500 }]);
    // ordem de execução: produz o T1 antes de consumir
    expect(r.trades.map((t) => t.outputItemId)).toEqual(['800001', '800015']);
  });

  it('avisa sobra de itens e identifica o produto final', () => {
    const produz = trocaT1T2({ id: 'a', plannedTrades: 5, hasStock: true }); // 10 T2
    const consome: Trade = {
      id: 'b',
      islandId: 'i2',
      inputItemId: '800015',
      inputQtyPerTrade: 1,
      outputItemId: '800057',
      outputQtyPerTrade: 1,
      remainingTrades: 10,
      plannedTrades: 4,
      baseBarterCost: 14286,
      hasStock: false,
    };
    const r = resolveChain([produz, consome], itemIndex, routeIndex);

    expect(r.diagnostics.find((d) => d.code === 'sobra_de_itens')).toMatchObject({
      itemId: '800015',
      quantity: 6,
      level: 'aviso',
    });
    expect(r.diagnostics.find((d) => d.code === 'produto_final')?.itemId).toBe('800057');
    expect(r.faltas).toEqual([]);
  });
});

describe('rotas com faixa de quantidade', () => {
  it('a opção de precedente expõe o mínimo e o máximo recebidos', () => {
    // T2 só sai da rota 1:2-3 da fixture (como nos dados reais de T1→T2 e T2→T3)
    const consomeT2: Trade = {
      id: 'x',
      islandId: 'i2',
      inputItemId: '800015',
      inputQtyPerTrade: 1,
      outputItemId: '800057',
      outputQtyPerTrade: 1,
      remainingTrades: 10,
      plannedTrades: 9,
      baseBarterCost: 14286,
      hasStock: false,
    };
    const r = resolveChain([consomeT2], itemIndex, routeIndex);

    const opcao = r.faltas[0]!.opcoes[0]!;
    expect(opcao.routeKey).toBe('r-t1-t2');
    expect(opcao.receiveQty).toBe(2);
    expect(opcao.receiveQtyMax).toBe(3);
  });
});
