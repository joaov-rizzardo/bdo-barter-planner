import { useMemo } from 'react';
import { resolveChain } from '../../core/chain/resolveChain';
import type { ChainResult } from '../../core/chain/resolveChain';
import { itemBalance } from '../../core/balance/itemBalance';
import type { ItemBalanceRow } from '../../core/balance/itemBalance';
import { resumoBarganha } from '../../core/barter/cost';
import type { ResumoBarganha } from '../../core/barter/cost';
import { useDataStore } from '../../store/dataStore';
import { usePlanStore } from '../../store/planStore';
import { useSettingsStore } from '../../store/settingsStore';

export interface CadeiaDoPlano extends ChainResult {
  balanco: ItemBalanceRow[];
  barganha: ResumoBarganha;
  erros: ChainResult['diagnostics'];
  avisos: ChainResult['diagnostics'];
}

/**
 * Resolve a cadeia do plano atual (encadeando as trocas precedentes que faltam)
 * e devolve balanço de itens e resumo de barganha já calculados.
 */
export function useCadeia(): CadeiaDoPlano {
  const trades = usePlanStore((s) => s.trades);
  const items = useDataStore((s) => s.items);
  const routes = useDataStore((s) => s.routes);
  const barterSettings = useSettingsStore((s) => s.settings.barter);
  const route = useSettingsStore((s) => s.settings.route);

  return useMemo(() => {
    const preferIslandIds = [
      ...(route.baseIslandId ? [route.baseIslandId] : []),
      ...route.unloadIslandIds,
      ...trades.map((t) => t.islandId),
    ];
    const cadeia = resolveChain(trades, items, routes, { preferIslandIds });
    return {
      ...cadeia,
      balanco: itemBalance(cadeia.trades),
      barganha: resumoBarganha(cadeia.trades, barterSettings),
      erros: cadeia.diagnostics.filter((d) => d.level === 'erro'),
      avisos: cadeia.diagnostics.filter((d) => d.level === 'aviso'),
    };
  }, [trades, items, routes, barterSettings, route.baseIslandId, route.unloadIslandIds]);
}
