import { describe, expect, it } from 'vitest';
import todos from './fixtures/todos-850.linhas.json';
import t5t6 from './fixtures/t5-t6-695.linhas.json';
import { extrairLinhasDePermuta } from './layout';
import { normalizarNome, numeroDepoisDe, semelhanca, tierDaEtiqueta } from './texto';

describe('texto lido pelo OCR', () => {
  it('normaliza sem acento, sem a etiqueta de tier e sem o lixo antes dela', () => {
    expect(normalizarNome('[Nível 5] Bebida de 37 anos')).toBe('bebida de 37 anos');
    expect(normalizarNome('nn [Nível 2] Item de Resgate')).toBe('item de resgate');
    expect(normalizarNome('INível 11 Espinha de Peixe')).toBe('espinha de peixe');
    expect(normalizarNome('Sangue de Palhaço')).toBe('sangue de palhaco');
    expect(normalizarNome('[NivelS] Larva Branca')).toBe('larva branca');
  });

  it('lê o tier da etiqueta nos dois formatos do jogo', () => {
    expect(tierDaEtiqueta('[Nível 2] Mastro')).toBe('level_2');
    expect(tierDaEtiqueta('[Nv. 7] Colar')).toBe('level_7');
    expect(tierDaEtiqueta('Barra de Estanho')).toBeNull();
  });

  it('lê números depois do rótulo, trocando O por 0', () => {
    expect(numeroDepoisDe('Restante: 10', /restante/)).toBe(10);
    expect(numeroDepoisDe('Restante: O', /restante/)).toBe(0);
    expect(numeroDepoisDe('Barganha: 10,743', /barganha/)).toBe(10743);
  });

  it('casa nome cortado com reticências pelo começo do nome completo', () => {
    const cortado = normalizarNome('[Nível 4] Manual de Trein');
    const certo = normalizarNome('[Nível 4] Manual de Treinamento do Barqueiro');
    const outro = normalizarNome('[Nível 4] Remédio de Mil Doenças');
    expect(semelhanca(cortado, certo)).toBeGreaterThan(0.9);
    expect(semelhanca(cortado, outro)).toBeLessThan(0.5);
  });
});

describe('layout da janela de permuta', () => {
  it('monta uma linha por troca, com ilha, itens e restante', () => {
    const linhas = extrairLinhasDePermuta(todos);
    expect(linhas).toHaveLength(6);
    expect(linhas[0]).toMatchObject({ ilhaTexto: 'Litoral de Olvia', restante: 5 });
    expect(linhas[2]!.saidaTexto).toContain('Mastro de Navio Pirata');
    expect(linhas.map((l) => l.restante)).toEqual([5, 5, 10, 5, 10, 5]);
  });

  it('não perde a linha quando "Barganha:" sai ilegível', () => {
    // Nesta print o OCR lê "parganna!" e "ra e) :" em duas linhas.
    const linhas = extrairLinhasDePermuta(t5t6);
    expect(linhas.map((l) => l.ilhaTexto)).toEqual([
      'Arehaza',
      'Grandiha',
      'Ilha de Hakoven',
      'Porto da Noite Pro',
      'Doca DalLe',
      '[Ilha Hee-Mo',
    ]);
    expect(linhas.map((l) => l.restante)).toEqual([5, 0, 5, 0, 5, 5]);
  });

  it('a altura do dígito acompanha a escala da janela', () => {
    const [grande] = extrairLinhasDePermuta(todos);
    const [pequena] = extrairLinhasDePermuta(t5t6);
    expect(grande!.alturaDigito).toBeGreaterThan(pequena!.alturaDigito);
  });
});
