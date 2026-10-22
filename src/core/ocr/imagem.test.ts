import { describe, expect, it } from 'vitest';
import {
  canalMaximoInvertido,
  esticarContraste,
  prepararParaOcr,
  recortar,
  redimensionar,
  type ImagemCrua,
} from './imagem';

/** Imagem RGBA 3x2 com cores conhecidas, como sai de um `ImageData`. */
const rgba: ImagemCrua = {
  largura: 3,
  altura: 2,
  canais: 4,
  // prettier-ignore
  dados: [
    255, 0, 0, 255,   0, 0, 0, 255,   10, 20, 30, 255,
    0, 0, 200, 255,   255, 255, 255, 255,   0, 100, 0, 255,
  ],
};

describe('imagem para o OCR', () => {
  it('canal máximo invertido ignora o alfa e deixa o texto colorido escuro', () => {
    expect(Array.from(canalMaximoInvertido(rgba).dados)).toEqual([0, 255, 225, 55, 0, 155]);
  });

  it('recorta respeitando a borda da imagem', () => {
    const r = recortar(rgba, { x: 1, y: 1, largura: 5, altura: 5 });
    expect(r).toMatchObject({ largura: 2, altura: 1, canais: 4 });
    expect(Array.from(r!.dados)).toEqual([255, 255, 255, 255, 0, 100, 0, 255]);
    expect(recortar(rgba, { x: 9, y: 0, largura: 2, altura: 2 })).toBeNull();
  });

  it('redimensiona mantendo cor uniforme e o número de canais', () => {
    const cinza: ImagemCrua = { largura: 2, altura: 2, canais: 1, dados: [80, 80, 80, 80] };
    const grande = redimensionar(cinza, 6, 4);
    expect(grande).toMatchObject({ largura: 6, altura: 4, canais: 1 });
    expect(new Set(Array.from(grande.dados))).toEqual(new Set([80]));
  });

  it('estica o contraste até preto e branco', () => {
    const img: ImagemCrua = { largura: 4, altura: 1, canais: 1, dados: [100, 120, 140, 160] };
    expect(Array.from(esticarContraste(img).dados)).toEqual([0, 85, 170, 255]);
  });

  it('amplia até a largura alvo e devolve a escala para voltar à print', () => {
    const img: ImagemCrua = { largura: 100, altura: 50, canais: 3, dados: new Uint8Array(15000) };
    const { imagem, escala } = prepararParaOcr(img, 300);
    expect(imagem).toMatchObject({ largura: 300, altura: 150, canais: 1 });
    expect(escala).toBe(3);
  });
});
