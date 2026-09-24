import { describe, expect, it } from 'vitest';
import { CROW_COIN_BASE_COST, CROW_COIN_ID, CROW_COIN_MAX_TRADES } from '../data/tierRules';
import type { BarterRoute } from '../models/types';
import { custoBaseEfetivo, maxTrocasEfetivo } from './routeIndex';

const rotaDeMoeda = (p: Partial<BarterRoute> = {}): BarterRoute => ({
  key: 'r',
  islandId: '386',
  source: 'sub_group',
  giveItemId: '800046',
  giveTier: 'level_4',
  giveQty: 1,
  receiveItemId: CROW_COIN_ID,
  receiveTier: null,
  receiveQtyMin: 40,
  receiveQtyMax: 60,
  parleyRequired: 32,
  maxTrades: 0,
  kind: 'crow_coin',
  ...p,
});

describe('rotas de Moeda Corvo', () => {
  it('rota de sub-grupo sem teto nem barganha usa os valores de reserva da moeda', () => {
    expect(maxTrocasEfetivo(rotaDeMoeda())).toBe(CROW_COIN_MAX_TRADES);
    expect(custoBaseEfetivo(rotaDeMoeda())).toBe(CROW_COIN_BASE_COST);
  });

  it('rota com dados plausíveis fica com os valores dela', () => {
    const rota = rotaDeMoeda({ source: 'normal', maxTrades: 2, parleyRequired: 29430 });
    expect(maxTrocasEfetivo(rota)).toBe(2);
    expect(custoBaseEfetivo(rota)).toBe(29430);
  });
});
