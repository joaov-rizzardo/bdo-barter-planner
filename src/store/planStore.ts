import { create } from 'zustand';
import type { Trade } from '../core/models/types';
import { getStore, mensagemDeErro } from './persistence';

const CHAVE = 'plano';

/** Campos que o usuário informa ao adicionar uma troca. */
export type NovaTroca = Omit<Trade, 'id'>;

interface PlanState {
  /** Trocas informadas pelo usuário. */
  trades: Trade[];
  carregado: boolean;
  erroPersistencia: string | null;
  hydrate: () => Promise<void>;
  adicionar: (troca: NovaTroca) => string;
  atualizar: (id: string, patch: Partial<Trade>) => void;
  remover: (id: string) => void;
  limpar: () => void;
}

let sequencia = 0;
const novoId = () => `t${Date.now().toString(36)}${(sequencia += 1).toString(36)}`;

export const usePlanStore = create<PlanState>((set, get) => {
  const persistir = (trades: Trade[]) => {
    void getStore()
      .then((store) => store.set(CHAVE, trades))
      .then(() => set({ erroPersistencia: null }))
      .catch((erro) => set({ erroPersistencia: mensagemDeErro(erro) }));
  };

  const aplicar = (trades: Trade[]) => {
    set({ trades });
    persistir(trades);
  };

  return {
    trades: [],
    carregado: false,
    erroPersistencia: null,

    hydrate: async () => {
      try {
        const store = await getStore();
        const salvo = await store.get<Trade[]>(CHAVE);
        set({ trades: Array.isArray(salvo) ? salvo : [], carregado: true });
      } catch (erro) {
        set({ carregado: true, erroPersistencia: mensagemDeErro(erro) });
      }
    },

    adicionar: (troca) => {
      const id = novoId();
      aplicar([...get().trades, { ...troca, id }]);
      return id;
    },

    atualizar: (id, patch) =>
      aplicar(get().trades.map((t) => (t.id === id ? { ...t, ...patch } : t))),

    remover: (id) => aplicar(get().trades.filter((t) => t.id !== id)),

    limpar: () => aplicar([]),
  };
});
