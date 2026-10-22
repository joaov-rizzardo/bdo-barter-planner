/**
 * Prepara os arquivos do tesseract.js que o app serve localmente (funciona
 * offline no Tauri), em `public/tesseract/`:
 *
 * - `worker.min.js`: o pacote não publica o worker do navegador (o padrão é
 *   baixar da CDN), então ele é gerado aqui com o esbuild a partir do fonte;
 * - `core/*.wasm.js`: as variantes LSTM do núcleo (o tesseract escolhe pela
 *   presença de SIMD), copiadas de `tesseract.js-core`;
 * - `lang/por.traineddata.gz`: versionado no repositório; se faltar, é baixado.
 *
 * Roda sozinho antes de `npm run dev` e `npm run build` (predev/prebuild).
 */
import { build } from 'esbuild';
import { copyFile, mkdir, stat, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);
const DESTINO = 'public/tesseract';
const IDIOMA = `${DESTINO}/lang/por.traineddata.gz`;
const URL_DO_IDIOMA =
  'https://cdn.jsdelivr.net/npm/@tesseract.js-data/por/4.0.0_best_int/por.traineddata.gz';
const NUCLEOS = [
  'tesseract-core-lstm.wasm.js',
  'tesseract-core-simd-lstm.wasm.js',
  'tesseract-core-relaxedsimd-lstm.wasm.js',
];

const existe = (caminho) =>
  stat(caminho).then(
    () => true,
    () => false,
  );

const raizDoPacote = (nome) => dirname(require.resolve(`${nome}/package.json`));

await mkdir(join(DESTINO, 'core'), { recursive: true });
await mkdir(join(DESTINO, 'lang'), { recursive: true });

await build({
  entryPoints: [join(raizDoPacote('tesseract.js'), 'src/worker-script/browser/index.js')],
  outfile: join(DESTINO, 'worker.min.js'),
  bundle: true,
  minify: true,
  format: 'iife',
  platform: 'browser',
  // O fonte usa o `global` do Node; no worker do navegador ele é o `self`.
  define: { global: 'self' },
  logLevel: 'warning',
});

const core = raizDoPacote('tesseract.js-core');
for (const arquivo of NUCLEOS) await copyFile(join(core, arquivo), join(DESTINO, 'core', arquivo));

if (!(await existe(IDIOMA))) {
  console.log(`Baixando ${URL_DO_IDIOMA}`);
  const resposta = await fetch(URL_DO_IDIOMA);
  if (!resposta.ok) throw new Error(`Falha ao baixar o idioma: HTTP ${resposta.status}`);
  await writeFile(IDIOMA, Buffer.from(await resposta.arrayBuffer()));
}

console.log('tesseract.js pronto em public/tesseract/');
