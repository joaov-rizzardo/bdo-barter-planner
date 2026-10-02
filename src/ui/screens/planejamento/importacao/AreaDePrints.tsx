import { useEffect, useRef, useState } from 'react';
import type { PrintNaFila } from '../../../hooks/useLeitorDePrints';

/** Imagens que vieram no Ctrl+V (print tirada no PC fica na área de transferência). */
function imagensDaAreaDeTransferencia(dados: DataTransfer | null): File[] {
  return [...(dados?.items ?? [])]
    .filter((item) => item.kind === 'file' && item.type.startsWith('image/'))
    .map((item) => item.getAsFile())
    .filter((arquivo): arquivo is File => arquivo !== null);
}

const ROTULO_DO_ESTADO: Record<PrintNaFila['estado'], string> = {
  pendente: 'Aguardando leitura',
  lendo: 'Lendo…',
  pronta: '',
  erro: 'Erro na leitura',
};

/**
 * Onde o usuário junta as prints: botão de arquivos, Ctrl+V em qualquer lugar
 * do modal e arrastar e soltar. Mostra cada print em miniatura com o estado.
 */
export function AreaDePrints({
  prints,
  lendo,
  onAdicionar,
  onRemover,
}: {
  prints: readonly PrintNaFila[];
  lendo: boolean;
  onAdicionar: (arquivos: Blob[], colada?: boolean) => number;
  onRemover: (id: string) => void;
}) {
  const entrada = useRef<HTMLInputElement>(null);
  const [arrastando, setArrastando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  useEffect(() => {
    const aoColar = (e: ClipboardEvent) => {
      const imagens = imagensDaAreaDeTransferencia(e.clipboardData);
      if (imagens.length === 0) {
        // Texto colado num campo segue normal; só avisa quando não veio nada.
        if (!e.clipboardData?.types.includes('text/plain')) {
          setAviso('A área de transferência não tem imagem. Tire a print e cole de novo.');
        }
        return;
      }
      e.preventDefault();
      setAviso(null);
      onAdicionar(imagens, true);
    };
    window.addEventListener('paste', aoColar);
    return () => window.removeEventListener('paste', aoColar);
  }, [onAdicionar]);

  const receberArquivos = (lista: FileList | null) => {
    const arquivos = [...(lista ?? [])];
    const aceitos = onAdicionar(arquivos);
    setAviso(
      aceitos < arquivos.length
        ? 'Só imagens são aceitas; os outros arquivos ficaram de fora.'
        : null,
    );
  };

  return (
    <div className="space-y-3">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setArrastando(true);
        }}
        onDragLeave={() => setArrastando(false)}
        onDrop={(e) => {
          e.preventDefault();
          setArrastando(false);
          receberArquivos(e.dataTransfer.files);
        }}
        className={`flex flex-col items-center gap-2 rounded-lg border-2 border-dashed px-4 py-6 text-center ${
          arrastando ? 'border-ouro bg-ouro/10' : 'border-mar'
        }`}
      >
        <p className="text-slate-200">
          Cole uma print com <kbd className="rounded border border-mar px-1.5 text-xs">Ctrl</kbd>+
          <kbd className="rounded border border-mar px-1.5 text-xs">V</kbd>, arraste imagens para cá
          ou
        </p>
        <button
          type="button"
          onClick={() => entrada.current?.click()}
          className="rounded border border-ouro px-3 py-1.5 text-sm text-ouro hover:bg-ouro/10"
        >
          Escolher arquivos
        </button>
        <input
          ref={entrada}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => {
            receberArquivos(e.target.files);
            e.target.value = '';
          }}
        />
        <p className="text-xs text-slate-500">
          Use prints da janela “Informações de Permuta”, com a lista de trocas visível.
        </p>
      </div>

      {aviso ? <p className="text-xs text-amber-200">{aviso}</p> : null}

      {prints.length > 0 ? (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {prints.map((p) => (
            <li key={p.id} className="overflow-hidden rounded border border-mar bg-abismo/60">
              <img src={p.url} alt={p.nome} className="h-28 w-full bg-black object-contain" />
              <div className="flex items-start justify-between gap-2 px-2 py-1.5">
                <div className="min-w-0">
                  <p className="truncate text-xs text-slate-200" title={p.nome}>
                    {p.nome}
                  </p>
                  <p
                    className={`text-xs ${
                      p.estado === 'erro'
                        ? 'text-red-300'
                        : p.estado === 'pronta'
                          ? 'text-emerald-300'
                          : 'text-slate-500'
                    }`}
                    title={p.erro}
                  >
                    {p.estado === 'pronta'
                      ? `${p.resultado?.trocas.length ?? 0} troca(s) encontrada(s)`
                      : ROTULO_DO_ESTADO[p.estado]}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={lendo}
                  onClick={() => onRemover(p.id)}
                  aria-label={`Remover ${p.nome}`}
                  className="text-slate-500 hover:text-red-300 disabled:opacity-30"
                >
                  ✕
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
