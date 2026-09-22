import { z } from 'zod';
import type { AppSettings } from '../models/types';

/**
 * Padrões do app. Peso e slots são a capacidade **livre** do navio do usuário:
 * os valores abaixo são só um ponto de partida e devem ser ajustados.
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
    allowOverweight: false,
    overweightMode: 'transferencia',
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
    allowOverweight: z.boolean(),
    overweightMode: z.enum(['qualquer', 'transferencia']),
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
  const pesoLivre = limitar(
    pesoSalvo ?? DEFAULT_SETTINGS.ship.freeWeightLt,
    1,
    Number.MAX_SAFE_INTEGER,
  );
  // A capacidade total nunca é menor que o espaço livre informado.
  const pesoTotal = Math.max(
    limitar(bruto.ship?.totalWeightLt ?? pesoLivre, 1, Number.MAX_SAFE_INTEGER),
    pesoLivre,
  );
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
      allowOverweight: bruto.ship?.allowOverweight === true,
      overweightMode: modoSobrepeso,
    },
    route: {
      baseIslandId: route.baseIslandId ?? null,
      unloadIslandIds: [...new Set(route.unloadIslandIds ?? [])],
      portOverrides: route.portOverrides ?? {},
      distanceOverrides: route.distanceOverrides ?? [],
    },
  };
}
