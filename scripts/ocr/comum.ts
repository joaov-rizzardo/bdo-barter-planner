/**
 * Adaptador do leitor de prints para o Node: abrir a imagem (sharp) e rodar o
 * OCR do texto (tesseract.js). Todo o resto — preparo da imagem, layout,
 * dígitos e casamento com as rotas — é o pipeline de `src/core/ocr/`, o mesmo
 * que a tela usa.
 */
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import sharp from 'sharp';
import { createWorker, PSM } from 'tesseract.js';
import type { DadosDoCasamento } from '../../src/core/ocr/casamento';
import type { ModeloDeDigito } from '../../src/core/ocr/digitos';
import type { ImagemCrua } from '../../src/core/ocr/imagem';
import {
  lerTrocasDaPrint,
  linhasDosBlocos,
  type LerTexto,
  type ResultadoDaPrint,
} from '../../src/core/ocr/pipeline';

/** Print em RGB cru. */
export async function abrirImagem(arquivo: string): Promise<ImagemCrua> {
  const { data, info } = await sharp(arquivo)
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { largura: info.width, altura: info.height, canais: info.channels, dados: data };
}

export interface LeitorDeTexto {
  /** `debug`: pasta onde gravar a imagem que foi para o OCR (`tela.png`). */
  lerTexto: (debug?: string | null) => LerTexto;
  encerrar: () => Promise<void>;
}

/** OCR do texto com tesseract.js (`por`, texto esparso). */
export async function criarLeitorDeTexto(): Promise<LeitorDeTexto> {
  const worker = await createWorker('por');
  await worker.setParameters({ tessedit_pageseg_mode: PSM.SPARSE_TEXT });

  const lerTexto =
    (debug: string | null = null): LerTexto =>
    async (imagem) => {
      const png = await sharp(Buffer.from(imagem.dados as Uint8Array), {
        raw: { width: imagem.largura, height: imagem.altura, channels: imagem.canais as 1 },
      })
        .png()
        .toBuffer();
      if (debug) await writeFile(join(debug, 'tela.png'), png);

      const { data } = await worker.recognize(png, {}, { blocks: true });
      return linhasDosBlocos(data.blocks);
    };

  return { lerTexto, encerrar: () => worker.terminate().then(() => undefined) };
}

/** Lê uma print do disco pelo pipeline do core; `debug` grava o que foi lido. */
export async function lerPrint(
  leitor: LeitorDeTexto,
  arquivo: string,
  dados: DadosDoCasamento,
  modelos: readonly ModeloDeDigito[],
  debug: string | null = null,
): Promise<ResultadoDaPrint> {
  const imagem = await abrirImagem(arquivo);
  const resultado = await lerTrocasDaPrint(imagem, leitor.lerTexto(debug), dados, modelos);
  if (debug) {
    await writeFile(join(debug, 'linhas.json'), JSON.stringify(resultado.texto, null, 1));
  }
  return resultado;
}
