import { custoPorTroca } from '../../../core/barter/cost';
import { usePlanStore } from '../../../store/planStore';
import { useSettingsStore } from '../../../store/settingsStore';
import { Aviso, Section, TextButton, Toggle } from '../../components/controls';
import { ItemBadge } from '../../components/ItemBadge';
import { nomeDaIlha } from '../../describe';
import { fmtInteiro } from '../../format';
import { useIlhas } from '../../hooks/useIlhas';

export function TabelaTrocas() {
  const trades = usePlanStore((s) => s.trades);
  const atualizar = usePlanStore((s) => s.atualizar);
  const remover = usePlanStore((s) => s.remover);
  const limpar = usePlanStore((s) => s.limpar);
  const barter = useSettingsStore((s) => s.settings.barter);
  const ilhas = useIlhas();

  return (
    <Section
      titulo={`Trocas do plano (${trades.length})`}
      descricao="Edite trocas e estoque direto na tabela."
    >
      {trades.length === 0 ? (
        <Aviso tipo="info">Nenhuma troca adicionada ainda.</Aviso>
      ) : (
        <div className="overflow-x-auto rounded border border-mar">
          <table className="w-full text-sm">
            <thead className="bg-mar/60 text-left text-xs uppercase text-slate-300">
              <tr>
                <th className="px-3 py-2">Porto</th>
                <th className="px-3 py-2">Entrega</th>
                <th className="px-3 py-2">Recebe</th>
                <th className="px-3 py-2">Por troca</th>
                <th className="px-3 py-2">Trocas</th>
                <th className="px-3 py-2">Restantes</th>
                <th className="px-3 py-2">Estoque</th>
                <th className="px-3 py-2 text-right">Barganha</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {trades.map((t) => (
                <tr key={t.id} className="border-t border-mar/40 odd:bg-abismo/40">
                  <td className="px-3 py-2">{nomeDaIlha(t.islandId, ilhas)}</td>
                  <td className="px-3 py-2">
                    <ItemBadge
                      itemId={t.inputItemId}
                      quantidade={t.inputQtyPerTrade * t.plannedTrades}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <ItemBadge
                      itemId={t.outputItemId}
                      quantidade={t.outputQtyPerTrade * t.plannedTrades}
                    />
                  </td>
                  <td className="px-3 py-2 text-slate-400">
                    {t.inputQtyPerTrade}:{t.outputQtyPerTrade}
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      min={1}
                      max={t.remainingTrades}
                      value={t.plannedTrades}
                      onChange={(e) =>
                        atualizar(t.id, { plannedTrades: Math.max(1, e.target.valueAsNumber || 1) })
                      }
                      className="w-16 rounded border border-mar bg-abismo px-2 py-1 text-sm"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      min={0}
                      value={t.remainingTrades}
                      onChange={(e) =>
                        atualizar(t.id, {
                          remainingTrades: Math.max(0, e.target.valueAsNumber || 0),
                        })
                      }
                      className="w-16 rounded border border-mar bg-abismo px-2 py-1 text-sm"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <Toggle
                      checked={t.hasStock}
                      onChange={(v) => atualizar(t.id, { hasStock: v })}
                    />
                  </td>
                  <td className="px-3 py-2 text-right">
                    {fmtInteiro(custoPorTroca(t.baseBarterCost, barter) * t.plannedTrades)}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button
                      type="button"
                      onClick={() => remover(t.id)}
                      className="text-xs text-red-300 underline hover:text-red-200"
                    >
                      remover
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {trades.some((t) => t.plannedTrades > t.remainingTrades) ? (
        <Aviso tipo="aviso">
          Há trocas planejadas acima das trocas restantes informadas — confira a coluna Trocas.
        </Aviso>
      ) : null}

      {trades.length > 0 ? (
        <div className="flex justify-end">
          <TextButton variante="perigo" onClick={limpar}>
            Limpar plano
          </TextButton>
        </div>
      ) : null}
    </Section>
  );
}
