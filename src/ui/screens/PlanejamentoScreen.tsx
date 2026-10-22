import { useState } from 'react';
import { usePlanStore } from '../../store/planStore';
import { Aviso } from '../components/controls';
import { useCadeia } from '../hooks/useCadeia';
import { Diagnosticos } from './planejamento/Diagnosticos';
import { FormularioTroca } from './planejamento/FormularioTroca';
import { ModalImportarPrints } from './planejamento/importacao/ModalImportarPrints';
import { ListaCompras } from './planejamento/ListaCompras';
import { PainelBalanco } from './planejamento/PainelBalanco';
import { PainelBarganha } from './planejamento/PainelBarganha';
import { PainelFaltas } from './planejamento/PainelFaltas';
import { TabelaTrocas } from './planejamento/TabelaTrocas';

export function PlanejamentoScreen() {
  const cadeia = useCadeia();
  const erroPersistencia = usePlanStore((s) => s.erroPersistencia);
  const [importando, setImportando] = useState(false);
  const [importadas, setImportadas] = useState<number | null>(null);

  return (
    <div className="space-y-5">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setImportando(true)}
          className="rounded border border-ouro px-3 py-1.5 text-sm text-ouro hover:bg-ouro/10"
        >
          Importar de prints
        </button>
      </div>
      {importando ? (
        <ModalImportarPrints
          onFechar={() => setImportando(false)}
          onImportar={(quantidade) => {
            setImportando(false);
            setImportadas(quantidade);
          }}
        />
      ) : null}
      {importadas !== null ? (
        <div className="flex items-start justify-between gap-3 rounded border border-emerald-500/50 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-100">
          <span>
            {importadas} troca{importadas === 1 ? '' : 's'} importada{importadas === 1 ? '' : 's'}{' '}
            das prints. Elas estão na tabela “Trocas do plano” abaixo.
          </span>
          <button
            type="button"
            onClick={() => setImportadas(null)}
            aria-label="Fechar aviso"
            className="text-emerald-300 hover:text-emerald-100"
          >
            ✕
          </button>
        </div>
      ) : null}

      {erroPersistencia ? (
        <Aviso tipo="aviso">O plano não está sendo salvo em disco: {erroPersistencia}</Aviso>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <FormularioTroca />
        <PainelBarganha cadeia={cadeia} />
      </div>

      <TabelaTrocas />
      <PainelFaltas cadeia={cadeia} />
      <Diagnosticos cadeia={cadeia} />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <PainelBalanco cadeia={cadeia} />
        <ListaCompras cadeia={cadeia} />
      </div>
    </div>
  );
}
