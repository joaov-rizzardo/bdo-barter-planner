import { useMemo } from 'react';
import { applyPortOverrides, portosComArmazem } from '../../core/settings/ports';
import type { Island } from '../../core/models/types';
import { useDataStore } from '../../store/dataStore';
import { useSettingsStore } from '../../store/settingsStore';

/** Ilhas dos dados carregados com os ajustes manuais de porto já aplicados. */
export function useIlhas(): Island[] {
  const islands = useDataStore((s) => s.data.islands);
  const overrides = useSettingsStore((s) => s.settings.route.portOverrides);
  return useMemo(() => applyPortOverrides(islands, overrides), [islands, overrides]);
}

/** Ilhas com armazém, ordenadas por nome — candidatas a base e descarga. */
export function useIlhasComArmazem(): Island[] {
  const ilhas = useIlhas();
  return useMemo(() => portosComArmazem(ilhas), [ilhas]);
}
