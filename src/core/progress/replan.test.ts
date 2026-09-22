import { describe, expect, it } from 'vitest';
import type { Trade } from '../models/types';
import { idOriginalDaTroca, registrarProgresso, replanejar } from './replan';

const troca = (p: Partial<Trade> & { id: string }): Trade => ({
  islandId: 'A',
  inputItemId: 'm',
  inputQtyPerTrade: 100,
  outputItemId: 'i1',
  outputQtyPerTrade: 1,
  remainingTrades: 10,
  plannedTrades: 10,
  baseBarterCost: 14286,
  hasStock: false,
  ...p,
});

/** m → i1 (10 trocas) → i2 (10 trocas). */
const cadeia: Trade[] = [
  troca({ id: 'a' }),
  troca({ id: 'b', inputItemId: 'i1', inputQtyPerTrade: 1, outputItemId: 'i2' }),
];

describe('replanejamento pelo progresso', () => {
  it('sem progresso devolve o plano inteiro', () => {
    const r = replanejar(cadeia, {});
    expect(r.trades).toEqual(cadeia);
    expect(r.concluidas).toEqual([]);
    expect(r.inventario.size).toBe(0);
  });

  it('remove as trocas concluídas', () => {
    const r = replanejar(cadeia, { a: 10 });
    expect(r.concluidas).toEqual(['a']);
    expect(r.trades.map((t) => t.id)).toEqual(['b#estoque']);
    // os 10 i1 produzidos cobrem as 10 trocas seguintes
    expect(r.trades[0]).toMatchObject({ plannedTrades: 10, hasStock: true });
  });

  it('troca parcial continua com o restante', () => {
    const r = replanejar(cadeia, { a: 4 });
    const restanteA = r.trades.find((t) => t.id === 'a');
    expect(restanteA?.plannedTrades).toBe(6);
    expect(r.concluidas).toEqual([]);
  });

  it('divide a troca seguinte entre o que o estoque cobre e o que falta', () => {
    // 7 de 10 feitas em "a" -> 7 i1 em mãos; "b" precisa de 10
    const r = replanejar(cadeia, { a: 7, b: 0 });
    const ids = r.trades.map((t) => t.id);
    expect(ids).toEqual(['a', 'b#estoque', 'b']);

    const [restoA, comEstoque, semEstoque] = r.trades;
    expect(restoA?.plannedTrades).toBe(3);
    expect(comEstoque).toMatchObject({ plannedTrades: 7, hasStock: true });
    expect(semEstoque).toMatchObject({ plannedTrades: 3, hasStock: false });
  });

  it('desconta o que a troca parcial seguinte já consumiu', () => {
    // 10 "a" feitas (10 i1) e 7 "b" feitas (consumiram 7 i1) -> sobram 3
    const r = replanejar(cadeia, { a: 10, b: 7 });
    expect(r.trades.map((t) => t.id)).toEqual(['b#estoque']);
    expect(r.trades[0]?.plannedTrades).toBe(3);
    expect(r.inventario.get('i1')).toBe(0);
    expect(r.inventario.get('i2')).toBe(7);
  });

  it('limita progresso inválido (negativo, acima do planejado, não numérico)', () => {
    expect(replanejar([troca({ id: 'a' })], { a: -5 }).trades[0]?.plannedTrades).toBe(10);
    expect(replanejar([troca({ id: 'a' })], { a: 99 }).concluidas).toEqual(['a']);
    expect(replanejar([troca({ id: 'a' })], { a: Number.NaN }).trades[0]?.plannedTrades).toBe(10);
  });

  it('troca com estoque declarado não consome inventário', () => {
    const comEstoque = [troca({ id: 'x', hasStock: true, plannedTrades: 4 })];
    const r = replanejar(comEstoque, { x: 1 });
    expect(r.trades[0]).toMatchObject({ plannedTrades: 3, hasStock: true });
    expect(r.inventario.get('m')).toBeUndefined();
    expect(r.inventario.get('i1')).toBe(1);
  });
});

describe('registro do progresso', () => {
  it('recupera o id original de uma troca dividida', () => {
    expect(idOriginalDaTroca('b#estoque')).toBe('b');
    expect(idOriginalDaTroca('b')).toBe('b');
  });

  it('soma a quantidade do passo no id original', () => {
    const p1 = registrarProgresso({}, 'b#estoque', 7, true);
    expect(p1).toEqual({ b: 7 });

    // marcar a outra metade da mesma troca soma no mesmo id
    const p2 = registrarProgresso(p1, 'b', 3, true);
    expect(p2).toEqual({ b: 10 });
  });

  it('desmarcar subtrai e nunca fica negativo', () => {
    expect(registrarProgresso({ b: 10 }, 'b', 3, false)).toEqual({ b: 7 });
    expect(registrarProgresso({ b: 3 }, 'b#estoque', 10, false)).toEqual({});
  });

  it('ignora quantidade inválida', () => {
    expect(registrarProgresso({}, 'b', Number.NaN, true)).toEqual({});
    expect(registrarProgresso({ b: 2 }, 'b', -5, true)).toEqual({ b: 2 });
  });
});
