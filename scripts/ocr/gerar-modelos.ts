/**
 * Gera `src/core/ocr/modelosDigitos.json` a partir das prints rotuladas em
 * `data/prints/esperado.json`: cada dígito das quantidades dos ícones e dos
 * números de distância (debaixo da seta de cada ilha) vira uma amostra.
 * Uso: npm run ocr:modelos
 *
 * Antes de gravar, mede o acerto deixando cada print de fora (os modelos das
 * outras prints leem os dígitos dela).
 */
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  isolarNumero,
  lerNumero,
  vetorDoGlifo,
  type ModeloDeDigito,
  type NumeroIsolado,
} from '../../src/core/ocr/digitos';
import { extrairLinhasDePermuta, type Caixa } from '../../src/core/ocr/layout';
import { criarLeitorDeTexto, lerTextoDaTela, recortar } from './comum';

const PASTA = 'data/prints';
const SAIDA = 'src/core/ocr/modelosDigitos.json';
/** O número de distância é cinza: núcleo mais escuro que o dos ícones. */
const LIMIAR_DISTANCIA = 130;

interface Esperado {
  qtdEntrada: number;
  qtdSaida: number;
  distancia: number;
}

interface Amostra {
  print: string;
  rotulo: string;
  numero: NumeroIsolado;
}

const esperado = JSON.parse(await readFile(join(PASTA, 'esperado.json'), 'utf8')) as Record<
  string,
  Esperado[]
>;

const worker = await criarLeitorDeTexto();
const amostras: Amostra[] = [];
const descartes: string[] = [];

try {
  for (const [print, rotulos] of Object.entries(esperado)) {
    const arquivo = join(PASTA, print);
    const texto = await lerTextoDaTela(worker, arquivo);
    const linhas = extrairLinhasDePermuta(texto);
    if (linhas.length !== rotulos.length) {
      descartes.push(`${print}: ${linhas.length} linhas lidas, ${rotulos.length} no gabarito`);
      continue;
    }

    const colher = async (
      caixa: Caixa,
      alturaDigito: number,
      valor: number,
      onde: string,
      limiar?: number,
    ) => {
      const img = await recortar(arquivo, caixa);
      const numero = img ? isolarNumero(img, alturaDigito, limiar) : null;
      const rotulo = String(valor);
      if (!numero || numero.glifos.length !== rotulo.length) {
        descartes.push(
          `${print} ${onde}: esperava ${rotulo}, achou ${numero?.glifos.length ?? 0} glifo(s)`,
        );
        return;
      }
      amostras.push({ print, rotulo, numero });
    };

    for (const [i, linha] of linhas.entries()) {
      const r = rotulos[i]!;
      const { bx, by, h } = linha.geometria;
      await colher(linha.quantidadeEntrada, linha.alturaDigito, r.qtdEntrada, `linha ${i} entrada`);
      await colher(linha.quantidadeSaida, linha.alturaDigito, r.qtdSaida, `linha ${i} saída`);

      // Número de distância: a caixa vem do próprio OCR do texto.
      const distancia = texto.find(
        (l) =>
          /^\d+$/.test(l.texto.trim()) &&
          l.x0 < bx - 3 * h &&
          l.y0 > by - 0.2 * h &&
          l.y0 < by + 0.7 * h,
      );
      if (distancia) {
        const folga = (distancia.y1 - distancia.y0) * 0.4;
        await colher(
          {
            x: distancia.x0 - folga,
            y: distancia.y0 - folga,
            largura: distancia.x1 - distancia.x0 + 2 * folga,
            altura: distancia.y1 - distancia.y0 + 2 * folga,
          },
          distancia.y1 - distancia.y0,
          r.distancia,
          `linha ${i} distância`,
          LIMIAR_DISTANCIA,
        );
      } else descartes.push(`${print} linha ${i}: número de distância não encontrado`);
    }
  }
} finally {
  await worker.terminate();
}

const modelosDe = (lista: Amostra[]): ModeloDeDigito[] =>
  lista.flatMap(({ rotulo, numero }) =>
    numero.glifos.map((g, i) => ({ digito: rotulo[i]!, vetor: vetorDoGlifo(numero, g) })),
  );

let acertos = 0;
const erros: string[] = [];
for (const a of amostras) {
  const lido = lerNumero(a.numero, modelosDe(amostras.filter((b) => b.print !== a.print)));
  if (String(lido) === a.rotulo) acertos += 1;
  else erros.push(`${a.print}: ${a.rotulo} lido como ${lido ?? '?'}`);
}

const modelos = modelosDe(amostras).map((m) => ({
  digito: m.digito,
  vetor: m.vetor.map((v) => Number(v.toFixed(3))),
}));
await writeFile(SAIDA, `${JSON.stringify(modelos)}\n`);

const porDigito = new Map<string, number>();
for (const m of modelos) porDigito.set(m.digito, (porDigito.get(m.digito) ?? 0) + 1);
console.log(`${modelos.length} amostras de dígito gravadas em ${SAIDA}`);
console.log(
  'por dígito:',
  [...porDigito]
    .sort()
    .map(([d, n]) => `${d}=${n}`)
    .join(' '),
);
console.log(`validação deixando a print de fora: ${acertos}/${amostras.length} números certos`);
for (const e of erros) console.log(`  erro: ${e}`);
for (const d of descartes) console.log(`  descartado: ${d}`);
