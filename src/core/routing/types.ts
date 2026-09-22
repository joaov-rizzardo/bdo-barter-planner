import type { CargoLimits, ItemQty } from '../cargo/cargo';
import type { ItemIndex } from '../models/itemIndex';
import type { Trade } from '../models/types';
import type { DistanceProvider } from './distance';

export interface RouteContext {
  baseIslandId: string;
  limits: CargoLimits;
  items: ItemIndex;
  distances: DistanceProvider;
}

/** Um passo do roteiro, já com o estado do navio depois de executá-lo. */
export type TripStep =
  | { kind: 'load'; islandId: string; items: ItemQty[]; weightLt: number; slots: number }
  | {
      kind: 'sail';
      fromIslandId: string;
      islandId: string;
      distance: number;
      weightLt: number;
      slots: number;
    }
  | {
      kind: 'trade';
      islandId: string;
      tradeId: string;
      times: number;
      input: ItemQty;
      output: ItemQty;
      weightLt: number;
      slots: number;
    }
  | { kind: 'unload'; islandId: string; items: ItemQty[]; weightLt: number; slots: number };

export interface TripStop {
  islandId: string;
  tradeIds: string[];
}

export interface Trip {
  index: number;
  stops: TripStop[];
  steps: TripStep[];
  distance: number;
  loadAtBase: ItemQty[];
  unloadAtBase: ItemQty[];
  peakWeightLt: number;
  peakSlots: number;
}

export type RouteWarningCode =
  'troca_nao_cabe' | 'porto_sem_coordenada' | 'precedencia_circular' | 'base_invalida';

export interface RouteWarning {
  code: RouteWarningCode;
  message: string;
  tradeId?: string;
  islandId?: string;
}

export interface RoutePlan {
  solver: string;
  trips: Trip[];
  totalDistance: number;
  warnings: RouteWarning[];
}

/** Estratégia de roteirização — trocável sem mexer na UI. */
export interface RouteSolver {
  readonly name: string;
  solve: (trades: readonly Trade[], ctx: RouteContext) => RoutePlan;
}
