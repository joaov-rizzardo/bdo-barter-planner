import type { Caixa } from './layout';

/**
 * Imagem crua, linha a linha: 1 canal (cinza), 3 (RGB, como sai do sharp) ou
 * 4 (RGBA, como o `ImageData` do canvas).
 */
export interface ImagemCrua {
  largura: number;
  altura: number;
  canais: number;
  dados: ArrayLike<number>;
}

/** Largura alvo da imagem ampliada para o OCR do texto: o tesseract erra menos com letra grande. */
export const LARGURA_OCR = 2400;
/** Ampliação máxima: print muito pequena não ganha nada passando disso. */
const ESCALA_MAXIMA = 4;

/**
 * Texto do jogo é claro (branco, laranja, verde, azul) sobre fundo escuro: o
 * maior canal de cor separa bem o texto colorido; invertido vira texto escuro
 * sobre fundo claro, que é o que o tesseract espera. Sai com 1 canal.
 */
export function canalMaximoInvertido(img: ImagemCrua): ImagemCrua {
  const { largura, altura, canais, dados } = img;
  const cinza = new Uint8Array(largura * altura);
  const cores = Math.min(canais, 3);
  for (let i = 0; i < cinza.length; i += 1) {
    let maior = 0;
    for (let c = 0; c < cores; c += 1) maior = Math.max(maior, dados[i * canais + c]!);
    cinza[i] = 255 - maior;
  }
  return { largura, altura, canais: 1, dados: cinza };
}

/** Redimensiona com interpolação bilinear (qualquer número de canais). */
export function redimensionar(img: ImagemCrua, largura: number, altura: number): ImagemCrua {
  const { canais, dados } = img;
  const saida = new Uint8Array(largura * altura * canais);
  const fx = img.largura / largura;
  const fy = img.altura / altura;
  for (let y = 0; y < altura; y += 1) {
    const sy = Math.min(Math.max((y + 0.5) * fy - 0.5, 0), img.altura - 1);
    const y0 = Math.floor(sy);
    const y1 = Math.min(y0 + 1, img.altura - 1);
    const dy = sy - y0;
    for (let x = 0; x < largura; x += 1) {
      const sx = Math.min(Math.max((x + 0.5) * fx - 0.5, 0), img.largura - 1);
      const x0 = Math.floor(sx);
      const x1 = Math.min(x0 + 1, img.largura - 1);
      const dx = sx - x0;
      for (let c = 0; c < canais; c += 1) {
        const p = (yy: number, xx: number) => dados[(yy * img.largura + xx) * canais + c]!;
        const cima = p(y0, x0) * (1 - dx) + p(y0, x1) * dx;
        const baixo = p(y1, x0) * (1 - dx) + p(y1, x1) * dx;
        saida[(y * largura + x) * canais + c] = Math.round(cima * (1 - dy) + baixo * dy);
      }
    }
  }
  return { largura, altura, canais, dados: saida };
}

/** Fração dos pixels mais escuros e mais claros ignorada ao esticar o contraste. */
const CORTE_CONTRASTE = 0.01;

/**
 * Estica o contraste de uma imagem cinza: o 1% mais escuro vira preto e o 1%
 * mais claro vira branco. Realça o texto vermelho, que fica apagado depois
 * da inversão.
 */
export function esticarContraste(img: ImagemCrua): ImagemCrua {
  const total = img.dados.length;
  const histograma = new Array<number>(256).fill(0);
  for (let i = 0; i < total; i += 1) histograma[img.dados[i]!]! += 1;
  const limite = total * CORTE_CONTRASTE;
  let minimo = 0;
  for (let v = 0, soma = 0; v < 256; v += 1) {
    soma += histograma[v]!;
    if (soma >= limite) {
      minimo = v;
      break;
    }
  }
  let maximo = 255;
  for (let v = 255, soma = 0; v >= 0; v -= 1) {
    soma += histograma[v]!;
    if (soma >= limite) {
      maximo = v;
      break;
    }
  }
  const faixa = Math.max(1, maximo - minimo);
  const dados = new Uint8Array(total);
  for (let i = 0; i < total; i += 1) {
    dados[i] = Math.min(255, Math.max(0, Math.round(((img.dados[i]! - minimo) * 255) / faixa)));
  }
  return { ...img, dados };
}

/**
 * Imagem pronta para o OCR do texto: canal máximo invertido, ampliada até
 * `larguraAlvo` e com o contraste esticado. `escala` converte as posições
 * lidas de volta para a print.
 *
 * Medido com `npm run ocr:avaliar`: bilinear + contraste empata com o lanczos
 * do sharp; o bicúbico, apesar de mais nítido, faz o tesseract perder o texto
 * vermelho de baixo contraste.
 */
export function prepararParaOcr(
  img: ImagemCrua,
  larguraAlvo = LARGURA_OCR,
): { imagem: ImagemCrua; escala: number } {
  const escala = Math.min(ESCALA_MAXIMA, Math.max(1, larguraAlvo / img.largura));
  const cinza = canalMaximoInvertido(img);
  if (escala === 1) return { imagem: esticarContraste(cinza), escala };
  const largura = Math.round(img.largura * escala);
  const altura = Math.round(img.altura * escala);
  const ampliada = esticarContraste(redimensionar(cinza, largura, altura));
  return { imagem: ampliada, escala: largura / img.largura };
}

/** Recorte da imagem; `null` quando a caixa cai inteira fora dela. */
export function recortar(img: ImagemCrua, caixa: Caixa): ImagemCrua | null {
  const x0 = Math.max(0, Math.round(caixa.x));
  const y0 = Math.max(0, Math.round(caixa.y));
  const largura = Math.min(Math.round(caixa.largura), img.largura - x0);
  const altura = Math.min(Math.round(caixa.altura), img.altura - y0);
  if (largura <= 0 || altura <= 0) return null;
  const { canais, dados } = img;
  const saida = new Uint8Array(largura * altura * canais);
  for (let y = 0; y < altura; y += 1) {
    for (let x = 0; x < largura; x += 1) {
      for (let c = 0; c < canais; c += 1) {
        saida[(y * largura + x) * canais + c] =
          dados[((y0 + y) * img.largura + x0 + x) * canais + c]!;
      }
    }
  }
  return { largura, altura, canais, dados: saida };
}
