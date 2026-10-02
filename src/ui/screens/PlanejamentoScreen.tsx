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
      {importando ? <ModalImportarPrints onFechar={() => setImportando(false)} /> : null}

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
