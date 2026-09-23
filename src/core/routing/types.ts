import type { CargoLimits, ItemQty } from '../cargo/cargo';
import type { ItemIndex } from '../models/itemIndex';
import type { Trade } from '../models/types';
import type { DistanceProvider } from './distance';

export interface RouteContext {
  baseIslandId: string;
  limits: CargoLimits;
  items: ItemIndex;
  distances: DistanceProvider;
  /**
   * Portos com gerente de cais, onde dá para passar 1 slot para o inventário
   * do personagem. Vazio ou ausente: a viagem não conta com a transferência.
   */
  wharfIslandIds?: readonly string[];
  /**
   * Permite vender T7 nos gerentes de cais (`wharfIslandIds`) quando é
   * preciso aliviar o navio. Ausente ou `false`: nada é vendido.
   */
  sellT7?: boolean;
  /**
   * Peso de cada marinheiro equipado. `limits` já desconta todos eles; o
   * solver pode planejar a viagem com alguns desequipados na base quando isso
   * faz caber mais trocas. Ausente ou vazio: ninguém é desequipado.
   */
  sailorsLt?: readonly number[];
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
  | {
      kind: 'transfer';
      islandId: string;
      item: ItemQty;
      weightLt: number;
      slots: number;
    }
  | {
      kind: 'sell';
      islandId: string;
      items: ItemQty[];
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
  /** Inclui o que voltou no inventário do personagem. */
  unloadAtBase: ItemQty[];
  /** Pack de 1 slot levado no inventário do personagem (no máximo um por viagem). */
  inventory: ItemQty[];
  /** T7 vendidos no gerente de cais para aliviar o navio (não voltam à base). */
  sold: ItemQty[];
  peakWeightLt: number;
  peakSlots: number;
  /** Marinheiros a desequipar na base antes de sair (os mais pesados primeiro). */
  sailorsUnequipped: number;
  /** Peso liberado por esses marinheiros; soma-se ao peso livre da viagem. */
  sailorsUnequippedLt: number;
}

export type RouteWarningCode =
  | 'troca_nao_cabe'
  | 'porto_sem_coordenada'
  | 'precedencia_circular'
  | 'base_invalida'
  | 'sobrepeso';

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
