import { createWorker, OEM, PSM, type Worker } from 'tesseract.js';
import type { ImagemCrua } from '../../core/ocr/imagem';
import type { ModeloDeDigito } from '../../core/ocr/digitos';
import modelos from '../../core/ocr/modelosDigitos.json';
import {
  lerTrocasDaPrint,
  linhasDosBlocos,
  type LerTexto,
  type ResultadoDaPrint,
} from '../../core/ocr/pipeline';
import { loadGameData } from '../../data';

/**
 * Adaptador do leitor de prints para o navegador (e o WebView do Tauri):
 * abre a imagem pelo canvas e roda o tesseract.js com os arquivos servidos
 * de `public/tesseract/` (gerados por `scripts/preparar-tesseract.mjs`), sem
 * depender de internet. O resto é o pipeline de `src/core/ocr/`.
 */

/** URL absoluta de um arquivo em `public/tesseract/`. */
const arquivoDoTesseract = (caminho: string) =>
  new URL(`${import.meta.env.BASE_URL}tesseract/${caminho}`, window.location.href).href;

/** Print (arquivo escolhido ou colada) em RGBA cru. */
export async function imagemDoArquivo(arquivo: Blob): Promise<ImagemCrua> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(arquivo);
  } catch {
    throw new Error('Não foi possível abrir esta imagem. Use uma print em PNG ou JPG.');
  }
  try {
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const contexto = canvas.getContext('2d', { willReadFrequently: true });
    if (!contexto) throw new Error('Canvas 2D indisponível neste navegador.');
    contexto.drawImage(bitmap, 0, 0);
    const { data } = contexto.getImageData(0, 0, bitmap.width, bitmap.height);
    return { largura: bitmap.width, altura: bitmap.height, canais: 4, dados: data };
  } finally {
    bitmap.close();
  }
}

/** Imagem preparada (1 canal) num canvas, que é o que o tesseract.js recebe. */
function paraCanvas(imagem: ImagemCrua): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = imagem.largura;
  canvas.height = imagem.altura;
  const contexto = canvas.getContext('2d');
  if (!contexto) throw new Error('Canvas 2D indisponível neste navegador.');
  const rgba = contexto.createImageData(imagem.largura, imagem.altura);
  const { canais, dados } = imagem;
  for (let i = 0; i < imagem.largura * imagem.altura; i += 1) {
    for (let c = 0; c < 3; c += 1)
      rgba.data[i * 4 + c] = dados[i * canais + Math.min(c, canais - 1)]!;
    rgba.data[i * 4 + 3] = 255;
  }
  contexto.putImageData(rgba, 0, 0);
  return canvas;
}

export interface LeitorDePrints {
  /** Lê as trocas de uma print. O tesseract é carregado na primeira chamada. */
  ler: (arquivo: Blob) => Promise<ResultadoDaPrint>;
  /** Libera o worker do tesseract. */
  encerrar: () => Promise<void>;
}

/** Leitor de prints com um worker do tesseract.js reaproveitado entre as leituras. */
export function criarLeitorDePrints(): LeitorDePrints {
  let worker: Promise<Worker> | null = null;

  const obterWorker = () => {
    worker ??= (async () => {
      try {
        const novo = await createWorker('por', OEM.LSTM_ONLY, {
          workerPath: arquivoDoTesseract('worker.min.js'),
          corePath: arquivoDoTesseract('core'),
          langPath: arquivoDoTesseract('lang'),
          // Carrega o worker direto da URL local (o padrão embrulha num blob).
          workerBlobURL: false,
        });
        await novo.setParameters({ tessedit_pageseg_mode: PSM.SPARSE_TEXT });
        return novo;
      } catch {
        // A próxima leitura tenta carregar de novo.
        worker = null;
        throw new Error(
          'Não foi possível carregar o leitor de texto. Rode "npm run dev" ou "npm run build" ' +
            'de novo para gerar os arquivos em public/tesseract/.',
        );
      }
    })();
    return worker;
  };

  const lerTexto: LerTexto = async (imagem) => {
    const { data } = await (
      await obterWorker()
    ).recognize(paraCanvas(imagem), {}, { blocks: true });
    return linhasDosBlocos(data.blocks);
  };

  return {
    ler: async (arquivo) => {
      const { data, items } = loadGameData();
      const imagem = await imagemDoArquivo(arquivo);
      return lerTrocasDaPrint(
        imagem,
        lerTexto,
        { islands: data.islands, routes: data.routes, items },
        modelos as ModeloDeDigito[],
      );
    },
    encerrar: async () => {
      const atual = worker;
      worker = null;
      if (atual) await (await atual).terminate();
    },
  };
}
