import { useEffect, useState } from 'react';
import { usePlanStore } from '../../store/planStore';
import { useProgressStore } from '../../store/progressStore';
import { useUiStore } from '../../store/uiStore';
import { Aviso, Section, TextButton } from '../components/controls';
import { fmtInteiro } from '../format';
import { useRoteiro } from '../hooks/useRoteiro';
import { AbaDaViagem } from './roteiro/AbaDaViagem';

export function RoteiroScreen() {
  // O roteiro só é remontado a partir do progresso quando o usuário pede: por
  // padrão, marcar uma troca apenas a risca, sem tirá-la da lista.
  const [usarProgresso, setUsarProgresso] = useState(false);
  const roteiro = useRoteiro({ usarProgresso });
  const trocasDoPlano = usePlanStore((s) => s.trades.length);
  const irPara = useUiStore((s) => s.irPara);
  const limparProgresso = useProgressStore((s) => s.limpar);
  const erroPersistencia = useProgressStore((s) => s.erroPersistencia);
  const [viagemAtiva, setViagemAtiva] = useState(0);

  // Se o recálculo reduziu o número de viagens, volta para uma aba existente.
  useEffect(() => {
    if (viagemAtiva >= roteiro.viagens.length) setViagemAtiva(0);
  }, [roteiro.viagens.length, viagemAtiva]);

  if (trocasDoPlano === 0) {
    return (
      <Section titulo="Roteiro" descricao="Nada para roteirizar ainda.">
        <Aviso tipo="info">Adicione trocas na aba Planejamento para o app montar as viagens.</Aviso>
        <TextButton onClick={() => irPara('planejamento')}>Ir para o Planejamento</TextButton>
      </Section>
    );
  }

  if (!roteiro.plano) {
    return (
      <Section titulo="Roteiro" descricao="Falta configurar a base da viagem.">
        {roteiro.problemas.map((p) => (
          <Aviso key={p.code} tipo="erro">
            {p.message}
          </Aviso>
        ))}
        <TextButton onClick={() => irPara('configuracoes')}>Abrir Configurações</TextButton>
      </Section>
    );
  }

  const viagem = roteiro.viagens[viagemAtiva] ?? roteiro.viagens[0];
  // Concluído é a checklist inteira: todos os passos de todas as viagens.
  const passos = roteiro.viagens.flatMap((v) => v.passos);
  const tudoFeito = passos.length > 0 && passos.every((p) => p.concluido);

  return (
    <div className="space-y-5">
      {erroPersistencia ? (
        <Aviso tipo="aviso">O progresso não está sendo salvo: {erroPersistencia}</Aviso>
      ) : null}

      <Section
        titulo="Resumo do roteiro"
        descricao={`Estratégia: ${roteiro.plano.solver}. O progresso é salvo automaticamente.${
          roteiro.recalculado ? '' : ' As trocas marcadas continuam na lista, riscadas.'
        }`}
      >
        <div className="grid gap-3 sm:grid-cols-4">
          <Indicador rotulo="Viagens" valor={String(roteiro.viagens.length)} />
          <Indicador
            rotulo="Distância total"
            valor={`${fmtInteiro(Math.round(roteiro.plano.totalDistance))} un.`}
          />
          <Indicador
            rotulo="Trocas feitas"
            valor={`${fmtInteiro(roteiro.trocasFeitas)} / ${fmtInteiro(roteiro.trocasPlanejadas)}`}
          />
          <Indicador rotulo="Trocas restantes" valor={String(roteiro.restantes.length)} />
        </div>

        {roteiro.faltas.length > 0 ? (
          <Aviso tipo="erro">
            {roteiro.faltas.length} item(ns) do plano não têm troca precedente informada — o roteiro
            assume que eles já estão no seu armazém. Resolva na aba Planejamento.
          </Aviso>
        ) : null}

        {roteiro.plano.warnings.map((w, i) => (
          <Aviso key={`${w.code}${i}`} tipo="aviso">
            {w.message}
          </Aviso>
        ))}

        {roteiro.problemas.map((p) => (
          <Aviso key={p.code} tipo="aviso">
            {p.message}
          </Aviso>
        ))}

        {roteiro.trocasFeitas > 0 ? (
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-xs text-slate-500">
              {fmtInteiro(roteiro.trocasFeitas)} troca(s) feita(s), {roteiro.concluidas.length}{' '}
              troca(s) concluída(s).{' '}
              {roteiro.recalculado
                ? 'O roteiro abaixo foi remontado a partir do progresso atual.'
                : 'O roteiro abaixo é o plano completo.'}
            </span>
            <TextButton onClick={() => setUsarProgresso(!usarProgresso)}>
              {roteiro.recalculado
                ? 'Voltar ao roteiro completo'
                : 'Recalcular a partir do progresso'}
            </TextButton>
            <TextButton variante="perigo" onClick={limparProgresso}>
              Limpar progresso
            </TextButton>
          </div>
        ) : null}
      </Section>

      {tudoFeito ? (
        <Aviso tipo="info">
          Plano concluído: todas as trocas foram marcadas. Limpe o progresso para rodar de novo.
        </Aviso>
      ) : null}

      {roteiro.viagens.length > 0 ? (
        <>
          <nav className="flex flex-wrap gap-1">
            {roteiro.viagens.map((v, i) => {
              const feitos = v.passos.filter((p) => p.concluido).length;
              return (
                <button
                  key={v.index}
                  type="button"
                  onClick={() => setViagemAtiva(i)}
                  className={`rounded px-3 py-1.5 text-sm ${
                    i === viagemAtiva
                      ? 'bg-mar text-white'
                      : 'border border-mar text-slate-400 hover:bg-mar/40'
                  }`}
                >
                  Viagem {v.index + 1}
                  <span className="ml-2 text-xs text-slate-500">
                    {feitos}/{v.passos.length}
                  </span>
                </button>
              );
            })}
          </nav>

          {viagem ? <AbaDaViagem viagem={viagem} /> : null}
        </>
      ) : null}
    </div>
  );
}

function Indicador({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="rounded border border-mar bg-abismo/60 p-3">
      <p className="text-xs uppercase text-slate-500">{rotulo}</p>
      <p className="text-lg font-semibold text-ouro">{valor}</p>
    </div>
  );
}
