import { useDataStore } from '../../../store/dataStore';
import { Aviso, Section } from '../../components/controls';
import { ItemBadge } from '../../components/ItemBadge';
import { fmtInteiro, fmtLt } from '../../format';
import type { CadeiaDoPlano } from '../../hooks/useCadeia';

export function ListaCompras({ cadeia }: { cadeia: CadeiaDoPlano }) {
  const items = useDataStore((s) => s.items);
  const pesoTotal = cadeia.shoppingList.reduce(
    (total, c) => total + c.qty * items.weightOf(c.itemId),
    0,
  );

  return (
    <Section
      titulo="Lista de compras do mercado"
      descricao="Bens terrestres (T0) que a cadeia consome e ninguém produz."
    >
      {cadeia.shoppingList.length === 0 ? (
        <Aviso tipo="info">Nada a comprar: a cadeia começa no seu estoque.</Aviso>
      ) : (
        <>
          <ul className="divide-y divide-mar/40 rounded border border-mar">
            {cadeia.shoppingList.map((c) => (
              <li
                key={c.itemId}
                className="flex items-center justify-between gap-3 px-3 py-1.5 text-sm"
              >
                <ItemBadge itemId={c.itemId} quantidade={c.qty} />
                <span className="text-slate-400">{fmtLt(c.qty * items.weightOf(c.itemId))}</span>
              </li>
            ))}
          </ul>
          <p className="text-sm text-slate-400">
            {fmtInteiro(cadeia.shoppingList.length)} material(is) · peso total{' '}
            <strong className="text-slate-200">{fmtLt(pesoTotal)}</strong>
          </p>
        </>
      )}

      {cadeia.fromStock.length > 0 ? (
        <div className="rounded border border-mar bg-abismo/60 p-3">
          <h3 className="text-sm font-semibold text-slate-200">Precisa ter no armazém</h3>
          <ul className="mt-2 space-y-1 text-sm">
            {cadeia.fromStock.map((s) => (
              <li key={s.itemId}>
                <ItemBadge itemId={s.itemId} quantidade={s.qty} />
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </Section>
  );
}
