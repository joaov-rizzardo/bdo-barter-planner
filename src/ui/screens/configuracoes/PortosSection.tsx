import { useMemo, useState } from 'react';
import { useSettingsStore } from '../../../store/settingsStore';
import { useIlhas } from '../../hooks/useIlhas';
import { Aviso, Section, TextButton, Toggle } from '../../components/controls';

/**
 * Armazém e Gerente de Cais não vêm nos dados do jogo: esta tabela permite
 * corrigir porto por porto, e o ajuste fica salvo.
 */
export function PortosSection() {
  const [busca, setBusca] = useState('');
  const [somenteAjustados, setSomenteAjustados] = useState(false);
  const ilhas = useIlhas();
  const overrides = useSettingsStore((s) => s.settings.route.portOverrides);
  const setPortOverride = useSettingsStore((s) => s.setPortOverride);
  const limparPortOverride = useSettingsStore((s) => s.limparPortOverride);

  const visiveis = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return ilhas.filter((i) => {
      if (somenteAjustados && !overrides[i.id]) return false;
      if (!termo) return true;
      return `${i.namePt} ${i.name}`.toLowerCase().includes(termo);
    });
  }, [ilhas, busca, somenteAjustados, overrides]);

  return (
    <Section
      titulo="Portos"
      descricao="Marque quais portos têm armazém e Gerente de Cais. Os valores iniciais são um palpite."
    >
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="search"
          value={busca}
          placeholder="Buscar porto…"
          onChange={(e) => setBusca(e.target.value)}
          className="w-64 rounded border border-mar bg-abismo px-2.5 py-1.5 text-sm text-slate-100 outline-none focus:border-ouro"
        />
        <Toggle
          checked={somenteAjustados}
          onChange={setSomenteAjustados}
          label="Só os ajustados por mim"
        />
        <span className="text-xs text-slate-500">
          {visiveis.length} de {ilhas.length} portos
        </span>
      </div>

      <div className="max-h-96 overflow-y-auto rounded border border-mar">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-mar/60 text-left text-xs uppercase text-slate-300">
            <tr>
              <th className="px-3 py-2">Porto</th>
              <th className="px-3 py-2">Permutador</th>
              <th className="px-3 py-2">Armazém</th>
              <th className="px-3 py-2">Gerente de Cais</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {visiveis.map((ilha) => (
              <tr key={ilha.id} className="border-t border-mar/40 odd:bg-abismo/40">
                <td className="px-3 py-1.5">
                  {ilha.namePt}
                  {ilha.x === null ? (
                    <span className="ml-2 text-xs text-amber-300">sem posição no mapa</span>
                  ) : null}
                </td>
                <td className="px-3 py-1.5 text-slate-400">{ilha.barterer ?? '—'}</td>
                <td className="px-3 py-1.5">
                  <Toggle
                    checked={ilha.hasWarehouse}
                    onChange={(v) => setPortOverride(ilha.id, { hasWarehouse: v })}
                  />
                </td>
                <td className="px-3 py-1.5">
                  <Toggle
                    checked={ilha.hasWharfManager}
                    onChange={(v) => setPortOverride(ilha.id, { hasWharfManager: v })}
                  />
                </td>
                <td className="px-3 py-1.5 text-right">
                  {overrides[ilha.id] ? (
                    <button
                      type="button"
                      onClick={() => limparPortOverride(ilha.id)}
                      className="text-xs text-slate-400 underline hover:text-slate-200"
                    >
                      desfazer
                    </button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {visiveis.length === 0 ? <Aviso tipo="info">Nenhum porto encontrado.</Aviso> : null}

      {Object.keys(overrides).length > 0 ? (
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-500">
            {Object.keys(overrides).length} porto(s) ajustado(s).
          </span>
          <TextButton
            variante="perigo"
            onClick={() => Object.keys(overrides).forEach(limparPortOverride)}
          >
            Desfazer todos os ajustes
          </TextButton>
        </div>
      ) : null}
    </Section>
  );
}
