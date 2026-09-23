import { useSettingsStore } from '../../../store/settingsStore';
import { limitesDoNavio, limiteDeSobrepeso } from '../../../core/cargo/cargo';
import { PESO_PADRAO_MARINHEIRO_LT } from '../../../core/models/types';
import { Field, NumberInput, Section, Select, TextButton, Toggle } from '../../components/controls';
import { fmtLt } from '../../format';

export function NavioSection() {
  const ship = useSettingsStore((s) => s.settings.ship);
  const setShip = useSettingsStore((s) => s.setShip);
  const tetoDeCarga = limiteDeSobrepeso(limitesDoNavio(ship));
  const pesoMarinheiros = ship.sailorsLt.reduce((total, peso) => total + peso, 0);

  return (
    <Section
      titulo="Espaço livre no navio"
      descricao="O peso livre é a capacidade total menos os marinheiros equipados. É esse espaço que a simulação de carga usa parada a parada."
    >
      <Field
        label="Capacidade total"
        hint="Peso máximo do navio cheio. Serve de base para o peso livre e para o teto de 150% do sobrepeso."
        htmlFor="peso-total"
      >
        <NumberInput
          id="peso-total"
          value={ship.totalWeightLt}
          min={pesoMarinheiros + 1}
          step={100}
          suffix="LT no total"
          onChange={(v) => setShip({ totalWeightLt: v })}
        />
      </Field>

      <Field
        label="Marinheiros"
        hint="Cada marinheiro equipado ocupa peso no navio. O roteiro indica quando vale desequipar algum na base para caber mais trocas."
      >
        <div className="space-y-2">
          {ship.sailorsLt.map((peso, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="w-6 text-right text-xs text-slate-500">{i + 1}.</span>
              <NumberInput
                id={`marinheiro-${i}`}
                value={peso}
                min={1}
                step={10}
                suffix="LT"
                onChange={(v) =>
                  setShip({ sailorsLt: ship.sailorsLt.map((p, j) => (j === i ? v : p)) })
                }
              />
              <TextButton
                variante="perigo"
                onClick={() => setShip({ sailorsLt: ship.sailorsLt.filter((_, j) => j !== i) })}
              >
                Remover
              </TextButton>
            </div>
          ))}
          <div className="flex items-center gap-3">
            <TextButton
              onClick={() => setShip({ sailorsLt: [...ship.sailorsLt, PESO_PADRAO_MARINHEIRO_LT] })}
            >
              + Adicionar marinheiro
            </TextButton>
            <span className="text-xs text-slate-500">
              {ship.sailorsLt.length === 0
                ? 'Nenhum marinheiro no navio.'
                : `${ship.sailorsLt.length} marinheiro(s): ${fmtLt(pesoMarinheiros)}`}
            </span>
          </div>
        </div>
      </Field>

      <Field
        label="Peso livre"
        hint="Somente leitura: capacidade total menos o peso dos marinheiros."
        htmlFor="peso-livre"
      >
        <NumberInput
          id="peso-livre"
          value={ship.freeWeightLt}
          disabled
          suffix="LT livres"
          onChange={() => undefined}
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

      <Field
        label="Vender T7 para aliviar"
        hint="Só quando for preciso: antes de uma troca que deixaria o navio pesado, ou logo depois dela se o porto tiver gerente de cais. A venda é no gerente de cais que menos desvia do caminho."
        htmlFor="vender-t7"
      >
        <Toggle
          id="vender-t7"
          checked={ship.sellT7}
          label={ship.sellT7 ? 'Vender quando precisar' : 'Não vender'}
          onChange={(v) => setShip({ sellT7: v })}
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
