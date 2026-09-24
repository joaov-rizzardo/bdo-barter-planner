import { CROW_COIN_ID } from '../data/tierRules';
import type { BarterItem, GameData, MarketMaterial, Tier } from './types';

export interface ItemInfo {
  id: string;
  /** Nome em inglês, como vem do jogo (útil para busca). */
  name: string;
  namePt: string;
  /** `null` para moedas: não são item de permuta nem bem do mercado. */
  tier: Tier | null;
  weightLt: number;
  stacks: boolean;
  isMarketMaterial: boolean;
  /** Vai direto para o personagem ao ser recebido (Moeda Corvo): não entra no navio. */
  offShip: boolean;
  icon: string | null;
}

/** Moeda Corvo: não está nos dados brutos, entra no catálogo à mão. */
const MOEDA_CORVO: ItemInfo = {
  id: CROW_COIN_ID,
  name: 'Crow Coin',
  namePt: 'Moeda Corvo',
  tier: null,
  weightLt: 0,
  stacks: true,
  isMarketMaterial: false,
  offShip: true,
  icon: 'icons/crow_coin.webp',
};

/** Índice de consulta rápida por item, montado a partir dos dados validados. */
export class ItemIndex {
  private readonly porId = new Map<string, ItemInfo>();

  constructor(barterItems: readonly BarterItem[], marketMaterials: readonly MarketMaterial[]) {
    this.porId.set(MOEDA_CORVO.id, MOEDA_CORVO);
    for (const m of marketMaterials) {
      this.porId.set(m.id, {
        id: m.id,
        name: m.name,
        namePt: m.namePt,
        tier: 'level_0',
        weightLt: m.weightLt,
        stacks: true,
        isMarketMaterial: true,
        offShip: false,
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
        offShip: false,
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
    return this.porId.get(id)?.tier ?? undefined;
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

  /** Item que vai direto para o personagem (Moeda Corvo): nem peso nem slot no navio. */
  isOffShip(id: string): boolean {
    return this.porId.get(id)?.offShip ?? false;
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
