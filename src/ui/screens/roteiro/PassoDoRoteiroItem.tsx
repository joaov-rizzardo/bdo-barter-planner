import type { PassoDoRoteiro } from '../../hooks/useRoteiro';
import { useProgressStore } from '../../../store/progressStore';
import { ItemBadge } from '../../components/ItemBadge';
import { nomeDaIlha } from '../../describe';
import { fmtInteiro, fmtLt } from '../../format';
import { useIlhas } from '../../hooks/useIlhas';

export function PassoDoRoteiroItem({ passo }: { passo: PassoDoRoteiro }) {
  const ilhas = useIlhas();
  const marcarPasso = useProgressStore((s) => s.marcarPasso);
  const alternarTroca = useProgressStore((s) => s.alternarTroca);
  const { step } = passo;

  const titulo = (() => {
    switch (step.kind) {
      case 'load':
        return `Carregar na base (${nomeDaIlha(step.islandId, ilhas)})`;
      case 'sail':
        return `Navegar até ${nomeDaIlha(step.islandId, ilhas)}`;
      case 'trade':
        return `${nomeDaIlha(step.islandId, ilhas)}: trocar ${step.times}×`;
      case 'transfer':
        return `${nomeDaIlha(step.islandId, ilhas)}: passar 1 slot para o inventário`;
      case 'unload':
        return `Voltar e descarregar em ${nomeDaIlha(step.islandId, ilhas)}`;
    }
  })();

  return (
    <li
      className={`flex flex-wrap items-start gap-3 border-t border-mar/40 px-3 py-2 text-sm ${
        passo.concluido ? 'opacity-50' : ''
      }`}
    >
      <input
        type="checkbox"
        className="mt-1 size-4 accent-[var(--color-ouro)]"
        checked={passo.concluido}
        aria-label={titulo}
        onChange={(e) => {
          marcarPasso(passo.key, e.target.checked);
          // Marcar o passo de uma troca assume todas as trocas dela como feitas.
          if (passo.trade) {
            alternarTroca(passo.trade.id, passo.trade.plannedTrades, e.target.checked);
          }
        }}
      />

      <div className="min-w-0 flex-1">
        <p className={passo.concluido ? 'line-through' : ''}>{titulo}</p>

        {step.kind === 'trade' ? (
          <p className="mt-1 flex flex-wrap items-center gap-2 text-slate-300">
            <ItemBadge itemId={step.input.itemId} quantidade={step.input.qty} />
            <span className="text-slate-500">→</span>
            <ItemBadge itemId={step.output.itemId} quantidade={step.output.qty} />
          </p>
        ) : null}

        {step.kind === 'transfer' ? (
          <p className="mt-1 flex flex-wrap items-center gap-2 text-slate-300">
            <ItemBadge itemId={step.item.itemId} quantidade={step.item.qty} />
            <span className="text-xs text-slate-500">
              no gerente de cais; o pack viaja com o personagem
            </span>
          </p>
        ) : null}

        {(step.kind === 'load' || step.kind === 'unload') && step.items.length > 0 ? (
          <ul className="mt-1 space-y-0.5 text-slate-300">
            {step.items.map((i) => (
              <li key={i.itemId}>
                <ItemBadge itemId={i.itemId} quantidade={i.qty} />
              </li>
            ))}
          </ul>
        ) : null}

        {step.kind === 'load' && step.items.length === 0 ? (
          <p className="mt-1 text-xs text-slate-500">Nada a carregar: o navio sai vazio.</p>
        ) : null}

        {step.kind === 'sail' ? (
          <p className="mt-1 text-xs text-slate-500">
            {fmtInteiro(Math.round(step.distance))} unidades de mapa
          </p>
        ) : null}
      </div>

      <div className="text-right text-xs text-slate-400">
        <p>{fmtLt(step.weightLt)}</p>
        <p>
          {step.slots} slot{step.slots === 1 ? '' : 's'}
        </p>
        {step.kind === 'trade' ? (
          <p className={passo.barganhaRestante < 0 ? 'text-red-300' : 'text-slate-500'}>
            barganha {fmtInteiro(passo.barganhaRestante)}
          </p>
        ) : null}
      </div>
    </li>
  );
}
