import { useEffect } from 'react';
import { usePlanStore } from '../store/planStore';
import { useProgressStore } from '../store/progressStore';
import { useSettingsStore } from '../store/settingsStore';
import { useUiStore } from '../store/uiStore';
import { PlanejamentoScreen } from './screens/PlanejamentoScreen';
import { RoteiroScreen } from './screens/RoteiroScreen';
import { ConfiguracoesScreen } from './screens/ConfiguracoesScreen';

const ABAS = [
  { id: 'planejamento', label: 'Planejamento', Screen: PlanejamentoScreen },
  { id: 'roteiro', label: 'Roteiro', Screen: RoteiroScreen },
  { id: 'configuracoes', label: 'Configurações', Screen: ConfiguracoesScreen },
] as const;

export function App() {
  const aba = useUiStore((s) => s.aba);
  const setAba = useUiStore((s) => s.irPara);
  const hydrateSettings = useSettingsStore((s) => s.hydrate);
  const hydratePlan = usePlanStore((s) => s.hydrate);
  const hydrateProgress = useProgressStore((s) => s.hydrate);
  const configCarregada = useSettingsStore((s) => s.carregado);
  const planoCarregado = usePlanStore((s) => s.carregado);
  const carregado = configCarregada && planoCarregado;

  useEffect(() => {
    void hydrateSettings();
    void hydratePlan();
    void hydrateProgress();
  }, [hydrateSettings, hydratePlan, hydrateProgress]);

  const atual = ABAS.find((a) => a.id === aba) ?? ABAS[0];

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-mar/60 bg-casco">
        <div className="mx-auto flex max-w-6xl items-center gap-6 px-6 py-3">
          <h1 className="text-lg font-semibold text-ouro">BDO Barter Planner</h1>
          <nav className="flex gap-1">
            {ABAS.map(({ id, label }) => (
              <button
                key={id}
                type="button"
                onClick={() => setAba(id)}
                className={`rounded px-3 py-1.5 text-sm transition ${
                  id === aba
                    ? 'bg-mar text-white'
                    : 'text-slate-400 hover:bg-mar/40 hover:text-slate-200'
                }`}
              >
                {label}
              </button>
            ))}
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-6">
        {carregado ? (
          <atual.Screen />
        ) : (
          <p className="text-sm text-slate-400">Carregando configurações…</p>
        )}
      </main>
    </div>
  );
}
