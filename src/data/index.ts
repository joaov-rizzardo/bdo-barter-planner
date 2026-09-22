import islands from './islands.json';
import barterItems from './barterItems.json';
import marketMaterials from './marketMaterials.json';
import routes from './barterRoutes.json';
import { parseGameData } from '../core/schemas/gameData';
import { ItemIndex } from '../core/models/itemIndex';
import { RouteIndex } from '../core/chain/routeIndex';
import type { GameData } from '../core/models/types';

let cache: { data: GameData; items: ItemIndex; routes: RouteIndex } | null = null;

/**
 * Carrega e valida os dados embutidos no app (gerados por `npm run data:convert`).
 * O resultado é memoizado: a validação Zod roda uma única vez.
 */
export function loadGameData(): { data: GameData; items: ItemIndex; routes: RouteIndex } {
  if (!cache) {
    const data = parseGameData({ islands, barterItems, marketMaterials, routes });
    cache = { data, items: ItemIndex.fromGameData(data), routes: new RouteIndex(data.routes) };
  }
  return cache;
}
