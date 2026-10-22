/**
 * Lê prints da janela "Informações de Permuta" e monta as trocas.
 * Uso: npm run ocr:ler -- <imagem...> [--json] [--avaliar] [--detalhes] [--debug <pasta>]
 *
 * `--detalhes` mostra o texto lido na imagem em todas as trocas (normalmente só
 * nas que pedem conferência). `--avaliar` compara com `data/prints/esperado.json` (gabarito das prints).
 * Teste antes da integração na tela: a lógica de layout, dígitos e casamento
 * fica em `src/core/ocr/`; o que depende do Node está em `comum.ts`.
 */
import { mkdir, readFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { loadGameData } from '../../src/data';
import type { TrocaLida } from '../../src/core/ocr/casamento';
import type { BarterRoute } from '../../src/core/models/types';
import type { ModeloDeDigito } from '../../src/core/ocr/digitos';
import modelos from '../../src/core/ocr/modelosDigitos.json';
import { criarLeitorDeTexto, lerPrint } from './comum';

interface Opcoes {
  arquivos: string[];
  json: boolean;
  avaliar: boolean;
  detalhes: boolean;
  debug: string | null;
}

interface Esperado {
  ilha: string;
  entrada: string;
  saida: string;
  qtdSaida: number;
  restante: number;
}

function lerArgumentos(argv: string[]): Opcoes {
  const opcoes: Opcoes = {
    arquivos: [],
    json: false,
    avaliar: false,
    detalhes: false,
    debug: null,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]!;
    if (arg === '--json') opcoes.json = true;
    else if (arg === '--avaliar') opcoes.avaliar = true;
    else if (arg === '--detalhes') opcoes.detalhes = true;
    else if (arg === '--debug') opcoes.debug = argv[++i] ?? 'ocr-debug';
    else opcoes.arquivos.push(arg);
  }
  return opcoes;
}

const { data, items } = loadGameData();
const nomeDaIlha = (id: string) => data.islands.find((i) => i.id === id)?.namePt ?? id;

const numero = new Intl.NumberFormat('pt-BR');

const faixa = (r: BarterRoute) =>
  r.receiveQtyMin === r.receiveQtyMax ? null : `${r.receiveQtyMin} a ${r.receiveQtyMax}`;

const descreverRota = (r: BarterRoute) =>
  `${nomeDaIlha(r.islandId)}: ${r.giveQty}× ${items.nameOf(r.giveItemId)} → ` +
  `${items.nameOf(r.receiveItemId)}${faixa(r) ? ` (recebe ${faixa(r)})` : ''}`;

/** Selo de confiança da leitura, do jeito que o usuário precisa agir sobre ela. */
function selo(t: TrocaLida): { ok: boolean; texto: string } {
  if (t.ambigua) return { ok: false, texto: '⚠ CONFIRA: mais de uma troca combina com a leitura' };
  if (t.confianca < 0.75) return { ok: false, texto: '⚠ CONFIRA: leitura com pouca certeza' };
  if (t.origemDaQuantidade === 'maximo_da_faixa' && faixa(t.rota)) {
    return { ok: false, texto: '⚠ CONFIRA a quantidade recebida (número do ícone ilegível)' };
  }
  return { ok: true, texto: '✔ Leitura confiável' };
}

/** Relatório para conferir a print a olho, troca por troca. */
function imprimir(arquivo: string, trocas: TrocaLida[], detalhes: boolean) {
  const linha = '─'.repeat(72);
  console.log(`\n${linha}\n📷 ${basename(arquivo)}`);
  if (trocas.length === 0) {
    console.log('   Nenhuma troca encontrada. A print mostra a janela "Informações de Permuta"?');
    return;
  }
  console.log(
    `   ${trocas.length} troca(s) encontrada(s), na ordem da janela (de cima para baixo)`,
  );
  console.log(linha);

  let paraConferir = 0;
  for (const [i, t] of trocas.entries()) {
    const r = t.rota;
    const s = selo(t);
    if (!s.ok) paraConferir += 1;

    const restante =
      t.linha.restante === null
        ? 'restante não lido'
        : t.linha.restante === 0
          ? 'sem trocas restantes hoje'
          : `restam ${t.linha.restante} troca(s)`;
    const origem =
      faixa(r) === null
        ? ''
        : t.origemDaQuantidade === 'icone'
          ? `  (lido no ícone; a rota dá ${faixa(r)})`
          : `  (número do ícone ilegível; usei o máximo de ${faixa(r)})`;

    console.log(`\n ${String(i + 1).padStart(2)}. ${nomeDaIlha(r.islandId)}  —  ${restante}`);
    console.log(`     Dá:       ${r.giveQty}× ${items.nameOf(r.giveItemId)}`);
    console.log(`     Recebe:   ${t.recebePorTroca}× ${items.nameOf(r.receiveItemId)}${origem}`);
    if (t.linha.barganha !== null) {
      console.log(`     Barganha: ${numero.format(t.linha.barganha)} por troca`);
    }
    console.log(`     ${s.texto} (${(t.confianca * 100).toFixed(0)}%)`);
    if (!s.ok || detalhes) {
      for (const alt of t.alternativas)
        console.log(`       • também pode ser ${descreverRota(alt)}`);
      console.log(
        `       na imagem: "${t.linha.ilhaTexto}" | "${t.linha.entradaTexto}"` +
          ` | "${t.linha.saidaTexto}" | ícones: ${t.linha.qtdEntrada ?? '?'} → ${t.linha.qtdSaida ?? '?'}`,
      );
    }
  }

  console.log(`\n${linha}`);
  console.log(
    paraConferir === 0
      ? `✔ Todas as ${trocas.length} trocas foram lidas com confiança.`
      : `Resumo: ${trocas.length - paraConferir} confiável(is), ${paraConferir} para conferir (marcadas com ⚠).`,
  );
  console.log(linha);
}

/** Confere cada campo com o gabarito; devolve [acertos, total] e imprime os erros. */
function avaliar(arquivo: string, trocas: TrocaLida[], gabarito: Esperado[]): [number, number] {
  let acertos = 0;
  let total = 0;
  const conferir = (campo: string, lido: unknown, certo: unknown, i: number) => {
    total += 1;
    if (lido === certo) acertos += 1;
    else console.log(`  ✗ ${basename(arquivo)} linha ${i} ${campo}: "${lido}" ≠ "${certo}"`);
  };
  if (trocas.length !== gabarito.length) {
    console.log(
      `  ✗ ${basename(arquivo)}: ${trocas.length} trocas lidas, ${gabarito.length} no gabarito`,
    );
  }
  for (const [i, g] of gabarito.entries()) {
    const t = trocas[i];
    const ilha = t ? data.islands.find((x) => x.id === t.rota.islandId) : undefined;
    conferir(
      'ilha',
      ilha && [ilha.namePt, ilha.name].includes(g.ilha) ? g.ilha : ilha?.namePt,
      g.ilha,
      i,
    );
    conferir('entrada', t && items.nameOf(t.rota.giveItemId), g.entrada, i);
    conferir('saída', t && items.nameOf(t.rota.receiveItemId), g.saida, i);
    conferir('recebe', t?.recebePorTroca, g.qtdSaida, i);
    conferir('restante', t?.linha.restante, g.restante, i);
  }
  return [acertos, total];
}

async function main() {
  const opcoes = lerArgumentos(process.argv.slice(2));
  if (opcoes.arquivos.length === 0) {
    console.error(
      'Uso: npm run ocr:ler -- <imagem...> [--json] [--avaliar] [--detalhes] [--debug <pasta>]',
    );
    process.exit(1);
  }
  const gabarito = opcoes.avaliar
    ? (JSON.parse(await readFile('data/prints/esperado.json', 'utf8')) as Record<
        string,
        Esperado[]
      >)
    : {};

  const leitor = await criarLeitorDeTexto();
  const dados = { islands: data.islands, routes: data.routes, items };
  const resultado: Record<string, unknown[]> = {};
  let acertos = 0;
  let total = 0;
  try {
    for (const arquivo of opcoes.arquivos) {
      const debug = opcoes.debug ? join(opcoes.debug, basename(arquivo, '.png')) : null;
      if (debug) await mkdir(debug, { recursive: true });

      const { trocas } = await lerPrint(leitor, arquivo, dados, modelos as ModeloDeDigito[], debug);

      if (opcoes.avaliar) {
        const esperado = gabarito[basename(arquivo)];
        if (!esperado) console.log(`  (sem gabarito para ${basename(arquivo)})`);
        else {
          const [a, t] = avaliar(arquivo, trocas, esperado);
          acertos += a;
          total += t;
        }
      } else if (opcoes.json) {
        resultado[arquivo] = trocas.map((t) => ({
          islandId: t.rota.islandId,
          routeKey: t.rota.key,
          inputItemId: t.rota.giveItemId,
          inputQtyPerTrade: t.rota.giveQty,
          outputItemId: t.rota.receiveItemId,
          outputQtyPerTrade: t.recebePorTroca,
          remainingTrades: t.linha.restante,
          barganha: t.linha.barganha,
          confianca: Number(t.confianca.toFixed(3)),
          ambigua: t.ambigua,
        }));
      } else imprimir(arquivo, trocas, opcoes.detalhes);
    }
  } finally {
    await leitor.encerrar();
  }
  if (opcoes.json) console.log(JSON.stringify(resultado, null, 2));
  if (opcoes.avaliar) console.log(`\nacerto: ${acertos}/${total} campos`);
}

await main();
