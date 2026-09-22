import type { BarterItem, GameData, MarketMaterial, Tier } from './types';

export interface ItemInfo {
  id: string;
  /** Nome em inglês, como vem do jogo (útil para busca). */
  name: string;
  namePt: string;
  tier: Tier;
  weightLt: number;
  stacks: boolean;
  isMarketMaterial: boolean;
  icon: string | null;
}

/** Índice de consulta rápida por item, montado a partir dos dados validados. */
export class ItemIndex {
  private readonly porId = new Map<string, ItemInfo>();

  constructor(barterItems: readonly BarterItem[], marketMaterials: readonly MarketMaterial[]) {
    for (const m of marketMaterials) {
      this.porId.set(m.id, {
        id: m.id,
        name: m.name,
        namePt: m.namePt,
        tier: 'level_0',
        weightLt: m.weightLt,
        stacks: true,
        isMarketMaterial: true,
        icon: m.icon,
      });
    }
    for (const i of barterItems) {
      this.porId.set(i.id, {
        id: i.id,
        name: i.name,
        namePt: i.namePt,
        tier: i.tier,
        weightLt: i.weightLt,
        stacks: i.stacks,
        isMarketMaterial: false,
        icon: i.icon,
      });
    }
  }

  static fromGameData(data: GameData): ItemIndex {
    return new ItemIndex(data.barterItems, data.marketMaterials);
  }

  get(id: string): ItemInfo | undefined {
    return this.porId.get(id);
  }

  /** Nome em português ou um rótulo genérico para itens fora do catálogo (moedas, materiais de recompensa). */
  nameOf(id: string): string {
    return this.porId.get(id)?.namePt ?? `Item ${id}`;
  }

  /** Tier do item; `undefined` quando o item não está no catálogo. */
  tierOf(id: string): Tier | undefined {
    return this.porId.get(id)?.tier;
  }

  weightOf(id: string): number {
    return this.porId.get(id)?.weightLt ?? 0;
  }

  stacksOf(id: string): boolean {
    return this.porId.get(id)?.stacks ?? true;
  }

  isMarketMaterial(id: string): boolean {
    return this.porId.get(id)?.isMarketMaterial ?? false;
  }
}

export const TIER_ORDER: readonly Tier[] = [
  'level_0',
  'level_1',
  'level_2',
  'level_3',
  'level_4',
  'great_ocean',
  'level_5',
  'level_6',
  'level_7',
];

export function tierRank(tier: Tier | undefined): number {
  const indice = tier ? TIER_ORDER.indexOf(tier) : -1;
  return indice < 0 ? -1 : indice;
}
