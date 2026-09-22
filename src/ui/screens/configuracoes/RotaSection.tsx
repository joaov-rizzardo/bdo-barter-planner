import { validarConfiguracaoDeRota } from '../../../core/settings/ports';
import { useSettingsStore } from '../../../store/settingsStore';
import { useIlhas, useIlhasComArmazem } from '../../hooks/useIlhas';
import { Aviso, Field, Section, Select, Toggle } from '../../components/controls';

export function RotaSection() {
  const route = useSettingsStore((s) => s.settings.route);
  const setRoute = useSettingsStore((s) => s.setRoute);
  const ilhas = useIlhas();
  const comArmazem = useIlhasComArmazem();
  const problemas = validarConfiguracaoDeRota(route, ilhas);

  const alternarDescarga = (id: string, marcado: boolean) =>
    setRoute({
      unloadIslandIds: marcado
        ? [...route.unloadIslandIds, id]
        : route.unloadIslandIds.filter((i) => i !== id),
    });

  return (
    <Section
      titulo="Base e portos de descarga"
      descricao="A viagem começa e termina na base. Portos de descarga intermediários são opcionais."
    >
      <Field label="Porto base" hint="Só portos com armazém aparecem aqui." htmlFor="base">
        <Select
          id="base"
          value={route.baseIslandId ?? ''}
          options={[
            { value: '', label: '— selecione —' },
            ...comArmazem.map((i) => ({ value: i.id, label: i.namePt })),
          ]}
          onChange={(v) => setRoute({ baseIslandId: v === '' ? null : v })}
        />
      </Field>

      <Field label="Portos de descarga">
        <div className="grid max-h-56 grid-cols-1 gap-1 overflow-y-auto rounded border border-mar bg-abismo/60 p-2 sm:grid-cols-2">
          {comArmazem
            .filter((i) => i.id !== route.baseIslandId)
            .map((i) => (
              <Toggle
                key={i.id}
                checked={route.unloadIslandIds.includes(i.id)}
                onChange={(marcado) => alternarDescarga(i.id, marcado)}
                label={i.namePt}
              />
            ))}
        </div>
      </Field>

      {problemas.map((p) => (
        <Aviso key={p.code + ('islandId' in p ? p.islandId : '')} tipo="erro">
          {p.message}
        </Aviso>
      ))}
    </Section>
  );
}
