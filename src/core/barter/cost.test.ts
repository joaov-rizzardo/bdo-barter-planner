import { describe, expect, it } from 'vitest';
import { MAX_BARTER } from '../data/tierRules';
import type { BarterSettings, Trade } from '../models/types';
import { custoPorTroca, fatorDeCusto, reducaoTotal, resumoBarganha } from './cost';

const semReducoes: BarterSettings = {
  levelReduction: 0,
  economyPackage: false,
  viceCaptain: false,
  viceCaptainPercent: 10,
};

const troca = (id: string, plannedTrades: number, baseBarterCost = 14286): Trade => ({
  id,
  islandId: 'i1',
  inputItemId: 'a',
  inputQtyPerTrade: 1,
  outputItemId: 'b',
  outputQtyPerTrade: 1,
  remainingTrades: 10,
  plannedTrades,
  baseBarterCost,
  hasStock: true,
});

describe('custo de barganha', () => {
  it('sem reduções cobra o custo base', () => {
    expect(custoPorTroca(14286, semReducoes)).toBe(14286);
    expect(reducaoTotal(semReducoes)).toBe(0);
  });

  it('soma as três reduções: 20% + 10% + 10% = 40%', () => {
    const s: BarterSettings = {
      levelReduction: 0.2,
      economyPackage: true,
      viceCaptain: true,
      viceCaptainPercent: 10,
    };
    expect(fatorDeCusto(s)).toBeCloseTo(0.6, 10);
    expect(reducaoTotal(s)).toBeCloseTo(0.4, 10);
    // sempre arredonda para baixo: floor(8571,6)
    expect(custoPorTroca(14286, s)).toBe(8571);
  });

  it('ignora o vice-capitão quando a habilidade está desligada', () => {
    const s: BarterSettings = { ...semReducoes, viceCaptain: false, viceCaptainPercent: 50 };
    expect(reducaoTotal(s)).toBe(0);
  });

  it('nunca gera custo negativo quando as reduções passam de 100%', () => {
    const s: BarterSettings = {
      levelReduction: 0.95,
      economyPackage: true,
      viceCaptain: true,
      viceCaptainPercent: 30,
    };
    expect(fatorDeCusto(s)).toBe(0);
    expect(custoPorTroca(14286, s)).toBe(0);
  });
});

describe('resumo do plano', () => {
  it('usa sempre o máximo de barganha do jogo', () => {
    const resumo = resumoBarganha([troca('t1', 10)], semReducoes);
    expect(resumo.disponivel).toBe(MAX_BARTER);
    expect(resumo.total).toBe(142_860);
    expect(resumo.restante).toBe(MAX_BARTER - 142_860);
    expect(resumo.excedente).toBe(0);
    expect(resumo.vouchersNecessarios).toBe(0);
    expect(resumo.indicePassoQueEstoura).toBeNull();
  });

  it('diz onde a barganha acaba e quantos refreshes faltam', () => {
    // 80 trocas de 14.286 = 1.142.880, ou seja 142.880 além do disponível
    const trades = [troca('t1', 40), troca('t2', 40)];
    const resumo = resumoBarganha(trades, semReducoes);

    expect(resumo.total).toBe(14286 * 80);
    expect(resumo.excedente).toBe(14286 * 80 - MAX_BARTER);
    expect(resumo.vouchersNecessarios).toBe(1);
    expect(resumo.indicePassoQueEstoura).toBe(1);
    // no segundo passo sobram 428.560, que cobrem 29 das 40 trocas
    expect(resumo.passos[1]?.trocasCobertas).toBe(29);
  });
});
