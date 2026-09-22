import { REFRESH_VOUCHER_VALUE } from '../../../core/data/tierRules';
import { useDataStore } from '../../../store/dataStore';
import { Modal } from '../../components/Modal';
import { descreverTroca } from '../../describe';
import { fmtInteiro } from '../../format';
import { useIlhas } from '../../hooks/useIlhas';
import type { CadeiaDoPlano } from '../../hooks/useCadeia';

/**
 * Confirmação exibida ANTES de calcular a rota quando o plano gasta mais
 * barganha do que o usuário tem disponível.
 */
export function ModalLimiteBarganha({
  cadeia,
  onCancelar,
  onContinuar,
}: {
  cadeia: CadeiaDoPlano;
  onCancelar: () => void;
  onContinuar: () => void;
}) {
  const items = useDataStore((s) => s.items);
  const ilhas = useIlhas();
  const { barganha } = cadeia;
  const indice = barganha.indicePassoQueEstoura;
  const passo = indice === null ? null : barganha.passos[indice];
  const troca = passo ? cadeia.trades.find((t) => t.id === passo.tradeId) : undefined;

  return (
    <Modal
      titulo="A barganha do plano passa do disponível"
      onFechar={onCancelar}
      acoes={
        <>
          <button
            type="button"
            onClick={onCancelar}
            className="rounded border border-mar px-3 py-1.5 text-sm text-slate-300 hover:bg-mar/40"
          >
            Voltar e ajustar
          </button>
          <button
            type="button"
            onClick={onContinuar}
            className="rounded bg-ouro px-3 py-1.5 text-sm font-semibold text-abismo"
          >
            Continuar mesmo assim
          </button>
        </>
      }
    >
      <p>
        O plano precisa de <strong className="text-ouro">{fmtInteiro(barganha.total)}</strong> de
        barganha e você tem <strong>{fmtInteiro(barganha.disponivel)}</strong> — excede em{' '}
        <strong className="text-red-300">{fmtInteiro(barganha.excedente)}</strong>.
      </p>

      {troca && passo ? (
        <p>
          A barganha acaba no passo <strong>{(indice ?? 0) + 1}</strong>:{' '}
          {descreverTroca(troca, items, ilhas)} — dá para fazer{' '}
          <strong>{passo.trocasCobertas}</strong> de <strong>{troca.plannedTrades}</strong> trocas.
        </p>
      ) : null}

      <p>
        Seriam necessários{' '}
        <strong className="text-ouro">{fmtInteiro(barganha.vouchersNecessarios)}</strong>{' '}
        refresh(es) de barganha (+{fmtInteiro(REFRESH_VOUCHER_VALUE)} cada) para cobrir o excedente.
      </p>
    </Modal>
  );
}
