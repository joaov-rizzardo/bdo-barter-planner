import { z } from 'zod';
import { PESO_PADRAO_MARINHEIRO_LT, type AppSettings } from '../models/types';

/**
 * Padrões do app. Os slots são o espaço **livre** do navio; o peso livre é
 * derivado (capacidade total menos os marinheiros). Os valores abaixo são só
 * um ponto de partida e devem ser ajustados.
 */
export const DEFAULT_SETTINGS: AppSettings = {
  barter: {
    levelReduction: 0,
    economyPackage: true,
    viceCaptain: true,
    viceCaptainPercent: 10,
  },
  ship: {
    freeWeightLt: 12_000,
    freeSlots: 25,
    totalWeightLt: 12_000,
    sailorsLt: [],
    allowOverweight: false,
    overweightMode: 'transferencia',
    sellT7: true,
  },
  route: {
    baseIslandId: null,
    unloadIslandIds: [],
    portOverrides: {},
    distanceOverrides: [],
  },
};

const portOverrideSchema = z
  .object({
    hasWarehouse: z.boolean().optional(),
    hasWharfManager: z.boolean().optional(),
  })
  .strict();

export const appSettingsSchema = z.object({
  barter: z.object({
    levelReduction: z.number().min(0).max(1),
    economyPackage: z.boolean(),
    viceCaptain: z.boolean(),
    viceCaptainPercent: z.number().min(0).max(100),
  }),
  ship: z.object({
    freeWeightLt: z.number().positive(),
    freeSlots: z.number().int().positive(),
    totalWeightLt: z.number().positive(),
    sailorsLt: z.array(z.number().positive()),
    allowOverweight: z.boolean(),
    overweightMode: z.enum(['qualquer', 'transferencia']),
    sellT7: z.boolean(),
  }),
  route: z.object({
    baseIslandId: z.string().nullable(),
    unloadIslandIds: z.array(z.string()),
    portOverrides: z.record(z.string(), portOverrideSchema),
    distanceOverrides: z.array(
      z.object({ from: z.string(), to: z.string(), distance: z.number().nonnegative() }),
    ),
  }),
});

function limitar(valor: number, min: number, max: number): number {
  if (!Number.isFinite(valor)) return min;
  return Math.min(Math.max(valor, min), max);
}

/** Formato antigo, ainda presente em configurações salvas antes. */
interface ConfiguracaoAntiga {
  barter?: Partial<AppSettings['barter']> & { levelReductionOverride?: number | null };
  ship?: Partial<AppSettings['ship']> & { maxWeightLt?: number; slots?: number };
}

/**
 * Normaliza configurações vindas do disco ou dos campos da UI: limita faixas
 * (redução de 0 a 100%, peso e slots positivos), completa campos ausentes com
 * os padrões e aceita o formato salvo pelas versões anteriores.
 */
export function normalizeSettings(entrada: unknown): AppSettings {
  const bruto = (entrada ?? {}) as Omit<Partial<AppSettings>, 'barter' | 'ship'> &
    ConfiguracaoAntiga;
  const barter = { ...DEFAULT_SETTINGS.barter, ...bruto.barter };
  const route = { ...DEFAULT_SETTINGS.route, ...bruto.route };

  // `levelReductionOverride` era o nome do campo antes de o nível virar só a %.
  const reducaoSalva =
    bruto.barter?.levelReduction ??
    bruto.barter?.levelReductionOverride ??
    DEFAULT_SETTINGS.barter.levelReduction;
  const pesoSalvo = bruto.ship?.freeWeightLt ?? bruto.ship?.maxWeightLt;
  const slotsSalvos = bruto.ship?.freeSlots ?? bruto.ship?.slots;
  const marinheiros = (Array.isArray(bruto.ship?.sailorsLt) ? bruto.ship.sailorsLt : []).map(
    (peso) =>
      typeof peso === 'number' && Number.isFinite(peso) && peso > 0
        ? Math.min(peso, 100_000)
        : PESO_PADRAO_MARINHEIRO_LT,
  );
  const pesoMarinheiros = marinheiros.reduce((total, peso) => total + peso, 0);
  // Configurações antigas não tinham capacidade total: o peso livre salvo serve de ponto de partida.
  const pesoTotal = Math.max(
    limitar(
      bruto.ship?.totalWeightLt ?? pesoSalvo ?? DEFAULT_SETTINGS.ship.totalWeightLt,
      1,
      Number.MAX_SAFE_INTEGER,
    ),
    pesoMarinheiros + 1,
  );
  // O peso livre não é mais informado: é a capacidade total menos os marinheiros.
  const pesoLivre = pesoTotal - pesoMarinheiros;
  const modoSobrepeso: AppSettings['ship']['overweightMode'] =
    bruto.ship?.overweightMode === 'qualquer' ? 'qualquer' : 'transferencia';

  return {
    barter: {
      ...barter,
      levelReduction: limitar(reducaoSalva ?? 0, 0, 1),
      viceCaptainPercent: limitar(barter.viceCaptainPercent, 0, 100),
    },
    ship: {
      freeWeightLt: pesoLivre,
      freeSlots: Math.trunc(limitar(slotsSalvos ?? DEFAULT_SETTINGS.ship.freeSlots, 1, 1000)),
      totalWeightLt: pesoTotal,
      sailorsLt: marinheiros,
      allowOverweight: bruto.ship?.allowOverweight === true,
      overweightMode: modoSobrepeso,
      // Configurações salvas antes da venda de T7 ficam com o padrão (ligado).
      sellT7:
        typeof bruto.ship?.sellT7 === 'boolean' ? bruto.ship.sellT7 : DEFAULT_SETTINGS.ship.sellT7,
    },
    route: {
      baseIslandId: route.baseIslandId ?? null,
      unloadIslandIds: [...new Set(route.unloadIslandIds ?? [])],
      portOverrides: route.portOverrides ?? {},
      distanceOverrides: route.distanceOverrides ?? [],
    },
  };
}
