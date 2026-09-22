import { useState } from 'react';
import { Aviso, Section } from '../../components/controls';
import type { CadeiaDoPlano } from '../../hooks/useCadeia';

export function Diagnosticos({ cadeia }: { cadeia: CadeiaDoPlano }) {
  const [mostrarInfos, setMostrarInfos] = useState(false);
  const infos = cadeia.diagnostics.filter((d) => d.level === 'info');

  if (cadeia.trades.length === 0) return null;

  return (
    <Section titulo="Avisos e erros" descricao="Verificações da cadeia de trocas.">
      {cadeia.erros.length === 0 && cadeia.avisos.length === 0 ? (
        <Aviso tipo="info">Cadeia consistente: toda entrada tem origem.</Aviso>
      ) : null}

      {cadeia.erros.map((d, i) => (
        <Aviso key={`e${i}`} tipo="erro">
          {d.message}
        </Aviso>
      ))}
      {cadeia.avisos.map((d, i) => (
        <Aviso key={`a${i}`} tipo="aviso">
          {d.message}
        </Aviso>
      ))}

      {infos.length > 0 ? (
        <div>
          <button
            type="button"
            onClick={() => setMostrarInfos((v) => !v)}
            className="text-xs text-slate-400 underline hover:text-slate-200"
          >
            {mostrarInfos ? 'Esconder' : 'Mostrar'} {infos.length} detalhe(s) da cadeia
          </button>
          {mostrarInfos ? (
            <ul className="mt-2 space-y-1 text-sm text-slate-400">
              {infos.map((d, i) => (
                <li key={`i${i}`}>• {d.message}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </Section>
  );
}
