import { useSettingsStore } from '../../../store/settingsStore';
import { limitesDoNavio, limiteDeSobrepeso } from '../../../core/cargo/cargo';
import { Field, NumberInput, Section, Select, Toggle } from '../../components/controls';
import { fmtLt } from '../../format';

export function NavioSection() {
  const ship = useSettingsStore((s) => s.settings.ship);
  const setShip = useSettingsStore((s) => s.setShip);
  const tetoDeCarga = limiteDeSobrepeso(limitesDoNavio(ship));

  return (
    <Section
      titulo="Espaço livre no navio"
      descricao="Informe o que está LIVRE agora — não a capacidade total. É esse espaço que a simulação de carga usa parada a parada."
    >
      <Field
        label="Peso livre"
        hint="Peso que ainda cabe no navio, descontando o que já está a bordo."
        htmlFor="peso-livre"
      >
        <NumberInput
          id="peso-livre"
          value={ship.freeWeightLt}
          min={1}
          step={100}
          suffix="LT livres"
          onChange={(v) => setShip({ freeWeightLt: v })}
        />
      </Field>
      <Field
        label="Slots livres"
        hint="Slots de carga vazios. T5+ ocupa um slot por unidade."
        htmlFor="slots-livres"
      >
        <NumberInput
          id="slots-livres"
          value={ship.freeSlots}
          min={1}
          step={1}
          suffix="slots livres"
          onChange={(v) => setShip({ freeSlots: v })}
        />
      </Field>
      <Field
        label="Capacidade total"
        hint="Peso máximo do navio cheio. Só serve para calcular o teto de 150% do sobrepeso."
        htmlFor="peso-total"
      >
        <NumberInput
          id="peso-total"
          value={ship.totalWeightLt}
          min={ship.freeWeightLt}
          step={100}
          suffix="LT no total"
          onChange={(v) => setShip({ totalWeightLt: v })}
        />
      </Field>

      <Field
        label="Navegar com sobrepeso"
        hint="Permite fechar uma troca que passa do peso. Depois dela o navio trava até aliviar."
        htmlFor="sobrepeso"
      >
        <Toggle
          id="sobrepeso"
          checked={ship.allowOverweight}
          label={ship.allowOverweight ? 'Permitido' : 'Não usar'}
          onChange={(v) => setShip({ allowOverweight: v })}
        />
      </Field>

      {ship.allowOverweight ? (
        <>
          <Field label="Quando usar o sobrepeso" htmlFor="modo-sobrepeso">
            <Select
              id="modo-sobrepeso"
              value={ship.overweightMode}
              options={[
                {
                  value: 'transferencia',
                  label: 'Somente para transferência ao inventário',
                },
                { value: 'qualquer', label: 'Em qualquer situação' },
              ]}
              onChange={(v) =>
                setShip({ overweightMode: v === 'qualquer' ? 'qualquer' : 'transferencia' })
              }
            />
          </Field>
          <p className="text-xs text-slate-500">
            Teto de 150% da capacidade total: a simulação aceita até {fmtLt(tetoDeCarga)} de carga
            planejada (o que já está a bordo conta no limite).
            {ship.overweightMode === 'transferencia'
              ? ' Nesse modo, a troca em sobrepeso só entra se a transferência de 1 slot para o inventário devolver o peso para dentro do limite.'
              : ' Depois da troca em sobrepeso, nenhuma outra acontece antes de transferir 1 slot para o inventário ou voltar para a base.'}
          </p>
        </>
      ) : null}
    </Section>
  );
}
