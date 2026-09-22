import { useSettingsStore } from '../../../store/settingsStore';
import { Field, NumberInput, Section } from '../../components/controls';

export function NavioSection() {
  const ship = useSettingsStore((s) => s.settings.ship);
  const setShip = useSettingsStore((s) => s.setShip);

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
    </Section>
  );
}
