import { useMemo, useState } from 'react';
import { custoPorTroca } from '../../../../core/barter/cost';
import { custoBaseEfetivo, maxTrocasEfetivo } from '../../../../core/chain/routeIndex';
import type { BarterRoute } from '../../../../core/models/types';
import {
  FILTRO_TODOS,
  editarItem,
  escolherRota,
  marcarVisiveis,
  motivosParaConferir,
  passaNoFiltro,
  resumoPorDegrau,
  type ItemDeRevisao,
  type MotivoParaConferir,
  type MotivoParaPular,
} from '../../../../core/ocr/revisao';
import { useDataStore } from '../../../../store/dataStore';
import { usePlanStore } from '../../../../store/planStore';
import { useSettingsStore } from '../../../../store/settingsStore';
import { ItemBadge } from '../../../components/ItemBadge';
import { nomeDaIlha } from '../../../describe';
import { fmtInteiro } from '../../../format';
import { useIlhas } from '../../../hooks/useIlhas';

const TEXTO_PARA_CONFERIR: Record<MotivoParaConferir, string> = {
  ambigua: 'mais de uma troca combina: escolha a certa',
  confianca_baixa: 'leitura com pouca certeza',
  quantidade_nao_lida: 'confira a quantidade recebida',
  restante_nao_lido: 'restante não lido',
};

const TEXTO_PULADA: Record<MotivoParaPular, string> = {
  ambigua: 'ambígua sem troca escolhida',
  sem_restante: 'sem trocas restantes',
  ja_no_plano: 'já está no plano',
};

const campo =
  'w-16 rounded border border-mar bg-abismo px-2 py-1 text-sm text-slate-100 outline-none focus:border-ouro';

/**
 * Revisão das trocas lidas: filtro por degrau, marcação em lote (só nas
 * visíveis) e edição por troca. A barganha mostrada é sempre a calculada pelo
 * app para a rota, com as reduções das Configurações.
 */
export function RevisaoDeTrocas({
  itens,
  onMudar,
}: {
  itens: readonly ItemDeRevisao[];
  onMudar: (itens: ItemDeRevisao[]) => void;
}) {
  const items = useDataStore((s) => s.items);
  const plano = usePlanStore((s) => s.trades);
  const barter = useSettingsStore((s) => s.settings.barter);
  const ilhas = useIlhas();
  const [filtro, setFiltro] = useState(FILTRO_TODOS);
  const [aviso, setAviso] = useState<string | null>(null);
  /** Trocas confirmadas em que o usuário pediu para trocar o porto. */
  const [trocandoPorto, setTrocandoPorto] = useState<ReadonlySet<string>>(new Set());

  const opcoes = useMemo(() => resumoPorDegrau(itens, items), [itens, items]);
  // Se o filtro escolhido esvaziou (ex.: a última ambígua foi resolvida), volta para Todos.
  const filtroAtivo = opcoes.some((o) => o.chave === filtro) ? filtro : FILTRO_TODOS;
  const visiveis = itens.filter((i) => passaNoFiltro(i, filtroAtivo, items));

  const trocar = (id: string, novo: (item: ItemDeRevisao) => ItemDeRevisao) =>
    onMudar(itens.map((i) => (i.id === id ? novo(i) : i)));

  const marcarTodas = (marcar: boolean) => {
    const r = marcarVisiveis(itens, new Set(visiveis.map((i) => i.id)), marcar);
    onMudar(r.itens);
    if (!marcar || r.puladas.length === 0) {
      setAviso(null);
      return;
    }
    const porMotivo = new Map<MotivoParaPular, number>();
    for (const p of r.puladas) porMotivo.set(p.motivo, (porMotivo.get(p.motivo) ?? 0) + 1);
    setAviso(
      `${r.alteradas} marcada(s); ${r.puladas.length} ficou(aram) de fora: ` +
        [...porMotivo].map(([m, n]) => `${n} ${TEXTO_PULADA[m]}`).join(', ') +
        '. Dá para marcar uma a uma.',
    );
  };

  // A faixa ajuda a escolher: o número do ícone na print precisa caber nela.
  const descreverRota = (r: BarterRoute) =>
    `${nomeDaIlha(r.islandId, ilhas)}: ${fmtInteiro(r.giveQty)}× ${items.nameOf(r.giveItemId)} → ` +
    `${items.nameOf(r.receiveItemId)}` +
    (r.receiveQtyMin === r.receiveQtyMax
      ? ''
      : ` (recebe ${fmtInteiro(r.receiveQtyMin)}–${fmtInteiro(r.receiveQtyMax)})`);

  return (
    <div className="space-y-3">
      <nav className="flex flex-wrap gap-1" aria-label="Filtrar por degrau">
        {opcoes.map((o) => (
          <button
            key={o.chave}
            type="button"
            onClick={() => setFiltro(o.chave)}
            className={`rounded px-2.5 py-1 text-xs ${
              o.chave === filtroAtivo
                ? 'bg-mar text-white'
                : 'border border-mar text-slate-400 hover:bg-mar/40'
            }`}
          >
            {o.rotulo}
            <span className="ml-1.5 text-slate-400">
              {o.marcadas}/{o.total}
            </span>
          </button>
        ))}
      </nav>

      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="text-slate-500">{visiveis.length} troca(s) neste filtro ·</span>
        <button
          type="button"
          onClick={() => marcarTodas(true)}
          className="rounded border border-mar px-2 py-1 text-slate-300 hover:bg-mar/40"
        >
          Marcar todas
        </button>
        <button
          type="button"
          onClick={() => marcarTodas(false)}
          className="rounded border border-mar px-2 py-1 text-slate-300 hover:bg-mar/40"
        >
          Desmarcar todas
        </button>
        {aviso ? <span className="text-amber-200">{aviso}</span> : null}
      </div>

      <div className="overflow-x-auto rounded border border-mar">
        <table className="w-full text-sm">
          <thead className="bg-mar/60 text-left text-xs uppercase text-slate-300">
            <tr>
              <th className="px-2 py-2" />
              <th className="px-2 py-2">Porto</th>
              <th className="px-2 py-2">Entrega</th>
              <th className="px-2 py-2">Recebe por troca</th>
              <th className="px-2 py-2">Restantes</th>
              <th className="px-2 py-2">Trocas</th>
              <th className="px-2 py-2">Estoque</th>
              <th className="px-2 py-2 text-right">Barganha</th>
            </tr>
          </thead>
          <tbody>
            {visiveis.map((item) => {
              const { rota } = item;
              const motivos = motivosParaConferir(item);
              const faixa = rota.receiveQtyMin !== rota.receiveQtyMax;
              const teto = maxTrocasEfetivo(rota);
              return (
                <tr
                  key={item.id}
                  className={`border-t border-mar/40 align-top ${
                    item.selecionada ? 'bg-ouro/5' : 'odd:bg-abismo/40'
                  }`}
                >
                  <td className="px-2 py-2">
                    <input
                      type="checkbox"
                      aria-label={`Marcar troca em ${nomeDaIlha(rota.islandId, ilhas)}`}
                      className="size-4 accent-[var(--color-ouro)]"
                      checked={item.selecionada}
                      disabled={!item.rotaConfirmada}
                      onChange={(e) =>
                        trocar(item.id, (i) => editarItem(i, { selecionada: e.target.checked }))
                      }
                    />
                  </td>
                  <td className="max-w-56 px-2 py-2">
                    {!item.rotaConfirmada || trocandoPorto.has(item.id) ? (
                      <select
                        aria-label="Escolher a troca certa"
                        className="w-full rounded border border-amber-500/60 bg-abismo px-2 py-1 text-sm text-slate-100"
                        value={item.rotaConfirmada ? rota.key : ''}
                        onChange={(e) => {
                          const escolhida = [...item.opcoes, ...item.outrosPortos].find(
                            (r) => r.key === e.target.value,
                          );
                          if (!escolhida) return;
                          trocar(item.id, (i) => escolherRota(i, escolhida, plano));
                          setTrocandoPorto((atual) => {
                            const novo = new Set(atual);
                            novo.delete(item.id);
                            return novo;
                          });
                        }}
                      >
                        {item.rotaConfirmada ? null : (
                          <option value="">Escolha a troca certa…</option>
                        )}
                        <optgroup label="Mais prováveis">
                          {item.opcoes.map((r) => (
                            <option key={r.key} value={r.key}>
                              {descreverRota(r)}
                            </option>
                          ))}
                        </optgroup>
                        {item.outrosPortos.length > 0 ? (
                          <optgroup label="Outros portos com os mesmos itens">
                            {item.outrosPortos.map((r) => (
                              <option key={r.key} value={r.key}>
                                {descreverRota(r)}
                              </option>
                            ))}
                          </optgroup>
                        ) : null}
                      </select>
                    ) : (
                      <span className="flex items-baseline gap-2">
                        <span
                          className="min-w-0 truncate text-slate-200"
                          title={nomeDaIlha(rota.islandId, ilhas)}
                        >
                          {nomeDaIlha(rota.islandId, ilhas)}
                        </span>
                        {item.opcoes.length + item.outrosPortos.length > 1 ? (
                          <button
                            type="button"
                            onClick={() => setTrocandoPorto((atual) => new Set(atual).add(item.id))}
                            className="shrink-0 text-xs text-slate-500 underline hover:text-slate-300"
                          >
                            trocar porto
                          </button>
                        ) : null}
                      </span>
                    )}
                    <span className="block truncate text-xs text-slate-500" title={item.origem}>
                      {item.origem}
                    </span>
                    {motivos.map((m) => (
                      <span key={m} className="block text-xs text-amber-200">
                        ⚠ {TEXTO_PARA_CONFERIR[m]}
                      </span>
                    ))}
                    {item.jaNoPlano ? (
                      <span className="block text-xs text-sky-300">já está no plano</span>
                    ) : null}
                    {item.remainingTrades <= 0 ? (
                      <span className="block text-xs text-slate-400">
                        sem trocas restantes hoje
                      </span>
                    ) : null}
                  </td>
                  <td className="px-2 py-2">
                    <ItemBadge itemId={rota.giveItemId} quantidade={rota.giveQty} />
                  </td>
                  <td className="px-2 py-2">
                    <div className="flex items-center gap-2">
                      {faixa ? (
                        <input
                          type="number"
                          aria-label="Recebe por troca"
                          className={campo}
                          min={rota.receiveQtyMin}
                          max={rota.receiveQtyMax}
                          value={item.recebePorTroca}
                          onChange={(e) => {
                            const v = e.target.valueAsNumber;
                            if (!Number.isFinite(v)) return;
                            const limitado = Math.min(
                              rota.receiveQtyMax,
                              Math.max(rota.receiveQtyMin, v),
                            );
                            trocar(item.id, (i) => editarItem(i, { recebePorTroca: limitado }));
                          }}
                        />
                      ) : null}
                      <ItemBadge
                        itemId={rota.receiveItemId}
                        {...(faixa ? {} : { quantidade: item.recebePorTroca })}
                      />
                    </div>
                    {faixa ? (
                      <span className="text-xs text-slate-500">
                        a rota dá {fmtInteiro(rota.receiveQtyMin)} a{' '}
                        {fmtInteiro(rota.receiveQtyMax)}
                      </span>
                    ) : null}
                  </td>
                  <td className="px-2 py-2">
                    <input
                      type="number"
                      aria-label="Trocas restantes"
                      className={campo}
                      min={0}
                      max={teto}
                      value={item.remainingTrades}
                      onChange={(e) => {
                        const v = Math.min(teto, Math.max(0, e.target.valueAsNumber || 0));
                        trocar(item.id, (i) =>
                          editarItem(i, {
                            remainingTrades: v,
                            plannedTrades: Math.min(i.plannedTrades, v),
                          }),
                        );
                      }}
                    />
                  </td>
                  <td className="px-2 py-2">
                    <input
                      type="number"
                      aria-label="Trocas a fazer"
                      className={campo}
                      min={1}
                      max={Math.max(1, item.remainingTrades)}
                      value={item.plannedTrades}
                      onChange={(e) => {
                        const v = Math.min(
                          Math.max(1, item.remainingTrades),
                          Math.max(1, e.target.valueAsNumber || 1),
                        );
                        trocar(item.id, (i) => editarItem(i, { plannedTrades: v }));
                      }}
                    />
                  </td>
                  <td className="px-2 py-2">
                    <input
                      type="checkbox"
                      aria-label="Tenho o item de entrada no armazém"
                      className="size-4 accent-[var(--color-ouro)]"
                      checked={item.hasStock}
                      onChange={(e) =>
                        trocar(item.id, (i) => editarItem(i, { hasStock: e.target.checked }))
                      }
                    />
                  </td>
                  <td className="px-2 py-2 text-right text-slate-200">
                    {fmtInteiro(custoPorTroca(custoBaseEfetivo(rota), barter) * item.plannedTrades)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
