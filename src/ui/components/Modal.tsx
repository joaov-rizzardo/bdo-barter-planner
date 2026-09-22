import { useEffect, type ReactNode } from 'react';

export function Modal({
  titulo,
  children,
  acoes,
  onFechar,
  tamanho = 'md',
}: {
  titulo: string;
  children: ReactNode;
  acoes?: ReactNode;
  onFechar: () => void;
  tamanho?: 'md' | 'lg';
}) {
  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onFechar();
    };
    window.addEventListener('keydown', aoTeclar);
    return () => window.removeEventListener('keydown', aoTeclar);
  }, [onFechar]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={titulo}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onFechar();
      }}
    >
      <div
        className={`flex max-h-[85vh] w-full flex-col rounded-lg border border-mar bg-casco p-5 shadow-xl ${
          tamanho === 'lg' ? 'max-w-3xl' : 'max-w-lg'
        }`}
      >
        <div className="flex items-start justify-between gap-4">
          <h2 className="text-base font-semibold text-slate-100">{titulo}</h2>
          <button
            type="button"
            onClick={onFechar}
            aria-label="Fechar"
            className="text-slate-500 hover:text-slate-200"
          >
            ✕
          </button>
        </div>
        <div className="mt-3 flex min-h-0 flex-1 flex-col space-y-3 text-sm text-slate-300">
          {children}
        </div>
        {acoes ? <div className="mt-5 flex flex-wrap justify-end gap-2">{acoes}</div> : null}
      </div>
    </div>
  );
}
