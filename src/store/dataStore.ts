import { create } from 'zustand';
import type { RouteIndex } from '../core/chain/routeIndex';
import type { ItemIndex } from '../core/models/itemIndex';
import type { GameData } from '../core/models/types';
import { loadGameData } from '../data';

interface DataState {
  data: GameData;
  items: ItemIndex;
  routes: RouteIndex;
}

/** Dados do jogo embutidos no app (validados uma vez em `loadGameData`). */
export const useDataStore = create<DataState>(() => loadGameData());
