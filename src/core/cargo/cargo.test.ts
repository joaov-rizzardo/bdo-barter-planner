import { describe, expect, it } from 'vitest';
import { ItemIndex } from '../models/itemIndex';
import type { BarterItem, MarketMaterial } from '../models/types';
import {
  adicionar,
  cabeNoNavio,
  itensDaCarga,
  limiteDeSobrepeso,
  limitesDoNavio,
  melhorTransferencia,
  pesoDaCarga,
  remover,
  slotsDaCarga,
} from './cargo';

const item = (
  id: string,
  tier: BarterItem['tier'],
  weightLt: number,
  stacks: boolean,
): BarterItem => ({
  id,
  name: id,
  namePt: id,
  tier,
  weightLt,
  stacks,
  icon: null,
});

const material: MarketMaterial = {
  id: 'm',
  name: 'm',
  namePt: 'm',
  weightLt: 0.3,
  icon: null,
};

const items = new ItemIndex(
  [item('t4', 'level_4', 1000, true), item('t5', 'level_5', 1000, false)],
  [material],
);

describe('peso e slots', () => {
  it('soma o peso por unidade, inclusive dos bens T0', () => {
    const cargo = new Map([
      ['m', 1000],
      ['t4', 2],
    ]);
    expect(pesoDaCarga(cargo, items)).toBeCloseTo(300 + 2000, 6);
  });

  it('item que empilha ocupa um slot por tipo; T5+ ocupa um por unidade', () => {
    expect(slotsDaCarga(new Map([['t4', 10]]), items)).toBe(1);
    expect(slotsDaCarga(new Map([['t5', 10]]), items)).toBe(10);
    expect(
      slotsDaCarga(
        new Map([
          ['m', 500],
          ['t4', 3],
          ['t5', 4],
        ]),
        items,
      ),
    ).toBe(6);
  });

  it('ignora itens com quantidade zero', () => {
    expect(slotsDaCarga(new Map([['t5', 0]]), items)).toBe(0);
  });
});

describe('limites do navio', () => {
  const limites = { maxWeightLt: 5000, slots: 5 };

  it('reprova por peso e por slots', () => {
    expect(cabeNoNavio(new Map([['t4', 5]]), limites, items)).toBe(true);
    expect(cabeNoNavio(new Map([['t4', 6]]), limites, items)).toBe(false); // 6.000 LT
    expect(cabeNoNavio(new Map([['t5', 6]]), limites, items)).toBe(false); // 6 slots
  });
});

describe('movimentação da carga', () => {
  it('adiciona e remove quantidades', () => {
    const cargo = adicionar(new Map(), 't4', 3);
    expect(cargo.get('t4')).toBe(3);
    expect(remover(cargo, 't4', 2)?.get('t4')).toBe(1);
    // remove o item do porão quando zera
    expect(remover(cargo, 't4', 3)?.has('t4')).toBe(false);
  });

  it('não remove mais do que existe', () => {
    expect(remover(new Map([['t4', 1]]), 't4', 2)).toBeNull();
  });

  it('lista os itens do porão em ordem estável', () => {
    expect(
      itensDaCarga(
        new Map([
          ['t5', 1],
          ['m', 0],
          ['t4', 2],
        ]),
      ),
    ).toEqual([
      { itemId: 't4', qty: 2 },
      { itemId: 't5', qty: 1 },
    ]);
  });
});

describe('limites do navio', () => {
  const navio = {
    freeWeightLt: 10_000,
    freeSlots: 20,
    totalWeightLt: 20_000,
    sailorsLt: [] as number[],
    allowOverweight: false,
    overweightMode: 'transferencia',
    sellT7: true,
  } as const;

  it('sem sobrepeso, o limite é o espaço livre', () => {
    const limites = limitesDoNavio(navio);
    expect(limites.overweight).toBeUndefined();
    expect(limiteDeSobrepeso(limites)).toBe(10_000);
  });

  it('com sobrepeso, sobra meia capacidade total além do espaço livre (150% do total)', () => {
    const limites = limitesDoNavio({ ...navio, allowOverweight: true });
    // já a bordo: 20.000 - 10.000; teto de 30.000 => 20.000 de carga planejada
    expect(limiteDeSobrepeso(limites)).toBe(20_000);
    expect(limites.overweight?.mode).toBe('transferencia');
  });
});

describe('transferência de 1 slot para o inventário', () => {
  it('leva o pack inteiro quando o item empilha e 1 unidade quando não empilha', () => {
    expect(melhorTransferencia(new Map([['t4', 12]]), items)).toEqual({ itemId: 't4', qty: 12 });
    expect(melhorTransferencia(new Map([['t5', 12]]), items)).toEqual({ itemId: 't5', qty: 1 });
  });

  it('escolhe o pack que tira mais peso', () => {
    const cargo = new Map([
      ['t4', 3],
      ['t5', 2],
      ['m', 100],
    ]);
    expect(melhorTransferencia(cargo, items)).toEqual({ itemId: 't4', qty: 3 });
  });

  it('não leva o que ainda vai ser gasto nas próximas trocas', () => {
    const cargo = new Map([
      ['t4', 3],
      ['t5', 2],
    ]);
    const reservado = new Map([['t4', 3]]);
    expect(melhorTransferencia(cargo, items, reservado)).toEqual({ itemId: 't5', qty: 1 });
    expect(melhorTransferencia(cargo, items, new Map([...reservado, ['t5', 2]]))).toBeNull();
  });

  it('porão vazio não tem o que transferir', () => {
    expect(melhorTransferencia(new Map(), items)).toBeNull();
  });
});
