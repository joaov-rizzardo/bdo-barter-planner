import { describe, expect, it } from 'vitest';
import { ItemIndex } from '../models/itemIndex';
import type { BarterItem, MarketMaterial } from '../models/types';
import { adicionar, cabeNoNavio, itensDaCarga, pesoDaCarga, remover, slotsDaCarga } from './cargo';

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
