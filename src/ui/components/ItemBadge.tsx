import { useDataStore } from '../../store/dataStore';
import { rotuloTier } from '../tiers';

/** Ícone + nome do item, com o tier ao lado. */
export function ItemBadge({ itemId, quantidade }: { itemId: string; quantidade?: number }) {
  const items = useDataStore((s) => s.items);
  const info = items.get(itemId);

  return (
    <span className="inline-flex items-center gap-2">
      {info?.icon ? (
        <img src={`/${info.icon}`} alt="" className="size-6 shrink-0" loading="lazy" />
      ) : (
        <span className="size-6 shrink-0 rounded bg-mar/60" />
      )}
      <span>
        {quantidade === undefined ? '' : `${quantidade}× `}
        {items.nameOf(itemId)}
        {info ? <span className="ml-1 text-xs text-slate-500">{rotuloTier(info.tier)}</span> : null}
      </span>
    </span>
  );
}
