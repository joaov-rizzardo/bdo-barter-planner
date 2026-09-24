import { CROW_COIN_BASE_COST, CROW_COIN_MAX_TRADES, TIER_RULES } from '../data/tierRules';
import type { BarterRoute, Tier } from '../models/types';

/** Barganha base mínima plausível: valores menores vêm de rotas com dados incompletos. */
const BARGANHA_MINIMA_PLAUSIVEL = 1000;

/**
 * Máximo de trocas da rota. Algumas rotas (as de sub-grupo, por exemplo T6→T7)
 * vêm com 0 nos dados brutos; nesse caso vale o teto da tabela de tiers.
 */
export function maxTrocasEfetivo(route: BarterRoute): number {
  if (route.maxTrades > 0) return route.maxTrades;
  if (route.kind === 'crow_coin') return CROW_COIN_MAX_TRADES;
  const regra = TIER_RULES.find((r) => r.from === route.giveTier && r.to === route.receiveTier);
  return regra?.maxTrades ?? 10;
}

/** Custo base de barganha da rota, com a tabela de tiers como reserva. */
export function custoBaseEfetivo(route: BarterRoute): number {
  if (route.parleyRequired >= BARGANHA_MINIMA_PLAUSIVEL) return route.parleyRequired;
  if (route.kind === 'crow_coin') return CROW_COIN_BASE_COST;
  const regra = TIER_RULES.find((r) => r.from === route.giveTier && r.to === route.receiveTier);
  return regra?.baseBarterCost ?? 14286;
}

/** Índice das rotas de permuta por item recebido, item dado, ilha e chave. */
export class RouteIndex {
  private readonly porChave = new Map<string, BarterRoute>();
  private readonly porItemRecebido = new Map<string, BarterRoute[]>();
  private readonly porItemDado = new Map<string, BarterRoute[]>();
  private readonly porIlha = new Map<string, BarterRoute[]>();

  constructor(routes: readonly BarterRoute[]) {
    for (const rota of routes) {
      this.porChave.set(rota.key, rota);
      push(this.porItemRecebido, rota.receiveItemId, rota);
      push(this.porItemDado, rota.giveItemId, rota);
      push(this.porIlha, rota.islandId, rota);
    }
  }

  byKey(key: string): BarterRoute | undefined {
    return this.porChave.get(key);
  }

  /** Rotas que produzem o item informado. */
  produzindo(itemId: string): readonly BarterRoute[] {
    return this.porItemRecebido.get(itemId) ?? [];
  }

  /** Rotas que consomem o item informado. */
  consumindo(itemId: string): readonly BarterRoute[] {
    return this.porItemDado.get(itemId) ?? [];
  }

  naIlha(islandId: string): readonly BarterRoute[] {
    return this.porIlha.get(islandId) ?? [];
  }

  /** Rotas de subida de tier que produzem o item (as usadas no encadeamento). */
  produzindoTier(itemId: string): readonly BarterRoute[] {
    return this.produzindo(itemId).filter((r) => r.kind === 'tier');
  }

  /** Ilhas que oferecem a troca do item dado pelo item recebido. */
  ilhasPara(giveItemId: string, receiveItemId: string): readonly BarterRoute[] {
    return this.consumindo(giveItemId).filter((r) => r.receiveItemId === receiveItemId);
  }

  /** Verdadeiro se existe qualquer rota de tier produzindo o item. */
  temOrigem(itemId: string): boolean {
    return this.produzindoTier(itemId).length > 0;
  }

  tiersDeEntradaPara(itemId: string): Tier[] {
    const tiers = new Set<Tier>();
    for (const rota of this.produzindoTier(itemId)) {
      if (rota.giveTier) tiers.add(rota.giveTier);
    }
    return [...tiers];
  }
}

function push<T>(mapa: Map<string, T[]>, chave: string, valor: T): void {
  const atual = mapa.get(chave);
  if (atual) atual.push(valor);
  else mapa.set(chave, [valor]);
}
