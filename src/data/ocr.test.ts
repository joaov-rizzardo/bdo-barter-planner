import { describe, expect, it } from 'vitest';
import { casarLinhas } from '../core/ocr/casamento';
import todos from '../core/ocr/fixtures/todos-850.linhas.json';
import { extrairLinhasDePermuta } from '../core/ocr/layout';
import { lerTrocasDaPrint } from '../core/ocr/pipeline';
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

  it('oferece os outros portos com os mesmos itens, primeiro os que aceitam o número lido', () => {
    const [linha] = extrairLinhasDePermuta(todos).slice(2, 3);
    // Ilha de Teste: Bolsa de Sementes de Cerejeira → Mastro de Navio Pirata, ícone 3.
    const [troca] = casarLinhas([{ ...linha!, qtdEntrada: 1, qtdSaida: 3 }], dados);
    const { rota, outrosPortos } = troca!;
    expect(outrosPortos.length).toBeGreaterThan(0);
    for (const r of outrosPortos) {
      expect([r.giveItemId, r.receiveItemId]).toEqual([rota.giveItemId, rota.receiveItemId]);
      expect(r.islandId).not.toBe(rota.islandId);
    }
    const aceita = outrosPortos.map((r) => r.receiveQtyMin <= 3 && 3 <= r.receiveQtyMax);
    expect(aceita).toEqual([...aceita].sort((a, b) => Number(b) - Number(a)));
  });

  it('usa a quantidade do ícone quando ela cabe na faixa da rota', () => {
    const [linha] = extrairLinhasDePermuta(todos).slice(4);
    // Arita: Estátua de Gaivota → Item de Resgate Marítimo, faixa 2–3.
    const [comIcone] = casarLinhas([{ ...linha!, qtdEntrada: 1, qtdSaida: 2 }], dados);
    const [semIcone] = casarLinhas([{ ...linha!, qtdEntrada: null, qtdSaida: null }], dados);
    expect(comIcone!.recebePorTroca).toBe(2);
    expect(semIcone!.recebePorTroca).toBe(3);
  });

  it('o pipeline devolve as posições do OCR na escala da print original', async () => {
    // Print vazia do tamanho original; o OCR falso devolve as linhas da fixture
    // na escala da imagem ampliada, como o tesseract faria.
    const imagem = { largura: 850, altura: 585, canais: 4, dados: new Uint8Array(850 * 585 * 4) };
    const lerTexto = async (preparada: { largura: number }) => {
      const escala = preparada.largura / 850;
      return todos.map((l) => ({
        ...l,
        x0: l.x0 * escala,
        y0: l.y0 * escala,
        x1: l.x1 * escala,
        y1: l.y1 * escala,
      }));
    };
    const { texto, trocas } = await lerTrocasDaPrint(imagem, lerTexto, dados, []);
    expect(texto[0]!.x0).toBeCloseTo(todos[0]!.x0, 5);
    expect(trocas.map((t) => ilha(t.rota.islandId))).toContain('Ilha de Lema');
    // Sem modelos de dígito, nenhuma quantidade é lida: vale o máximo da faixa.
    expect(trocas.every((t) => t.linha.qtdSaida === null)).toBe(true);
  });
});
