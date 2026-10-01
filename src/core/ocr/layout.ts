import { numeroDepoisDe } from './texto';

/** Linha de texto devolvida pelo OCR, em pixels da imagem original. */
export interface LinhaOcr {
  texto: string;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/** Retângulo em pixels da imagem original. */
export interface Caixa {
  x: number;
  y: number;
  largura: number;
  altura: number;
}

/** Uma linha da janela "Informações de Permuta", ainda como texto. */
export interface LinhaDePermuta {
  ilhaTexto: string;
  entradaTexto: string;
  saidaTexto: string;
  restante: number | null;
  barganha: number | null;
  /** Onde ficam os números de quantidade nos ícones (para um OCR só de dígitos). */
  quantidadeEntrada: Caixa;
  quantidadeSaida: Caixa;
  /** Altura esperada de um dígito da quantidade, em pixels. */
  alturaDigito: number;
  /** Começo de "Barganha:" (`bx`, `by`) e altura da linha (`h`), em pixels. */
  geometria: { bx: number; by: number; h: number };
}

/*
 * Proporções da janela, medidas em múltiplos da altura de uma linha (`h`) e a
 * partir do começo do texto "Barganha:" (`bx`, `by`). Como tudo escala junto
 * com a interface do jogo, isso vale para qualquer resolução.
 */
const FAIXA_ACIMA = 0.62; // a linha começa ~0,6h acima de "Barganha:"
const FAIXA_ABAIXO = 0.4;
const RESTANTE_ATE_BARGANHA = 3.6; // "Restante:" fica 3,6h à esquerda de "Barganha:"
const ILHA_MIN = 4.4; // coluna da ilha: entre 4,4h e 1,2h à esquerda de bx
const ILHA_MAX = 1.2;
const SAIDA_MIN = 4.6; // nome do item recebido: a partir de 4,6h à direita
const ICONE_ENTRADA = { x0: -0.82, x1: -0.2 };
const ICONE_SAIDA = { x0: 4.15, x1: 4.85 };
const ICONE_Y = { y0: 0, y1: 0.25 };
/** Altura do número no canto do ícone. */
const ALTURA_DIGITO = 0.135;
/** Altura de uma linha da lista em relação à altura do texto, quando só há uma linha. */
const LINHA_POR_TEXTO = 3.4;

// O texto laranja às vezes sai como "parganna!" ou "pargenna:"; o cabeçalho
// "Poder de Barganha Restante" não casa porque não começa com o rótulo.
const ehBarganha = (texto: string) => /^\W{0,3}\w?arg[ae]n/i.test(texto);
const ehRestante = (texto: string) => /^\W{0,3}\w?est?ante/i.test(texto);
const soNumero = (texto: string) => /^[\d\s.,]+$/.test(texto.trim());

function mediana(valores: number[]): number {
  const ordenados = [...valores].sort((a, b) => a - b);
  return ordenados[Math.floor(ordenados.length / 2)] ?? 0;
}

/** Tira o lixo que o OCR junta no fim (pedaço do ícone de âncora, aspas, reticências). */
function limparFim(texto: string): string {
  let partes = texto.trim().split(/\s+/);
  while (partes.length > 1 && /^[^\p{L}\d]*\p{L}{0,2}[^\p{L}\d]*$/u.test(partes.at(-1)!)) {
    const ultima = partes.at(-1)!;
    // Preposições curtas fazem parte do nome ("Saco de Farinha de").
    if (/^(de|do|da|e)$/i.test(ultima)) break;
    partes = partes.slice(0, -1);
  }
  return partes
    .join(' ')
    .replace(/(\.{2,}|…).*$/, '')
    .trim();
}

const juntar = (linhas: LinhaOcr[]) =>
  linhas
    .sort((a, b) => a.y0 - b.y0)
    .map((l) => limparFim(l.texto))
    .filter(Boolean)
    .join(' ');

/** Agrupa posições verticais próximas (a mesma linha vista por âncoras diferentes). */
function agruparY(ys: number[], tolerancia: number): number[] {
  const grupos: number[][] = [];
  for (const y of [...ys].sort((a, b) => a - b)) {
    const ultimo = grupos.at(-1);
    if (ultimo && y - ultimo[0]! <= tolerancia) ultimo.push(y);
    else grupos.push([y]);
  }
  return grupos.map((g) => Math.min(...g));
}

/**
 * Reconstrói as linhas da lista de permutas a partir das linhas soltas do
 * OCR. Cada troca é ancorada em "Restante:" (coluna da ilha) e em
 * "Barganha:" (abaixo do item de entrada): basta uma das duas ser lida.
 * Linhas cortadas na borda da janela (sem nenhuma das duas) ficam de fora.
 */
export function extrairLinhasDePermuta(linhas: readonly LinhaOcr[]): LinhaDePermuta[] {
  const barganhas = linhas.filter((l) => ehBarganha(l.texto));
  const restantes = linhas.filter((l) => ehRestante(l.texto));
  const ancoras = [...barganhas, ...restantes];
  if (ancoras.length === 0) return [];

  const alturaDoTexto = mediana(ancoras.map((a) => Math.min(a.y1 - a.y0, 40)).filter((v) => v > 0));
  const ys = agruparY(
    ancoras.map((a) => a.y0),
    alturaDoTexto * 1.5,
  );
  const passos = ys.slice(1).map((y, i) => y - ys[i]!);
  const h = passos.length > 0 ? Math.min(...passos) : alturaDoTexto * LINHA_POR_TEXTO;

  // Colunas: a posição de "Barganha:" sai direto ou pela de "Restante:".
  const bx =
    barganhas.length > 0
      ? mediana(barganhas.map((b) => b.x0))
      : mediana(restantes.map((r) => r.x0)) + RESTANTE_ATE_BARGANHA * h;

  return ys.map((by) => {
    const naFaixa = linhas.filter(
      (l) => l.y0 >= by - FAIXA_ACIMA * h && l.y0 < by + FAIXA_ABAIXO * h,
    );
    const barganha = naFaixa.find((l) => ehBarganha(l.texto) && Math.abs(l.x0 - bx) < 0.4 * h);
    const restante = naFaixa.find((l) => ehRestante(l.texto) && l.x0 < bx - ILHA_MAX * h);

    const ilha = naFaixa.filter(
      (l) =>
        l.x0 >= bx - ILHA_MIN * h &&
        l.x0 < bx - ILHA_MAX * h &&
        l.y0 < by - 0.1 * h &&
        !ehRestante(l.texto) &&
        !soNumero(l.texto),
    );
    const entrada = naFaixa.filter(
      (l) => Math.abs(l.x0 - bx) < 0.4 * h && l.y0 < by - 0.1 * h && !ehBarganha(l.texto),
    );
    const saida = naFaixa.filter((l) => l.x0 >= bx + SAIDA_MIN * h);

    const icone = (faixa: { x0: number; x1: number }): Caixa => ({
      x: Math.round(bx + faixa.x0 * h),
      y: Math.round(by + ICONE_Y.y0 * h),
      largura: Math.round((faixa.x1 - faixa.x0) * h),
      altura: Math.round((ICONE_Y.y1 - ICONE_Y.y0) * h),
    });

    return {
      // O nome fica alinhado com "Restante:"; o ícone ▼ ao lado vira lixo ("Y").
      ilhaTexto: juntar(
        [...ilha]
          .sort(
            (a, b) =>
              Math.abs(a.x0 - (bx - RESTANTE_ATE_BARGANHA * h)) -
              Math.abs(b.x0 - (bx - RESTANTE_ATE_BARGANHA * h)),
          )
          .slice(0, 1),
      ),
      entradaTexto: juntar(entrada),
      saidaTexto: juntar(saida),
      restante: restante ? numeroDepoisDe(restante.texto, /est?ante/) : null,
      barganha: barganha ? numeroDepoisDe(barganha.texto, /arg[ae]n\w*/) : null,
      quantidadeEntrada: icone(ICONE_ENTRADA),
      quantidadeSaida: icone(ICONE_SAIDA),
      alturaDigito: ALTURA_DIGITO * h,
      geometria: { bx, by, h },
    };
  });
}
