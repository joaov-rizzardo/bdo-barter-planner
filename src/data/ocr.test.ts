import { describe, expect, it } from 'vitest';
import { casarLinhas } from '../core/ocr/casamento';
import todos from '../core/ocr/fixtures/todos-850.linhas.json';
import { extrairLinhasDePermuta } from '../core/ocr/layout';
import { loadGameData } from './index';

describe('leitura de print casada com as rotas reais', () => {
  const { data, items } = loadGameData();
  const dados = { islands: data.islands, routes: data.routes, items };
  const ilha = (id: string) => data.islands.find((i) => i.id === id)?.namePt;

  it('acha porto e itens mesmo com nomes cortados', () => {
    const linhas = extrairLinhasDePermuta(todos).map((l) => ({
      ...l,
      qtdEntrada: null,
      qtdSaida: null,
    }));
    const trocas = casarLinhas(linhas, dados);

    expect(trocas.map((t) => ilha(t.rota.islandId))).toEqual([
      'Litoral de Olvia',
      'Arehaza',
      'Ilha de Teste',
      'Ilha de Lema',
      'Ilha de Arita',
      'Ilha de Iliya',
    ]);
    expect(items.nameOf(trocas[2]!.rota.giveItemId)).toBe(
      '[Nível 1] Bolsa de Sementes de Cerejeira',
    );
    expect(trocas.every((t) => t.confianca > 0.9 && !t.ambigua)).toBe(true);
  });

  it('usa a quantidade do ícone quando ela cabe na faixa da rota', () => {
    const [linha] = extrairLinhasDePermuta(todos).slice(4);
    // Arita: Estátua de Gaivota → Item de Resgate Marítimo, faixa 2–3.
    const [comIcone] = casarLinhas([{ ...linha!, qtdEntrada: 1, qtdSaida: 2 }], dados);
    const [semIcone] = casarLinhas([{ ...linha!, qtdEntrada: null, qtdSaida: null }], dados);
    expect(comIcone!.recebePorTroca).toBe(2);
    expect(semIcone!.recebePorTroca).toBe(3);
  });
});
