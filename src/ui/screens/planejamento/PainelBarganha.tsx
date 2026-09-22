import { useState } from 'react';
import { reducaoTotal } from '../../../core/barter/cost';
import { useSettingsStore } from '../../../store/settingsStore';
import { useUiStore } from '../../../store/uiStore';
import { Aviso, Section } from '../../components/controls';
import { fmtInteiro, fmtPorcentagem } from '../../format';
import type { CadeiaDoPlano } from '../../hooks/useCadeia';
import { ModalLimiteBarganha } from './ModalLimiteBarganha';

export function PainelBarganha({ cadeia }: { cadeia: CadeiaDoPlano }) {
  const barter = useSettingsStore((s) => s.settings.barter);
  const irPara = useUiStore((s) => s.irPara);
  const [modalAberto, setModalAberto] = useState(false);
  const { barganha } = cadeia;
  const excede = barganha.excedente > 0;
  const proporcao = barganha.disponivel > 0 ? barganha.total / barganha.disponivel : 0;

  const seguirParaRoteiro = () => {
    if (excede) setModalAberto(true);
    else irPara('roteiro');
  };

  return (
    <Section
      titulo="Barganha do plano"
      descricao={`Redução aplicada: ${fmtPorcentagem(reducaoTotal(barter))}.`}
    >
      <div className="grid gap-3 sm:grid-cols-3">
        <Indicador rotulo="Total do plano" valor={fmtInteiro(barganha.total)} destaque={excede} />
        <Indicador rotulo="Disponível" valor={fmtInteiro(barganha.disponivel)} />
        <Indicador
          rotulo={excede ? 'Excedente' : 'Restante'}
          valor={fmtInteiro(excede ? barganha.excedente : barganha.restante)}
          destaque={excede}
        />
      </div>

      <div className="h-2 overflow-hidden rounded bg-abismo">
        <div
          className={`h-full ${excede ? 'bg-red-500' : 'bg-ouro'}`}
          style={{ width: `${Math.min(proporcao, 1) * 100}%` }}
        />
      </div>

      {excede ? (
        <Aviso tipo="erro">
          Faltam {fmtInteiro(barganha.excedente)} de barganha —{' '}
          {fmtInteiro(barganha.vouchersNecessarios)} refresh(es) de +250.000 cobririam o plano.
        </Aviso>
      ) : null}

      <div>
        <button
          type="button"
          onClick={seguirParaRoteiro}
          disabled={cadeia.trades.length === 0}
          className="rounded border border-ouro px-4 py-1.5 text-sm font-semibold text-ouro disabled:opacity-40"
        >
          Calcular rota
        </button>
      </div>

      {modalAberto ? (
        <ModalLimiteBarganha
          cadeia={cadeia}
          onCancelar={() => setModalAberto(false)}
          onContinuar={() => {
            setModalAberto(false);
            irPara('roteiro');
          }}
        />
      ) : null}
    </Section>
  );
}

function Indicador({
  rotulo,
  valor,
  destaque,
}: {
  rotulo: string;
  valor: string;
  destaque?: boolean;
}) {
  return (
    <div className="rounded border border-mar bg-abismo/60 p-3">
      <p className="text-xs uppercase text-slate-500">{rotulo}</p>
      <p className={`text-lg font-semibold ${destaque ? 'text-red-300' : 'text-ouro'}`}>{valor}</p>
    </div>
  );
}
