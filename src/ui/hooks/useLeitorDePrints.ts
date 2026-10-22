import { create } from 'zustand';
import type { ResultadoDaPrint } from '../../core/ocr/pipeline';
import { incluirLeitura, sincronizarComPlano, type ItemDeRevisao } from '../../core/ocr/revisao';
import { usePlanStore } from '../../store/planStore';
import { criarLeitorDePrints, type LeitorDePrints } from '../ocr/leitorNavegador';

export type EstadoDaPrint = 'pendente' | 'lendo' | 'pronta' | 'erro';

export interface PrintNaFila {
  id: string;
  /** Nome do arquivo, ou "Print colada N" para o que veio do Ctrl+V. */
  nome: string;
  arquivo: Blob;
  /** URL da miniatura (liberada ao remover a print ou limpar a importação). */
  url: string;
  estado: EstadoDaPrint;
  resultado?: ResultadoDaPrint | undefined;
  erro?: string | undefined;
}

interface LeitorState {
  prints: PrintNaFila[];
  lendo: boolean;
  /** Posição no lote em leitura ("print 2 de 3"); `null` fora da leitura. */
  progresso: { atual: number; total: number } | null;
  /** Trocas lidas em revisão: cresce a cada print que termina de ser lida. */
  itens: ItemDeRevisao[];
  adicionar: (arquivos: readonly Blob[], colada?: boolean) => number;
  remover: (id: string) => void;
  /** Lê, em ordem, as prints que ainda não foram lidas (ou que deram erro). */
  lerTodas: () => Promise<void>;
  setItens: (itens: ItemDeRevisao[]) => void;
  /** Reconfere "já no plano" (ver `sincronizarComPlano`). */
  sincronizar: () => void;
  /** Descarta prints e revisão, interrompe a leitura e libera o worker. */
  limpar: () => void;
}

let sequencia = 0;
let coladas = 0;
/** Muda a cada `limpar`: a leitura em andamento de antes para de gravar. */
let geracao = 0;
let leitor: LeitorDePrints | null = null;

const mensagemDeErro = (erro: unknown) =>
  erro instanceof Error ? erro.message : 'Não foi possível ler esta imagem.';

/**
 * Importação de prints: fila (adicionar, remover, ler uma por vez com um único
 * worker do tesseract) e a revisão das trocas lidas. Fica num store, e não no
 * modal, para o trabalho sobreviver ao fechar e reabrir o modal; só some com
 * `limpar` (ou ao fechar o app — nada disso é gravado).
 */
export const useLeitorDePrints = create<LeitorState>((set, get) => {
  const atualizar = (id: string, patch: Partial<PrintNaFila>) =>
    set((s) => ({ prints: s.prints.map((p) => (p.id === id ? { ...p, ...patch } : p)) }));

  return {
    prints: [],
    lendo: false,
    progresso: null,
    itens: [],

    adicionar: (arquivos, colada = false) => {
      const novas = arquivos
        .filter((a) => a.type.startsWith('image/'))
        .map((arquivo): PrintNaFila => {
          const nome =
            !colada && arquivo instanceof File && arquivo.name
              ? arquivo.name
              : `Print colada ${(coladas += 1)}`;
          return {
            id: `p${(sequencia += 1)}`,
            nome,
            arquivo,
            url: URL.createObjectURL(arquivo),
            estado: 'pendente',
          };
        });
      if (novas.length > 0) set((s) => ({ prints: [...s.prints, ...novas] }));
      return novas.length;
    },

    remover: (id) => {
      const alvo = get().prints.find((p) => p.id === id);
      if (alvo) URL.revokeObjectURL(alvo.url);
      set((s) => ({ prints: s.prints.filter((p) => p.id !== id) }));
    },

    lerTodas: async () => {
      const aLer = get().prints.filter((p) => p.estado === 'pendente' || p.estado === 'erro');
      if (aLer.length === 0 || get().lendo) return;
      const minha = geracao;
      set({ lendo: true });
      const atual = (leitor ??= criarLeitorDePrints());
      try {
        for (const [i, print] of aLer.entries()) {
          if (minha !== geracao) return;
          set({ progresso: { atual: i + 1, total: aLer.length } });
          atualizar(print.id, { estado: 'lendo', erro: undefined });
          try {
            const resultado = await atual.ler(print.arquivo);
            if (minha !== geracao) return;
            atualizar(print.id, { estado: 'pronta', resultado });
            // A troca entra na revisão assim que a print termina, sem esperar as outras.
            const plano = usePlanStore.getState().trades;
            set((s) => ({
              itens: incluirLeitura(
                s.itens,
                { origem: print.nome, trocas: resultado.trocas },
                plano,
              ),
            }));
          } catch (erro) {
            if (minha !== geracao) return;
            atualizar(print.id, { estado: 'erro', erro: mensagemDeErro(erro) });
          }
        }
      } finally {
        if (minha === geracao) set({ lendo: false, progresso: null });
      }
    },

    setItens: (itens) => set({ itens }),

    sincronizar: () =>
      set((s) => ({ itens: sincronizarComPlano(s.itens, usePlanStore.getState().trades) })),

    limpar: () => {
      geracao += 1;
      for (const p of get().prints) URL.revokeObjectURL(p.url);
      void leitor?.encerrar();
      leitor = null;
      coladas = 0;
      set({ prints: [], lendo: false, progresso: null, itens: [] });
    },
  };
});
