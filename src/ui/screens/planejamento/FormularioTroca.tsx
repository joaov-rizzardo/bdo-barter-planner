import { useMemo, useState } from 'react';
import { custoBaseEfetivo, maxTrocasEfetivo } from '../../../core/chain/routeIndex';
import type { BarterRoute } from '../../../core/models/types';
import { useDataStore } from '../../../store/dataStore';
import { usePlanStore } from '../../../store/planStore';
import { Aviso, Field, NumberInput, Section, Select, Toggle } from '../../components/controls';
import { SeletorDeItem } from '../../components/SeletorDeItem';
import { fmtInteiro } from '../../format';
import { useIlhas } from '../../hooks/useIlhas';

/** "2" ou "2–3", conforme a rota entregue quantidade fixa ou faixa. */
const faixaDeSaida = (r: BarterRoute) =>
  r.receiveQtyMax > r.receiveQtyMin
    ? `${r.receiveQtyMin}–${r.receiveQtyMax}`
    : `${r.receiveQtyMin}`;
import { nomeDaIlha } from '../../describe';

export function FormularioTroca() {
  const { data, items, routes } = useDataStore();
  const adicionar = usePlanStore((s) => s.adicionar);
  const ilhas = useIlhas();

  const [inputItemId, setInputItemId] = useState('');
  const [outputItemId, setOutputItemId] = useState('');
  const [routeKey, setRouteKey] = useState('');
  const [outputQty, setOutputQty] = useState(1);
  const [remainingTrades, setRemainingTrades] = useState(10);
  const [plannedTrades, setPlannedTrades] = useState(10);
  const [hasStock, setHasStock] = useState(false);

  /** Itens que alguma rota de subida de tier aceita como entrada. */
  const entradasPossiveis = useMemo(
    () => [...new Set(data.routes.filter((r) => r.kind === 'tier').map((r) => r.giveItemId))],
    [data.routes],
  );

  const saidasPossiveis = useMemo(() => {
    if (!inputItemId) return [];
    return [
      ...new Set(
        routes
          .consumindo(inputItemId)
          .filter((r) => r.kind === 'tier')
          .map((r) => r.receiveItemId),
      ),
    ];
  }, [inputItemId, routes]);

  const rotasDoPar = useMemo<BarterRoute[]>(() => {
    if (!inputItemId || !outputItemId) return [];
    return [...routes.ilhasPara(inputItemId, outputItemId)].sort((a, b) =>
      nomeDaIlha(a.islandId, ilhas).localeCompare(nomeDaIlha(b.islandId, ilhas), 'pt-BR'),
    );
  }, [inputItemId, outputItemId, routes, ilhas]);

  const rota = rotasDoPar.find((r) => r.key === routeKey) ?? rotasDoPar[0];

  /** Quantidades possíveis por troca nesta rota (ex.: 2 e 3 em uma rota 1:2-3). */
  const opcoesDeSaida = rota
    ? Array.from(
        { length: rota.receiveQtyMax - rota.receiveQtyMin + 1 },
        (_, i) => rota.receiveQtyMin + i,
      )
    : [];
  const qtdRecebida = rota
    ? Math.min(Math.max(outputQty, rota.receiveQtyMin), rota.receiveQtyMax)
    : 1;

  const escolherEntrada = (id: string) => {
    setInputItemId(id);
    setOutputItemId('');
    setRouteKey('');
  };

  const escolherSaida = (id: string) => {
    setOutputItemId(id);
    const primeira = routes.ilhasPara(inputItemId, id)[0];
    if (primeira) escolherRota(primeira.key, id);
  };

  const escolherRota = (key: string, saida = outputItemId) => {
    setRouteKey(key);
    const encontrada = routes.ilhasPara(inputItemId, saida).find((r) => r.key === key);
    if (encontrada) {
      const teto = maxTrocasEfetivo(encontrada);
      setRemainingTrades(teto);
      setPlannedTrades(teto);
      // Quando a rota entrega uma faixa (ex.: 1:2-3), começa pelo maior valor.
      setOutputQty(encontrada.receiveQtyMax);
    }
  };

  const adicionarTroca = () => {
    if (!rota) return;
    adicionar({
      islandId: rota.islandId,
      inputItemId: rota.giveItemId,
      inputQtyPerTrade: rota.giveQty,
      outputItemId: rota.receiveItemId,
      outputQtyPerTrade: qtdRecebida,
      remainingTrades,
      plannedTrades,
      baseBarterCost: custoBaseEfetivo(rota),
      hasStock,
      routeKey: rota.key,
    });
    setRouteKey('');
    setOutputItemId('');
    setInputItemId('');
    setHasStock(false);
  };

  const excedeTeto = rota ? remainingTrades > maxTrocasEfetivo(rota) : false;

  return (
    <Section
      titulo="Adicionar troca"
      descricao="Escolha o que você entrega; as saídas, os portos e a proporção vêm das rotas do jogo."
    >
      <Field label="Item de entrada" htmlFor="entrada">
        <SeletorDeItem
          id="entrada"
          titulo="Escolher o item de entrega"
          value={inputItemId}
          opcoes={entradasPossiveis}
          onChange={escolherEntrada}
        />
      </Field>

      <Field label="Item de saída" hint="Filtrado pelas rotas do item de entrada." htmlFor="saida">
        <SeletorDeItem
          id="saida"
          titulo="Escolher o item a receber"
          value={outputItemId}
          opcoes={saidasPossiveis}
          disabled={!inputItemId}
          onChange={escolherSaida}
        />
      </Field>

      <Field label="Porto" hint="Proporção, teto de trocas e barganha da rota." htmlFor="porto">
        <Select
          id="porto"
          value={rota?.key ?? ''}
          disabled={rotasDoPar.length === 0}
          options={rotasDoPar.map((r) => ({
            value: r.key,
            label:
              `${nomeDaIlha(r.islandId, ilhas)} — ${fmtInteiro(r.giveQty)}:${faixaDeSaida(r)}` +
              ` · máx ${maxTrocasEfetivo(r)} · ${fmtInteiro(custoBaseEfetivo(r))} barganha`,
          }))}
          onChange={(key) => escolherRota(key)}
        />
      </Field>

      {rota && rota.receiveQtyMax > rota.receiveQtyMin ? (
        <Field
          label="Recebe por troca"
          hint={`Esta rota entrega de ${rota.receiveQtyMin} a ${rota.receiveQtyMax} por troca.`}
          htmlFor="saida-por-troca"
        >
          <Select
            id="saida-por-troca"
            value={qtdRecebida}
            options={opcoesDeSaida.map((q) => ({
              value: q,
              label: `${fmtInteiro(rota.giveQty)}:${fmtInteiro(q)} — ${fmtInteiro(q)}× por troca`,
            }))}
            onChange={(v) => setOutputQty(Number(v))}
          />
        </Field>
      ) : null}

      <Field
        label="Tenho o item em estoque"
        hint="Marcado, o app não cria troca precedente nem compra."
      >
        <Toggle checked={hasStock} onChange={setHasStock} label="Já está no armazém/navio" />
      </Field>

      <Field
        label="Trocas restantes"
        hint="O número que o jogo mostra no permutador."
        htmlFor="restantes"
      >
        <NumberInput
          id="restantes"
          value={remainingTrades}
          min={0}
          onChange={(v) => {
            setRemainingTrades(v);
            setPlannedTrades((p) => Math.min(p, v));
          }}
        />
      </Field>

      <Field label="Trocas a fazer" htmlFor="planejadas">
        <NumberInput
          id="planejadas"
          value={plannedTrades}
          min={1}
          max={remainingTrades}
          onChange={setPlannedTrades}
        />
      </Field>

      {rota ? (
        <p className="text-sm text-slate-400">
          {fmtInteiro(rota.giveQty * plannedTrades)}× {items.nameOf(rota.giveItemId)} →{' '}
          {fmtInteiro(qtdRecebida * plannedTrades)}× {items.nameOf(rota.receiveItemId)}
        </p>
      ) : null}

      {excedeTeto ? (
        <Aviso tipo="aviso">
          O jogo permite no máximo {rota ? maxTrocasEfetivo(rota) : 0} trocas nesta rota.
        </Aviso>
      ) : null}

      <div>
        <button
          type="button"
          disabled={!rota || plannedTrades < 1}
          onClick={adicionarTroca}
          className="rounded bg-ouro px-4 py-1.5 text-sm font-semibold text-abismo disabled:opacity-40"
        >
          Adicionar ao plano
        </button>
      </div>
    </Section>
  );
}
