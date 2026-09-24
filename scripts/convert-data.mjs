#!/usr/bin/env node
/**
 * Converte os arquivos brutos de `data/raw/` (extraídos do BDO Barter Helper)
 * para o formato normalizado que o app consome em `src/data/`.
 *
 *   data/raw/barterPorts.json    -> src/data/islands.json
 *   data/raw/barterGoods.json    -> src/data/barterItems.json
 *   data/raw/barterCatalog.json  -> src/data/marketMaterials.json  (tier level_0)
 *   data/raw/barterRoutes.json   -> src/data/barterRoutes.json
 *
 * Uso: npm run data:convert
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const raw = (name) => JSON.parse(readFileSync(resolve(root, 'data/raw', name), 'utf8'));
const out = (name, data) =>
  writeFileSync(resolve(root, 'src/data', name), JSON.stringify(data, null, 2) + '\n');

/**
 * Os dados brutos não trazem armazém/Gerente de Cais. Esta lista é o padrão
 * inicial (portos conhecidos com armazém + gerente de cais) e pode ser
 * ajustada pelo usuário na tela de Configurações.
 */
const PORTOS_COM_ARMAZEM = new Set([
  '92',
  '181',
  '182',
  '415',
  '693',
  '966',
  '1014',
  '1243',
  '1257',
]);

/** Gerente de Cais: os portos acima, mais os que só têm o gerente sem armazém conhecido. */
const PORTOS_COM_GERENTE_DE_CAIS = new Set([...PORTOS_COM_ARMAZEM, '562', '983']);

/**
 * Coordenadas que faltam nos dados brutos, tiradas do BDOCodex
 * (ver docs/bdocodex-coordenadas.md). Chave: id do porto em barterPorts.json.
 */
const COORDENADAS_EXTRAS = {
  983: [252800, -710000], // Ninho do Corvo (node 1746)
};

/**
 * Portos com Gerente de Cais que não têm permutador (não estão em barterPorts.json).
 * Só servem de parada para transferência ao inventário e venda de T7.
 * Id `node-<id do node no BDOCodex>`; coordenadas convertidas do BDOCodex.
 */
const PORTOS_SO_COM_GERENTE = [
  { node: 604, name: 'Port Epheria', namePt: 'Porto de Epheria', x: -355616, y: -32649.6 },
  {
    node: 1719,
    name: 'Outpost Supply Station',
    namePt: 'Posto de Abastecimento do Posto Avançado',
    x: -448719.5,
    y: -27276.8,
  },
  {
    node: 1377,
    name: 'Abandoned Pier of Shakatu',
    namePt: 'Píer Abandonado de Shakatu',
    x: 505184,
    y: -264052,
  },
  { node: 1326, name: 'Hopeful Raft', namePt: 'Balsa Esperançosa', x: 539135, y: -299499 },
  { node: 2052, name: 'Olvia Academy', namePt: 'Academia de Olvia', x: -120541, y: -151535 },
];

const TIERS_QUE_EMPILHAM = new Set(['level_0', 'level_1', 'level_2', 'level_3', 'level_4']);

function slugIcon(icon) {
  // "/assets/icons/foo.webp" -> "icons/foo.webp" (servido de public/)
  return icon ? icon.replace(/^\/assets\//, '') : null;
}

function converterIlhas() {
  const ports = raw('barterPorts.json');
  const permutadores = Object.entries(ports).map(([id, p]) => {
    const [x, y] = Array.isArray(p.coordinates) ? p.coordinates : (COORDENADAS_EXTRAS[id] ?? []);
    return {
      id,
      name: p.name,
      namePt: p.name_pt ?? p.name,
      x: x ?? null,
      y: y ?? null,
      barterer: p.barterer ?? null,
      npcId: p.npcId ?? null,
      sourceTier: p.source_tier ?? null,
      targetTier: p.target_tier ?? null,
      hasWarehouse: PORTOS_COM_ARMAZEM.has(id),
      hasWharfManager: PORTOS_COM_GERENTE_DE_CAIS.has(id),
    };
  });
  const soGerente = PORTOS_SO_COM_GERENTE.map(({ node, name, namePt, x, y }) => ({
    id: `node-${node}`,
    name,
    namePt,
    x,
    y,
    barterer: null,
    npcId: null,
    sourceTier: null,
    targetTier: null,
    hasWarehouse: false,
    hasWharfManager: true,
  }));
  const ilhas = [...permutadores, ...soGerente].sort((a, b) =>
    a.namePt.localeCompare(b.namePt, 'pt-BR'),
  );
  out('islands.json', ilhas);
  return ilhas.length;
}

function converterItens() {
  const goods = raw('barterGoods.json');
  const itens = goods
    .filter((g) => g.tier !== 'level_0')
    .map((g) => ({
      id: String(g.itemId),
      name: g.name,
      namePt: g.name_pt ?? g.name,
      tier: g.tier,
      weightLt: g.weight,
      stacks: TIERS_QUE_EMPILHAM.has(g.tier),
      icon: slugIcon(g.icon),
    }))
    .sort((a, b) => a.tier.localeCompare(b.tier) || a.namePt.localeCompare(b.namePt, 'pt-BR'));
  out('barterItems.json', itens);
  return itens.length;
}

function converterMateriais() {
  const catalog = raw('barterCatalog.json');
  const materiais = catalog
    .filter((c) => c.tier === 'level_0')
    .map((c) => ({
      id: String(c.itemId),
      name: c.name,
      namePt: c.name_pt ?? c.name,
      weightLt: c.weight,
      icon: slugIcon(c.icon),
    }))
    .sort((a, b) => a.namePt.localeCompare(b.namePt, 'pt-BR'));
  out('marketMaterials.json', materiais);
  return materiais.length;
}

function converterRotas() {
  const { routes } = raw('barterRoutes.json').result.data;
  const rotas = routes
    // regionId 0 são ofertas especiais (barra de ouro -> itens de loja), fora do escopo.
    .filter((r) => r.regionId !== 0)
    .map((r) => ({
      key: r.routeKey,
      islandId: String(r.regionId),
      source: r.source,
      giveItemId: String(r.giveItemId),
      giveTier: r.giveTier ?? null,
      giveQty: r.giveMaxCount,
      receiveItemId: String(r.receiveItemId),
      receiveTier: r.receiveTier ?? null,
      receiveQtyMin: r.receiveMinCount,
      receiveQtyMax: r.receiveMaxCount,
      parleyRequired: r.parleyRequired,
      maxTrades: r.exchangeMaxCount,
      kind: r.receiveTier ? 'tier' : r.receiveItemId === 10 ? 'crow_coin' : 'outro',
    }))
    .sort((a, b) => a.key.localeCompare(b.key));
  out('barterRoutes.json', rotas);
  return rotas;
}

const ilhas = converterIlhas();
const itens = converterItens();
const materiais = converterMateriais();
const rotas = converterRotas();
const porTipo = rotas.reduce((acc, r) => ({ ...acc, [r.kind]: (acc[r.kind] ?? 0) + 1 }), {});
console.log(`src/data/islands.json: ${ilhas} portos`);
console.log(`src/data/barterItems.json: ${itens} itens de permuta`);
console.log(`src/data/marketMaterials.json: ${materiais} materiais T0`);
console.log(
  `src/data/barterRoutes.json: ${rotas.length} rotas ` +
    `(tier: ${porTipo.tier ?? 0}, moedas do corvo: ${porTipo.crow_coin ?? 0}, outras: ${porTipo.outro ?? 0})`,
);
