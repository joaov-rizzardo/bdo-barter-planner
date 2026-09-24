/**
 * Modelo de domínio do planejador de permutas. TypeScript puro: nada de React,
 * Zustand ou Tauri aqui (regra garantida pelo ESLint).
 */

/** Tiers usados pelos dados do jogo. `level_0` = bem terrestre comprado no mercado. */
export type Tier =
  | 'level_0'
  | 'level_1'
  | 'level_2'
  | 'level_3'
  | 'level_4'
  | 'level_5'
  | 'level_6'
  | 'level_7'
  | 'great_ocean';

/** Ilha ou porto onde existe um permutador (barterer). */
export interface Island {
  id: string;
  name: string;
  namePt: string;
  /** `null` em portos sem posição no mapa; a rota os ignora. */
  x: number | null;
  y: number | null;
  barterer: string | null;
  npcId: string | null;
  /** Tier de entrada aceito pelo permutador da ilha (quando conhecido). */
  sourceTier: Tier | null;
  /** Tier de saída oferecido pelo permutador da ilha (quando conhecido). */
  targetTier: Tier | null;
  hasWarehouse: boolean;
  hasWharfManager: boolean;
}

/** Item de permuta (T1–T7 e Oceano). */
export interface BarterItem {
  id: string;
  name: string;
  namePt: string;
  tier: Exclude<Tier, 'level_0'>;
  weightLt: number;
  stacks: boolean;
  icon: string | null;
}

/** Bem terrestre (T0) comprado no mercado central. */
export interface MarketMaterial {
  id: string;
  name: string;
  namePt: string;
  weightLt: number;
  icon: string | null;
}

/** Conjunto de dados carregado e validado. */
export interface GameData {
  islands: Island[];
  barterItems: BarterItem[];
  marketMaterials: MarketMaterial[];
  routes: BarterRoute[];
}

/** Rota de permuta disponível no jogo (um item por outro, em um porto). */
export interface BarterRoute {
  key: string;
  islandId: string;
  source: 'normal' | 'sub_group' | 'special';
  giveItemId: string;
  giveTier: Tier | null;
  giveQty: number;
  receiveItemId: string;
  receiveTier: Tier | null;
  receiveQtyMin: number;
  receiveQtyMax: number;
  parleyRequired: number;
  maxTrades: number;
  /** `tier` sobe um degrau, `crow_coin` troca por Moedas do Corvo, `outro` dá materiais. */
  kind: 'tier' | 'crow_coin' | 'outro';
}

/** Uma troca planejada pelo usuário. */
export interface Trade {
  id: string;
  islandId: string;
  inputItemId: string;
  inputQtyPerTrade: number;
  outputItemId: string;
  outputQtyPerTrade: number;
  /** Trocas restantes que o jogo mostra para esse permutador. */
  remainingTrades: number;
  /** Quantas trocas o usuário quer executar neste plano. */
  plannedTrades: number;
  /** Custo base de barganha por troca (padrão vem da rota ou da tabela de tiers). */
  baseBarterCost: number;
  /**
   * O usuário já tem o item de entrada no armazém/navio. Quando `true`, a cadeia
   * não exige troca precedente nem compra no mercado para essa entrada.
   */
  hasStock: boolean;
  /** Rota do jogo que originou a troca, quando conhecida. */
  routeKey?: string;
}

/**
 * Configurações de cálculo de barganha. As reduções são sempre somadas, o custo
 * é arredondado para baixo e a barganha disponível é sempre o máximo
 * (`MAX_BARTER`), por isso só as reduções ficam configuráveis.
 */
export interface BarterSettings {
  /** Redução que vem do nível de permuta, informada à mão (fração 0–1). */
  levelReduction: number;
  economyPackage: boolean;
  viceCaptain: boolean;
  viceCaptainPercent: number;
}

/**
 * Como o sobrepeso pode ser usado quando `allowOverweight` está ligado.
 * `qualquer`: pode ficar em sobrepeso depois de uma troca e só sair dele
 * depois (transferência ou fim da viagem). `transferencia`: o sobrepeso só é
 * aceito quando a transferência de 1 slot para o inventário resolve na hora.
 */
export type OverweightMode = 'qualquer' | 'transferencia';

/** Peso padrão de um marinheiro recém-adicionado. */
export const PESO_PADRAO_MARINHEIRO_LT = 200;

/** Capacidade **livre** do navio, usada na simulação de carga. */
export interface ShipSettings {
  /**
   * Derivado, somente leitura na UI: `totalWeightLt` menos o peso dos
   * marinheiros equipados. `normalizeSettings` recalcula a cada escrita.
   */
  freeWeightLt: number;
  freeSlots: number;
  /** Capacidade **total** do navio: base do peso livre e do teto de 150% do sobrepeso. */
  totalWeightLt: number;
  /** Peso de cada marinheiro equipado (LT). Só o peso importa para o app. */
  sailorsLt: number[];
  allowOverweight: boolean;
  overweightMode: OverweightMode;
  /** Vender T7 no gerente de cais quando for preciso aliviar o navio. */
  sellT7: boolean;
}

/** Ajuste manual das informações de porto que não vêm nos dados do jogo. */
export interface PortOverride {
  hasWarehouse?: boolean;
  hasWharfManager?: boolean;
}

/** Distância fixa para um par de portos (sobrescreve a euclidiana). */
export interface DistanceOverrideSetting {
  from: string;
  to: string;
  distance: number;
}

export interface RouteSettings {
  baseIslandId: string | null;
  unloadIslandIds: string[];
  portOverrides: Record<string, PortOverride>;
  distanceOverrides: DistanceOverrideSetting[];
}

export interface AppSettings {
  barter: BarterSettings;
  ship: ShipSettings;
  route: RouteSettings;
}
