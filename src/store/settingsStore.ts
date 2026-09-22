import { create } from 'zustand';
import { DEFAULT_SETTINGS, normalizeSettings } from '../core/settings/defaults';
import type {
  AppSettings,
  BarterSettings,
  PortOverride,
  RouteSettings,
  ShipSettings,
} from '../core/models/types';
import { getStore, mensagemDeErro } from './persistence';

const CHAVE = 'settings';

interface SettingsState {
  settings: AppSettings;
  carregado: boolean;
  erroPersistencia: string | null;
  hydrate: () => Promise<void>;
  setBarter: (patch: Partial<BarterSettings>) => void;
  setShip: (patch: Partial<ShipSettings>) => void;
  setRoute: (patch: Partial<RouteSettings>) => void;
  setPortOverride: (islandId: string, patch: PortOverride) => void;
  limparPortOverride: (islandId: string) => void;
  resetar: () => void;
}

export const useSettingsStore = create<SettingsState>((set, get) => {
  /** Grava as configurações sem travar a UI; falha de disco vira aviso. */
  const persistir = (settings: AppSettings) => {
    void getStore()
      .then((store) => store.set(CHAVE, settings))
      .then(() => set({ erroPersistencia: null }))
      .catch((erro) => set({ erroPersistencia: mensagemDeErro(erro) }));
  };

  const aplicar = (parcial: Partial<AppSettings>) => {
    const settings = normalizeSettings({ ...get().settings, ...parcial });
    set({ settings });
    persistir(settings);
  };

  return {
    settings: DEFAULT_SETTINGS,
    carregado: false,
    erroPersistencia: null,

    hydrate: async () => {
      try {
        const store = await getStore();
        const salvo = await store.get<unknown>(CHAVE);
        set({ settings: normalizeSettings(salvo ?? DEFAULT_SETTINGS), carregado: true });
      } catch (erro) {
        set({ carregado: true, erroPersistencia: mensagemDeErro(erro) });
      }
    },

    setBarter: (patch) => aplicar({ barter: { ...get().settings.barter, ...patch } }),
    setShip: (patch) => aplicar({ ship: { ...get().settings.ship, ...patch } }),
    setRoute: (patch) => aplicar({ route: { ...get().settings.route, ...patch } }),

    setPortOverride: (islandId, patch) => {
      const { route } = get().settings;
      aplicar({
        route: {
          ...route,
          portOverrides: {
            ...route.portOverrides,
            [islandId]: { ...route.portOverrides[islandId], ...patch },
          },
        },
      });
    },

    limparPortOverride: (islandId) => {
      const { route } = get().settings;
      const portOverrides = { ...route.portOverrides };
      delete portOverrides[islandId];
      aplicar({ route: { ...route, portOverrides } });
    },

    resetar: () => {
      set({ settings: DEFAULT_SETTINGS });
      persistir(DEFAULT_SETTINGS);
    },
  };
});
