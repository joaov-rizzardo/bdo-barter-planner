/** Imagem RGB(A) crua, como vem do sharp ou de um `ImageData` do canvas. */
export interface ImagemCrua {
  largura: number;
  altura: number;
  canais: number;
  dados: ArrayLike<number>;
}

interface Componente {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  pixels: number[];
}

/**
 * Brilho mínimo nos três canais. O núcleo do dígito é branco puro e o
 * contorno escuro o separa da arte do ícone; a borda suavizada (limiar
 * baixo) só entra dentro da caixa de um glifo já encontrado.
 */
const LIMIAR_NUCLEO = 175;
const LIMIAR_BORDA = 110;

const VIZINHOS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
] as const;

/**
 * Junta pedaços do mesmo glifo: o traço fino dos dígitos pequenos quebra em
 * vários componentes que se sobrepõem na horizontal. Só junta pedaços
 * pequenos e próximos na vertical, para não colar a arte do ícone no número.
 */
function juntarGlifos(lista: Componente[], alturaDigito: number): Componente[] {
  const pequenos = lista.filter((c) => c.y1 - c.y0 + 1 <= alturaDigito * 1.35);
  const ordenados = [...pequenos].sort((a, b) => a.x0 - b.x0);
  const glifos: Componente[] = [];
  for (const c of ordenados) {
    const alvo = glifos.find((g) => {
      const sobreposicao = Math.min(g.x1, c.x1) - Math.max(g.x0, c.x0) + 1;
      const menor = Math.min(g.x1 - g.x0, c.x1 - c.x0) + 1;
      const folgaVertical = Math.max(g.y0, c.y0) - Math.min(g.y1, c.y1);
      const alturaJunta = Math.max(g.y1, c.y1) - Math.min(g.y0, c.y0) + 1;
      return (
        sobreposicao >= menor * 0.5 &&
        folgaVertical <= alturaDigito * 0.35 &&
        alturaJunta <= alturaDigito * 1.35
      );
    });
    if (alvo) {
      alvo.x0 = Math.min(alvo.x0, c.x0);
      alvo.x1 = Math.max(alvo.x1, c.x1);
      alvo.y0 = Math.min(alvo.y0, c.y0);
      alvo.y1 = Math.max(alvo.y1, c.y1);
      alvo.pixels.push(...c.pixels);
    } else glifos.push({ ...c, pixels: [...c.pixels] });
  }
  return glifos;
}

function componentes(mascara: Uint8Array, largura: number, altura: number): Componente[] {
  const visto = new Uint8Array(mascara.length);
  const lista: Componente[] = [];
  for (let inicio = 0; inicio < mascara.length; inicio += 1) {
    if (!mascara[inicio] || visto[inicio]) continue;
    const c: Componente = { x0: largura, y0: altura, x1: -1, y1: -1, pixels: [] };
    const pilha = [inicio];
    visto[inicio] = 1;
    while (pilha.length > 0) {
      const p = pilha.pop()!;
      const x = p % largura;
      const y = (p - x) / largura;
      c.pixels.push(p);
      c.x0 = Math.min(c.x0, x);
      c.x1 = Math.max(c.x1, x);
      c.y0 = Math.min(c.y0, y);
      c.y1 = Math.max(c.y1, y);
      for (const [dx, dy] of VIZINHOS) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= largura || ny >= altura) continue;
        const q = ny * largura + nx;
        if (mascara[q] && !visto[q]) {
          visto[q] = 1;
          pilha.push(q);
        }
      }
    }
    lista.push(c);
  }
  return lista;
}

/** Caixa de um dígito dentro do recorte. */
export interface Glifo {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface NumeroIsolado {
  /** 1 = pixel de dígito; mesmo tamanho do recorte. */
  mascara: Uint8Array;
  largura: number;
  /** Da esquerda para a direita. */
  glifos: Glifo[];
}

/**
 * Isola o número do canto do ícone: pixels quase brancos, agrupados em
 * componentes, e fica só a sequência que termina mais à direita e mais embaixo
 * (o número é alinhado no canto inferior direito). `null` quando não há nada
 * que pareça número. `limiarNucleo` menor serve para números cinza fora do
 * ícone (como a distância debaixo da seta).
 */
export function isolarNumero(
  img: ImagemCrua,
  alturaDigito: number,
  limiarNucleo = LIMIAR_NUCLEO,
): NumeroIsolado | null {
  const { largura, altura, canais, dados } = img;
  const brilho = new Uint8Array(largura * altura);
  for (let i = 0; i < brilho.length; i += 1) {
    brilho[i] = Math.min(dados[i * canais]!, dados[i * canais + 1]!, dados[i * canais + 2]!);
  }
  const mascara = brilho.map((v) => (v > limiarNucleo ? 1 : 0));

  // Dígito tem a altura esperada (a moldura do ícone é mais alta, a arte
  // costuma ser maior ou picotada) e encosta na metade de baixo do recorte.
  const candidatos = juntarGlifos(componentes(mascara, largura, altura), alturaDigito).filter(
    (c) => {
      const h = c.y1 - c.y0 + 1;
      const w = c.x1 - c.x0 + 1;
      return (
        h >= alturaDigito * 0.65 &&
        h <= alturaDigito * 1.35 &&
        w <= alturaDigito * 1.1 &&
        c.y1 >= altura * 0.55
      );
    },
  );
  if (candidatos.length === 0) return null;

  // Começa pelo mais à direita e vai juntando os vizinhos na mesma linha de base.
  candidatos.sort((a, b) => b.x1 - a.x1);
  const primeiro = candidatos[0]!;
  const grupo = [primeiro];
  for (const c of candidatos.slice(1)) {
    const anterior = grupo.at(-1)!;
    const mesmaBase = Math.abs(c.y1 - primeiro.y1) <= alturaDigito * 0.3;
    const perto = anterior.x0 - c.x1 <= alturaDigito * 0.6;
    if (mesmaBase && perto) grupo.push(c);
  }

  const limpa = new Uint8Array(largura * altura);
  for (const c of grupo) {
    for (let y = c.y0; y <= c.y1; y += 1) {
      for (let x = c.x0; x <= c.x1; x += 1) {
        if (brilho[y * largura + x]! > LIMIAR_BORDA) limpa[y * largura + x] = 1;
      }
    }
  }
  const glifos = grupo
    .map(({ x0, y0, x1, y1 }) => ({ x0, y0, x1, y1 }))
    .sort((a, b) => a.x0 - b.x0);
  return { mascara: limpa, largura, glifos };
}

/** Grade em que cada glifo é reamostrado antes de comparar com os modelos. */
const GRADE_X = 6;
const GRADE_Y = 9;
/** Peso da proporção largura/altura: separa o "1", estreito, dos outros. */
const PESO_PROPORCAO = 3;

/**
 * Vetor de características do glifo: cobertura de cada célula de uma grade
 * 6x9 (amostrada em 3x3 pontos por célula) mais a proporção largura/altura.
 * Independe do tamanho, então vale para qualquer resolução.
 */
export function vetorDoGlifo(numero: NumeroIsolado, g: Glifo): number[] {
  const w = g.x1 - g.x0 + 1;
  const h = g.y1 - g.y0 + 1;
  const vetor: number[] = [];
  for (let cy = 0; cy < GRADE_Y; cy += 1) {
    for (let cx = 0; cx < GRADE_X; cx += 1) {
      let soma = 0;
      for (let sy = 0; sy < 3; sy += 1) {
        for (let sx = 0; sx < 3; sx += 1) {
          const x = g.x0 + Math.floor(((cx + (sx + 0.5) / 3) / GRADE_X) * w);
          const y = g.y0 + Math.floor(((cy + (sy + 0.5) / 3) / GRADE_Y) * h);
          soma += numero.mascara[y * numero.largura + x] ?? 0;
        }
      }
      vetor.push(soma / 9);
    }
  }
  vetor.push((w / h) * PESO_PROPORCAO);
  return vetor;
}

/** Amostra rotulada de um dígito (gerada por `npm run ocr:modelos`). */
export interface ModeloDeDigito {
  digito: string;
  vetor: number[];
}

function distancia(a: readonly number[], b: readonly number[]): number {
  let soma = 0;
  for (let i = 0; i < a.length; i += 1) soma += (a[i]! - (b[i] ?? 0)) ** 2;
  return Math.sqrt(soma);
}

/** Distância máxima até o modelo mais próximo para aceitar um dígito. */
const DISTANCIA_MAXIMA = 4;

/**
 * Lê o número isolado comparando cada glifo com os modelos (vizinho mais
 * próximo). `null` quando algum glifo não se parece com nenhum dígito.
 */
export function lerNumero(
  numero: NumeroIsolado,
  modelos: readonly ModeloDeDigito[],
): number | null {
  if (modelos.length === 0 || numero.glifos.length === 0) return null;
  let texto = '';
  for (const g of numero.glifos) {
    const vetor = vetorDoGlifo(numero, g);
    let melhor: { digito: string; d: number } | null = null;
    for (const m of modelos) {
      const d = distancia(vetor, m.vetor);
      if (!melhor || d < melhor.d) melhor = { digito: m.digito, d };
    }
    if (!melhor || melhor.d > DISTANCIA_MAXIMA) return null;
    texto += melhor.digito;
  }
  return Number(texto);
}
