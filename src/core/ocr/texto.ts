import type { Tier } from '../models/types';

/** Minúsculo, sem acento, sem a etiqueta de tier e só com letras, números e espaço. */
export function normalizarNome(texto: string): string {
  return (
    texto
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .toLowerCase()
      // Tudo até a etiqueta de tier sai junto: o OCR costuma grudar lixo antes dela.
      .replace(/^.*?(nivel|nv)\s*\.?\s*\d+\s*[\])|il1]?/, '')
      .replace(/[^a-z0-9 ]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  );
}

/** Tier da etiqueta `[Nível N]` / `[Nv. N]`; o OCR às vezes troca o colchete por `I`. */
export function tierDaEtiqueta(texto: string): Tier | null {
  const m = /(?:n[ií]vel|nv)\s*\.?\s*(\d)/i.exec(texto);
  if (!m) return null;
  const n = Number(m[1]);
  return n >= 1 && n <= 7 ? (`level_${n}` as Tier) : null;
}

/** Primeiro número da linha depois do rótulo (`Restante: 5`, `Barganha: 10,743`). */
export function numeroDepoisDe(texto: string, rotulo: RegExp): number | null {
  // O OCR troca 0 por O e 1 por l/I nos números curtos.
  const m = new RegExp(`${rotulo.source}\\s*[:;.!]?\\s*([\\dOolI.,]+)`, 'i').exec(texto);
  if (!m?.[1]) return null;
  const digitos = m[1].replace(/[Oo]/g, '0').replace(/[lI]/g, '1').replace(/[.,]/g, '');
  return digitos ? Number(digitos) : null;
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a) return b.length;
  if (!b) return a.length;
  let anterior = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    const atual = [i];
    for (let j = 1; j <= b.length; j += 1) {
      const custo = a[i - 1] === b[j - 1] ? 0 : 1;
      atual[j] = Math.min(anterior[j]! + 1, atual[j - 1]! + 1, anterior[j - 1]! + custo);
    }
    anterior = atual;
  }
  return anterior[b.length]!;
}

function razao(a: string, b: string): number {
  const maior = Math.max(a.length, b.length);
  return maior === 0 ? 1 : 1 - levenshtein(a, b) / maior;
}

/**
 * Semelhança entre o texto lido e um nome conhecido (0 a 1), já normalizados.
 * O jogo corta nomes longos com reticências, então também compara com o
 * começo do nome conhecido no mesmo tamanho do texto lido.
 */
export function semelhanca(lido: string, conhecido: string): number {
  if (!lido || !conhecido) return 0;
  let melhor = razao(lido, conhecido);
  if (conhecido.length > lido.length) {
    for (let folga = -2; folga <= 2; folga += 1) {
      const tamanho = lido.length + folga;
      if (tamanho < 4 || tamanho > conhecido.length) continue;
      // Prefixo vale um pouco menos que o nome inteiro, para desempatar.
      melhor = Math.max(melhor, razao(lido, conhecido.slice(0, tamanho)) * 0.97);
    }
  }
  return melhor;
}
