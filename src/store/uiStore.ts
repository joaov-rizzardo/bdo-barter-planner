import { create } from 'zustand';

export type AbaId = 'planejamento' | 'roteiro' | 'configuracoes';

interface UiState {
  aba: AbaId;
  irPara: (aba: AbaId) => void;
}

/** Aba ativa: fica fora do App para que qualquer tela possa navegar. */
export const useUiStore = create<UiState>((set) => ({
  aba: 'planejamento',
  irPara: (aba) => set({ aba }),
}));
