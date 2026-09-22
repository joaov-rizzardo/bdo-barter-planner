import { create } from 'zustand';
import { registrarProgresso } from '../core/progress/replan';
import { getStore, mensagemDeErro } from './persistence';

const CHAVE = 'progresso';

interface ProgressoSalvo {
  /** Trocas feitas por troca planejada (`tradeId` → quantidade). */
  trocasFeitas: Record<string, number>;
  /** Passos do roteiro marcados na checklist (`stepKey` → true). */
  passosConcluidos: Record<string, boolean>;
}

interface ProgressState extends ProgressoSalvo {
  carregado: boolean;
  erroPersistencia: string | null;
  hydrate: () => Promise<void>;
  /**
   * Marca/desmarca uma troca como feita por inteiro. O roteiro pode dividir uma
   * troca em "#estoque" + resto; o progresso é sempre somado no id original.
   */
  alternarTroca: (tradeId: string, quantidade: number, concluido: boolean) => void;
  marcarPasso: (stepKey: string, concluido: boolean) => void;
  limpar: () => void;
}

const VAZIO: ProgressoSalvo = { trocasFeitas: {}, passosConcluidos: {} };

/** Progresso do roteiro; salvo automaticamente a cada marcação. */
export const useProgressStore = create<ProgressState>((set, get) => {
  const persistir = (progresso: ProgressoSalvo) => {
    void getStore()
      .then((store) => store.set(CHAVE, progresso))
      .then(() => set({ erroPersistencia: null }))
      .catch((erro) => set({ erroPersistencia: mensagemDeErro(erro) }));
  };

  return {
    ...VAZIO,
    carregado: false,
    erroPersistencia: null,

    hydrate: async () => {
      try {
        const store = await getStore();
        const salvo = await store.get<ProgressoSalvo>(CHAVE);
        set({
          trocasFeitas: salvo?.trocasFeitas ?? {},
          passosConcluidos: salvo?.passosConcluidos ?? {},
          carregado: true,
        });
      } catch (erro) {
        set({ carregado: true, erroPersistencia: mensagemDeErro(erro) });
      }
    },

    alternarTroca: (tradeId, quantidade, concluido) => {
      const trocasFeitas = registrarProgresso(get().trocasFeitas, tradeId, quantidade, concluido);
      set({ trocasFeitas });
      persistir({ trocasFeitas, passosConcluidos: get().passosConcluidos });
    },

    marcarPasso: (stepKey, concluido) => {
      const passosConcluidos = { ...get().passosConcluidos };
      if (concluido) passosConcluidos[stepKey] = true;
      else delete passosConcluidos[stepKey];
      set({ passosConcluidos });
      persistir({ trocasFeitas: get().trocasFeitas, passosConcluidos });
    },

    limpar: () => {
      set({ ...VAZIO });
      persistir(VAZIO);
    },
  };
});
