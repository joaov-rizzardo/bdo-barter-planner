import type { CadeiaDoPlano } from '../../hooks/useCadeia';
import { useDataStore } from '../../../store/dataStore';
import { Aviso, Section } from '../../components/controls';
import { ItemBadge } from '../../components/ItemBadge';
import { fmtDecimal, fmtInteiro } from '../../format';

export function PainelBalanco({ cadeia }: { cadeia: CadeiaDoPlano }) {
  const items = useDataStore((s) => s.items);
  const linhas = [...cadeia.balanco].sort((a, b) =>
    items.nameOf(a.itemId).localeCompare(items.nameOf(b.itemId), 'pt-BR'),
  );

  return (
    <Section titulo="Balanço de itens" descricao="Soma de tudo que o plano consome e produz.">
      {linhas.length === 0 ? (
        <Aviso tipo="info">Adicione trocas para ver o balanço.</Aviso>
      ) : (
        <div className="overflow-x-auto rounded border border-mar">
          <table className="w-full text-sm">
            <thead className="bg-mar/60 text-left text-xs uppercase text-slate-300">
              <tr>
                <th className="px-3 py-2">Item</th>
                <th className="px-3 py-2 text-right">Precisa</th>
                <th className="px-3 py-2 text-right">Produz</th>
                <th className="px-3 py-2 text-right">Falta</th>
                <th className="px-3 py-2 text-right">Sobra</th>
                <th className="px-3 py-2 text-right">Do estoque</th>
                <th className="px-3 py-2 text-right">Peso unit.</th>
              </tr>
            </thead>
            <tbody>
              {linhas.map((l) => (
                <tr key={l.itemId} className="border-t border-mar/40 odd:bg-abismo/40">
                  <td className="px-3 py-1.5">
                    <ItemBadge itemId={l.itemId} />
                  </td>
                  <td className="px-3 py-1.5 text-right">{fmtInteiro(l.needed)}</td>
                  <td className="px-3 py-1.5 text-right">{fmtInteiro(l.produced)}</td>
                  <td
                    className={`px-3 py-1.5 text-right ${
                      l.deficit === 0
                        ? 'text-slate-500'
                        : items.isMarketMaterial(l.itemId)
                          ? 'text-slate-300'
                          : 'text-red-300'
                    }`}
                    title={
                      l.deficit > 0 && items.isMarketMaterial(l.itemId)
                        ? 'Vem da lista de compras do mercado'
                        : undefined
                    }
                  >
                    {fmtInteiro(l.deficit)}
                    {l.deficit > 0 && items.isMarketMaterial(l.itemId) ? (
                      <span className="ml-1 text-xs text-slate-500">comprar</span>
                    ) : null}
                  </td>
                  <td
                    className={`px-3 py-1.5 text-right ${l.leftover > 0 ? 'text-amber-200' : 'text-slate-500'}`}
                  >
                    {fmtInteiro(l.leftover)}
                  </td>
                  <td className="px-3 py-1.5 text-right">{fmtInteiro(l.fromStock)}</td>
                  <td className="px-3 py-1.5 text-right text-slate-400">
                    {fmtDecimal(items.weightOf(l.itemId))} LT
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Section>
  );
}
