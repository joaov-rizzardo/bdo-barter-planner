import { useCallback, useEffect, useRef, useState } from 'react';
import type { ResultadoDaPrint } from '../../core/ocr/pipeline';
import { criarLeitorDePrints, type LeitorDePrints } from '../ocr/leitorNavegador';

export type EstadoDaPrint = 'pendente' | 'lendo' | 'pronta' | 'erro';

export interface PrintNaFila {
  id: string;
  /** Nome do arquivo, ou "Print colada N" para o que veio do Ctrl+V. */
  nome: string;
  arquivo: Blob;
  /** URL da miniatura (liberada ao remover a print ou fechar o modal). */
  url: string;
  estado: EstadoDaPrint;
  resultado?: ResultadoDaPrint | undefined;
  erro?: string | undefined;
}

let sequencia = 0;

const mensagemDeErro = (erro: unknown) =>
  erro instanceof Error ? erro.message : 'Não foi possível ler esta imagem.';

/**
 * Fila de prints da importação: adicionar (arquivo ou colada), remover e ler
 * todas, uma por vez, com um único worker do tesseract reaproveitado. O worker
 * e as miniaturas são liberados quando o componente sai da tela.
 */
export function useLeitorDePrints() {
  const [prints, setPrints] = useState<PrintNaFila[]>([]);
  const [lendo, setLendo] = useState(false);
  /** Posição no lote em leitura ("print 2 de 3"); `null` fora da leitura. */
  const [progresso, setProgresso] = useState<{ atual: number; total: number } | null>(null);
  const leitor = useRef<LeitorDePrints | null>(null);
  const urls = useRef(new Set<string>());
  const coladas = useRef(0);

  useEffect(() => {
    const abertas = urls.current;
    return () => {
      void leitor.current?.encerrar();
      leitor.current = null;
      for (const url of abertas) URL.revokeObjectURL(url);
      abertas.clear();
    };
  }, []);

  const atualizar = (id: string, patch: Partial<PrintNaFila>) =>
    setPrints((atuais) => atuais.map((p) => (p.id === id ? { ...p, ...patch } : p)));

  /** Só entram imagens; o que veio colado ganha um nome numerado. */
  const adicionar = useCallback((arquivos: readonly Blob[], colada = false) => {
    const novas = arquivos
      .filter((a) => a.type.startsWith('image/'))
      .map((arquivo): PrintNaFila => {
        const url = URL.createObjectURL(arquivo);
        urls.current.add(url);
        const nome =
          !colada && arquivo instanceof File && arquivo.name
            ? arquivo.name
            : `Print colada ${(coladas.current += 1)}`;
        return { id: `p${(sequencia += 1)}`, nome, arquivo, url, estado: 'pendente' };
      });
    if (novas.length > 0) setPrints((atuais) => [...atuais, ...novas]);
    return novas.length;
  }, []);

  const remover = useCallback((id: string) => {
    setPrints((atuais) => {
      const alvo = atuais.find((p) => p.id === id);
      if (alvo) {
        URL.revokeObjectURL(alvo.url);
        urls.current.delete(alvo.url);
      }
      return atuais.filter((p) => p.id !== id);
    });
  }, []);

  /** Lê, em ordem, as prints que ainda não foram lidas (ou que deram erro). */
  const lerTodas = useCallback(async (fila: readonly PrintNaFila[]) => {
    const aLer = fila.filter((p) => p.estado === 'pendente' || p.estado === 'erro');
    if (aLer.length === 0) return;
    setLendo(true);
    const atual = (leitor.current ??= criarLeitorDePrints());
    try {
      for (const [i, print] of aLer.entries()) {
        setProgresso({ atual: i + 1, total: aLer.length });
        atualizar(print.id, { estado: 'lendo', erro: undefined });
        try {
          const resultado = await atual.ler(print.arquivo);
          atualizar(print.id, { estado: 'pronta', resultado });
        } catch (erro) {
          atualizar(print.id, { estado: 'erro', erro: mensagemDeErro(erro) });
        }
      }
    } finally {
      setLendo(false);
      setProgresso(null);
    }
  }, []);

  return { prints, lendo, progresso, adicionar, remover, lerTodas };
}
