import { custoPorTroca, reducaoTotal, reducoes } from '../../../core/barter/cost';
import { CROW_COIN_BASE_COST, MAX_BARTER } from '../../../core/data/tierRules';
import { useSettingsStore } from '../../../store/settingsStore';
import { Field, NumberInput, Section, Toggle } from '../../components/controls';
import { fmtInteiro, fmtPorcentagem } from '../../format';

const BASE_TROCA_COMUM = 14_286;

export function BarganhaSection() {
  const barter = useSettingsStore((s) => s.settings.barter);
  const setBarter = useSettingsStore((s) => s.setBarter);
  const partes = reducoes(barter);

  return (
    <Section
      titulo="Barganha"
      descricao={
        `As reduções são somadas, o custo é arredondado para baixo e a barganha disponível é ` +
        `sempre o máximo do jogo (${fmtInteiro(MAX_BARTER)}).`
      }
    >
      <Field
        label="Redução do nível de permuta"
        hint="A % que o jogo mostra para o seu nível."
        htmlFor="reducao-nivel"
      >
        <NumberInput
          id="reducao-nivel"
          value={Number((barter.levelReduction * 100).toFixed(2))}
          min={0}
          max={100}
          step={0.1}
          suffix="%"
          onChange={(v) => setBarter({ levelReduction: (v || 0) / 100 })}
        />
      </Field>

      <Field label="Pacote Econômico">
        <Toggle
          checked={barter.economyPackage}
          onChange={(v) => setBarter({ economyPackage: v })}
          label="Ativo (−10%)"
        />
      </Field>

      <Field label="Habilidade do vice-capitão">
        <div className="flex flex-wrap items-center gap-3">
          <Toggle
            checked={barter.viceCaptain}
            onChange={(v) => setBarter({ viceCaptain: v })}
            label="Ativa"
          />
          <NumberInput
            value={barter.viceCaptainPercent}
            min={0}
            max={100}
            step={0.5}
            disabled={!barter.viceCaptain}
            suffix="%"
            onChange={(v) => setBarter({ viceCaptainPercent: v })}
          />
        </div>
      </Field>

      <div className="rounded border border-mar bg-abismo/60 p-3 text-sm text-slate-300">
        <p>
          Redução total:{' '}
          <strong className="text-ouro">{fmtPorcentagem(reducaoTotal(barter))}</strong>{' '}
          <span className="text-xs text-slate-500">
            (nível {fmtPorcentagem(partes.nivel)} + pacote {fmtPorcentagem(partes.pacote)} +
            vice-capitão {fmtPorcentagem(partes.viceCapitao)})
          </span>
        </p>
        <p className="mt-1">
          Troca comum (base {fmtInteiro(BASE_TROCA_COMUM)}):{' '}
          <strong className="text-ouro">
            {fmtInteiro(custoPorTroca(BASE_TROCA_COMUM, barter))}
          </strong>{' '}
          · Moedas do Corvo (base {fmtInteiro(CROW_COIN_BASE_COST)}):{' '}
          <strong className="text-ouro">
            {fmtInteiro(custoPorTroca(CROW_COIN_BASE_COST, barter))}
          </strong>
        </p>
      </div>
    </Section>
  );
}
