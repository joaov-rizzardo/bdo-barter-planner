/**
 * Partes do leitor de prints que dependem do Node: abrir a imagem (sharp) e
 * rodar o OCR do texto (tesseract.js). Layout, dígitos e casamento com as
 * rotas ficam em `src/core/ocr/`, para a tela reaproveitar depois.
 */
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import sharp from 'sharp';
import { createWorker, PSM, type Worker } from 'tesseract.js';
import type { LinhaLida } from '../../src/core/ocr/casamento';
import {
  isolarNumero,
  lerNumero,
  type ImagemCrua,
  type ModeloDeDigito,
} from '../../src/core/ocr/digitos';
import { extrairLinhasDePermuta, type Caixa, type LinhaOcr } from '../../src/core/ocr/layout';

/** Largura alvo da imagem ampliada: o tesseract erra menos com letra grande. */
const LARGURA_OCR = 2400;

export async function criarLeitorDeTexto(): Promise<Worker> {
  const worker = await createWorker('por');
  await worker.setParameters({ tessedit_pageseg_mode: PSM.SPARSE_TEXT });
  return worker;
}

/**
 * Texto do jogo é claro (branco, laranja, verde, azul) sobre fundo escuro: o
 * maior canal de cor separa bem o texto colorido; invertido vira texto escuro
 * sobre fundo claro, que é o que o tesseract espera.
 */
async function prepararTela(arquivo: string) {
  const { data, info } = await sharp(arquivo)
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const cinza = Buffer.alloc(info.width * info.height);
  for (let i = 0; i < cinza.length; i += 1) {
    cinza[i] = 255 - Math.max(data[i * 3]!, data[i * 3 + 1]!, data[i * 3 + 2]!);
  }
  const escala = Math.min(4, Math.max(1, LARGURA_OCR / info.width));
  const png = await sharp(cinza, { raw: { width: info.width, height: info.height, channels: 1 } })
    .resize(Math.round(info.width * escala))
    .png()
    .toBuffer();
  return { png, escala };
}

/** Linhas de texto da print, com a posição em pixels da imagem original. */
export async function lerTextoDaTela(
  worker: Worker,
  arquivo: string,
  debug: string | null = null,
): Promise<LinhaOcr[]> {
  const { png, escala } = await prepararTela(arquivo);
  if (debug) await sharp(png).toFile(join(debug, 'tela.png'));
  const { data } = await worker.recognize(png, {}, { blocks: true });
  const linhas: LinhaOcr[] = [];
  for (const bloco of data.blocks ?? []) {
    for (const paragrafo of bloco.paragraphs) {
      for (const linha of paragrafo.lines) {
        const texto = linha.text.trim();
        if (!texto) continue;
        linhas.push({
          texto,
          x0: linha.bbox.x0 / escala,
          y0: linha.bbox.y0 / escala,
          x1: linha.bbox.x1 / escala,
          y1: linha.bbox.y1 / escala,
        });
      }
    }
  }
  if (debug) await writeFile(join(debug, 'linhas.json'), JSON.stringify(linhas, null, 1));
  return linhas;
}

/** Recorte da imagem original em RGB cru; `null` se a caixa cai fora da imagem. */
export async function recortar(arquivo: string, caixa: Caixa): Promise<ImagemCrua | null> {
  const meta = await sharp(arquivo).metadata();
  const x = Math.max(0, Math.round(caixa.x));
  const y = Math.max(0, Math.round(caixa.y));
  const largura = Math.min(Math.round(caixa.largura), (meta.width ?? 0) - x);
  const altura = Math.min(Math.round(caixa.altura), (meta.height ?? 0) - y);
  if (largura <= 0 || altura <= 0) return null;
  const { data, info } = await sharp(arquivo)
    .extract({ left: x, top: y, width: largura, height: altura })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { largura: info.width, altura: info.height, canais: info.channels, dados: data };
}

/** Linhas da janela de permuta com as quantidades dos ícones já lidas. */
export async function lerPrint(
  worker: Worker,
  arquivo: string,
  modelos: readonly ModeloDeDigito[],
  debug: string | null = null,
): Promise<LinhaLida[]> {
  const texto = await lerTextoDaTela(worker, arquivo, debug);
  const linhas: LinhaLida[] = [];
  for (const linha of extrairLinhasDePermuta(texto)) {
    const quantidade = async (caixa: Caixa) => {
      const img = await recortar(arquivo, caixa);
      const numero = img ? isolarNumero(img, linha.alturaDigito) : null;
      return numero ? lerNumero(numero, modelos) : null;
    };
    linhas.push({
      ...linha,
      qtdEntrada: await quantidade(linha.quantidadeEntrada),
      qtdSaida: await quantidade(linha.quantidadeSaida),
    });
  }
  return linhas;
}
