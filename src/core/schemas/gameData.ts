import { z } from 'zod';
import type { GameData } from '../models/types';

/** Mensagens de erro em português, apontando o arquivo e o campo com problema. */
const tierSchema = z.enum([
  'level_0',
  'level_1',
  'level_2',
  'level_3',
  'level_4',
  'level_5',
  'level_6',
  'level_7',
  'great_ocean',
]);

const barterTierSchema = tierSchema.exclude(['level_0']);

const id = z.string().min(1, 'identificador vazio');
const nome = z.string().min(1, 'nome vazio');
const peso = z
  .number({ invalid_type_error: 'peso deve ser numérico' })
  .nonnegative('peso negativo');

export const islandSchema = z.object({
  id,
  name: nome,
  namePt: nome,
  x: z.number().nullable(),
  y: z.number().nullable(),
  barterer: z.string().nullable(),
  npcId: z.string().nullable(),
  sourceTier: tierSchema.nullable(),
  targetTier: tierSchema.nullable(),
  hasWarehouse: z.boolean(),
  hasWharfManager: z.boolean(),
});

export const barterItemSchema = z.object({
  id,
  name: nome,
  namePt: nome,
  tier: barterTierSchema,
  weightLt: peso,
  stacks: z.boolean(),
  icon: z.string().nullable(),
});

export const marketMaterialSchema = z.object({
  id,
  name: nome,
  namePt: nome,
  weightLt: peso,
  icon: z.string().nullable(),
});

export const barterRouteSchema = z
  .object({
    key: id,
    islandId: id,
    source: z.enum(['normal', 'sub_group', 'special']),
    giveItemId: id,
    giveTier: tierSchema.nullable(),
    giveQty: z.number().int().positive('quantidade dada deve ser maior que zero'),
    receiveItemId: id,
    receiveTier: tierSchema.nullable(),
    receiveQtyMin: z.number().int().positive('quantidade recebida deve ser maior que zero'),
    receiveQtyMax: z.number().int().positive('quantidade recebida deve ser maior que zero'),
    parleyRequired: z.number().nonnegative('barganha negativa'),
    maxTrades: z.number().int().nonnegative('máximo de trocas negativo'),
    kind: z.enum(['tier', 'crow_coin', 'outro']),
  })
  .refine((r) => r.receiveQtyMax >= r.receiveQtyMin, {
    message: 'receiveQtyMax menor que receiveQtyMin',
  });

export const islandsFileSchema = z.array(islandSchema);
export const barterItemsFileSchema = z.array(barterItemSchema);
export const marketMaterialsFileSchema = z.array(marketMaterialSchema);
export const barterRoutesFileSchema = z.array(barterRouteSchema);

export class DataValidationError extends Error {
  constructor(
    readonly file: string,
    readonly issues: string[],
  ) {
    super(`Arquivo "${file}" inválido:\n- ${issues.join('\n- ')}`);
    this.name = 'DataValidationError';
  }
}

function parseFile<T>(file: string, schema: z.ZodType<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (result.success) return result.data;
  const issues = result.error.issues.slice(0, 20).map((i) => {
    const caminho = i.path.length ? i.path.join('.') : '(raiz)';
    return `${caminho}: ${i.message}`;
  });
  if (result.error.issues.length > 20) {
    issues.push(`… e mais ${result.error.issues.length - 20} problema(s)`);
  }
  throw new DataValidationError(file, issues);
}

export interface RawGameData {
  islands: unknown;
  barterItems: unknown;
  marketMaterials: unknown;
  routes: unknown;
}

/**
 * Valida os quatro arquivos de dados e checa a integridade referencial entre eles
 * (ilhas e itens citados pelas rotas precisam existir).
 */
export function parseGameData(raw: RawGameData): GameData {
  const islands = parseFile('islands.json', islandsFileSchema, raw.islands);
  const barterItems = parseFile('barterItems.json', barterItemsFileSchema, raw.barterItems);
  const marketMaterials = parseFile(
    'marketMaterials.json',
    marketMaterialsFileSchema,
    raw.marketMaterials,
  );
  const routes = parseFile('barterRoutes.json', barterRoutesFileSchema, raw.routes);

  const ilhasConhecidas = new Set(islands.map((i) => i.id));
  const itensConhecidos = new Set([
    ...barterItems.map((i) => i.id),
    ...marketMaterials.map((i) => i.id),
  ]);

  const problemas: string[] = [];
  const duplicadas = (ids: string[]) => {
    const vistos = new Set<string>();
    return ids.filter((i) => (vistos.has(i) ? true : (vistos.add(i), false)));
  };
  for (const dup of duplicadas(islands.map((i) => i.id))) {
    problemas.push(`ilha com id duplicado: ${dup}`);
  }
  for (const dup of duplicadas([...barterItems, ...marketMaterials].map((i) => i.id))) {
    problemas.push(`item com id duplicado: ${dup}`);
  }
  for (const rota of routes) {
    if (!ilhasConhecidas.has(rota.islandId)) {
      problemas.push(`rota ${rota.key}: ilha desconhecida ${rota.islandId}`);
    }
    if (!itensConhecidos.has(rota.giveItemId)) {
      problemas.push(`rota ${rota.key}: item de entrada desconhecido ${rota.giveItemId}`);
    }
  }
  if (problemas.length) throw new DataValidationError('barterRoutes.json', problemas.slice(0, 20));

  return { islands, barterItems, marketMaterials, routes };
}
