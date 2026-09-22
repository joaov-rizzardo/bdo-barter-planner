import { describe, expect, it } from 'vitest';
import type { Trade } from '../models/types';
import { itemBalance, sobras, balanco } from './itemBalance';

const troca = (p: Partial<Trade>): Trade => ({
  id: 't',
  islandId: 'i1',
  inputItemId: 'a',
  inputQtyPerTrade: 1,
  outputItemId: 'b',
  outputQtyPerTrade: 1,
  remainingTrades: 10,
  plannedTrades: 1,
  baseBarterCost: 14286,
  hasStock: false,
  ...p,
});

describe('balanço de itens', () => {
  it('conta demanda e produção por troca planejada', () => {
    const b = balanco([
      troca({ inputItemId: 'x', inputQtyPerTrade: 100, outputItemId: 'y', plannedTrades: 3 }),
    ]);
    expect(b.need.get('x')).toBe(300);
    expect(b.supply.get('y')).toBe(3);
  });

  it('troca com estoque não gera demanda, mas continua produzindo', () => {
    const b = balanco([troca({ hasStock: true, inputQtyPerTrade: 5, plannedTrades: 2 })]);
    expect(b.need.has('a')).toBe(false);
    expect(b.supply.get('b')).toBe(2);
  });

  it('calcula déficit, sobra e estoque esperado por item', () => {
    const linhas = itemBalance([
      // produz 10 de "b" a partir de estoque de "a"
      troca({
        id: '1',
        hasStock: true,
        inputQtyPerTrade: 1,
        outputQtyPerTrade: 2,
        plannedTrades: 5,
      }),
      // consome 4 de "b" e produz 4 de "c"
      troca({ id: '2', inputItemId: 'b', outputItemId: 'c', plannedTrades: 4 }),
      // consome 2 de "d", que ninguém produz
      troca({ id: '3', inputItemId: 'd', outputItemId: 'e', plannedTrades: 2 }),
    ]);
    const porItem = Object.fromEntries(linhas.map((l) => [l.itemId, l]));

    expect(porItem.a).toMatchObject({ needed: 0, fromStock: 5 });
    expect(porItem.b).toMatchObject({ needed: 4, produced: 10, deficit: 0, leftover: 6 });
    expect(porItem.d).toMatchObject({ needed: 2, produced: 0, deficit: 2, leftover: 0 });
    expect(porItem.e).toMatchObject({ produced: 2, leftover: 2 });
  });

  it('sobras ignora itens equilibrados', () => {
    const b = balanco([
      troca({ id: '1', outputItemId: 'x', plannedTrades: 3 }),
      troca({ id: '2', inputItemId: 'x', outputItemId: 'z', plannedTrades: 3 }),
    ]);
    expect([...sobras(b).keys()]).toEqual(['z']);
  });
});
