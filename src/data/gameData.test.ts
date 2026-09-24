import { describe, expect, it } from 'vitest';
import { resolveChain } from '../core/chain/resolveChain';
import type { Trade } from '../core/models/types';
import { montarCadeiaManual } from './cadeiaManual';
import { loadGameData } from './index';

const { data, items, routes } = loadGameData();

const cadeiaManual = (itemId: string, qtd: number) =>
  montarCadeiaManual(itemId, qtd, items, routes);

describe('dados reais do jogo', () => {
  it('passam pela validação e integridade referencial', () => {
    expect(data.islands.length).toBe(96);
    expect(data.barterItems.length).toBe(123);
    expect(data.marketMaterials.length).toBe(91);
    expect(data.routes.length).toBeGreaterThan(4000);
  });

  it('todo item de permuta T1–T7 tem alguma rota que o produz', () => {
    const semOrigem = data.barterItems.filter((i) => !routes.temOrigem(i.id));
    expect(semOrigem.map((i) => i.namePt)).toEqual([]);
  });

  it('as rotas de subida de tier trazem barganha e teto de trocas plausíveis', () => {
    const tier = data.routes.filter((r) => r.kind === 'tier' && r.source === 'normal');
    expect(tier.every((r) => r.parleyRequired >= 14286)).toBe(true);
    expect(tier.every((r) => r.maxTrades >= 1 && r.maxTrades <= 10)).toBe(true);
  });
});

describe('cadeia real: T7 sem estoque', () => {
  const t7 = data.barterItems.find((i) => i.tier === 'level_7')!;
  const rotaT7 = routes.produzindoTier(t7.id)[0]!;

  const troca: Trade = {
    id: 'alvo',
    islandId: rotaT7.islandId,
    inputItemId: rotaT7.giveItemId,
    inputQtyPerTrade: rotaT7.giveQty,
    outputItemId: t7.id,
    outputQtyPerTrade: rotaT7.receiveQtyMin,
    remainingTrades: 5,
    plannedTrades: 2,
    baseBarterCost: 14286,
    hasStock: false,
  };

  it('aponta a falta do T6 com os portos que fazem a troca, sem criar nada', () => {
    const r = resolveChain([troca], items, routes);

    expect(r.trades).toHaveLength(1);
    expect(r.faltas).toHaveLength(1);
    const falta = r.faltas[0]!;
    expect(falta).toMatchObject({ itemId: rotaT7.giveItemId, qty: rotaT7.giveQty * 2 });
    // com os dados reais a cadeia desce até o mercado, então a troca é possível
    expect(falta.possivel).toBe(true);
    expect(falta.opcoes.length).toBeGreaterThan(0);
    expect(r.diagnostics.find((d) => d.level === 'erro')?.code).toBe('cadeia_incompleta');
  });

  it('com estoque do T6 a cadeia fecha sem erro', () => {
    const r = resolveChain([{ ...troca, hasStock: true }], items, routes);

    expect(r.faltas).toEqual([]);
    expect(r.shoppingList).toEqual([]);
    expect(r.fromStock).toEqual([
      { itemId: rotaT7.giveItemId, qty: rotaT7.giveQty * troca.plannedTrades },
    ]);
  });

  it('informando a cadeia inteira, só resta a compra no mercado', () => {
    const r = resolveChain(cadeiaManual(t7.id, 2), items, routes);

    expect(r.faltas).toEqual([]);
    expect(r.diagnostics.filter((d) => d.level === 'erro')).toEqual([]);
    expect(r.shoppingList.length).toBeGreaterThan(0);
    expect(items.isMarketMaterial(r.trades[0]!.inputItemId)).toBe(true);
  });
});
