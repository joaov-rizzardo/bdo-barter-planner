import { useEffect, useMemo, useState } from 'react';
import {
  barganhaDaImportacao,
  trocasSelecionadas,
  type BarganhaDaImportacao,
} from '../../../../core/ocr/paraTroca';
import { usePlanStore } from '../../../../store/planStore';
import { useSettingsStore } from '../../../../store/settingsStore';
import { fmtInteiro } from '../../../format';
import { Aviso } from '../../../components/controls';
import { Modal } from '../../../components/Modal';
import { useLeitorDePrints } from '../../../hooks/useLeitorDePrints';
import { AreaDePrints } from './AreaDePrints';
import { RevisaoDeTrocas } from './RevisaoDeTrocas';

/**
 * Importação de trocas a partir de prints da janela "Informações de Permuta":
 * o usuário junta as prints (arquivos, Ctrl+V, arrastar), manda ler, revisa as
 * trocas encontradas e leva as marcadas para o plano. Prints e revisão ficam
 * guardadas ao fechar o modal (`useLeitorDePrints`); só o "Limpar" descarta.
 */
export function ModalImportarPrints({
  onFechar,
  onImportar,
}: {
  onFechar: () => void;
  /** Chamado com o número de trocas que entraram no plano. */
  onImportar: (quantidade: number) => void;
}) {
  const { prints, progresso, lendo, itens, adicionar, remover, lerTodas, setItens } =
    useLeitorDePrints();
  const sincronizar = useLeitorDePrints((s) => s.sincronizar);
  const limpar = useLeitorDePrints((s) => s.limpar);
  const plano = usePlanStore((s) => s.trades);
  const adicionarAoPlano = usePlanStore((s) => s.adicionar);
  const barter = useSettingsStore((s) => s.settings.barter);
  /** Limpar pede um segundo clique para confirmar. */
  const [confirmandoLimpeza, setConfirmandoLimpeza] = useState(false);

  // O plano pode ter mudado com o modal fechado (troca importada ou removida).
  useEffect(() => sincronizar(), [plano, sincronizar]);

  const aLer = prints.filter((p) => p.estado === 'pendente' || p.estado === 'erro').length;
  const semTrocas = prints.filter((p) => p.estado === 'pronta' && p.resultado?.trocas.length === 0);
  const comErro = prints.filter((p) => p.estado === 'erro');
  const marcadas = itens.filter((i) => i.selecionada && !i.jaNoPlano).length;
  const barganha = useMemo(
    () => barganhaDaImportacao(itens, plano, barter),
    [itens, plano, barter],
  );

  const importar = () => {
    const trocas = trocasSelecionadas(itens);
    for (const troca of trocas) adicionarAoPlano(troca);
    sincronizar();
    onImportar(trocas.length);
  };

  const vazio = prints.length === 0 && itens.length === 0;

  return (
    <Modal
      titulo="Importar trocas de prints"
      onFechar={onFechar}
      tamanho="xl"
      acoes={
        <>
          {vazio ? null : (
            <button
              type="button"
              onClick={() => {
                if (!confirmandoLimpeza) return setConfirmandoLimpeza(true);
                limpar();
                setConfirmandoLimpeza(false);
              }}
              onBlur={() => setConfirmandoLimpeza(false)}
              title="Descarta as prints e as trocas lidas"
              className={`rounded border px-3 py-1.5 text-sm ${
                confirmandoLimpeza
                  ? 'border-red-500 bg-red-500/20 text-red-200'
                  : 'border-mar text-slate-300 hover:bg-mar/40'
              }`}
            >
              {confirmandoLimpeza ? 'Clique de novo para limpar tudo' : 'Limpar'}
            </button>
          )}
          {itens.length > 0 ? (
            <ResumoDaBarganha barganha={barganha} />
          ) : (
            <span className="mr-auto" />
          )}
          <button
            type="button"
            onClick={onFechar}
            className="rounded border border-mar px-3 py-1.5 text-sm text-slate-300 hover:bg-mar/40"
          >
            Fechar
          </button>
          {aLer > 0 || lendo ? (
            <button
              type="button"
              disabled={lendo}
              onClick={() => void lerTodas()}
              className={`rounded px-4 py-1.5 text-sm font-semibold disabled:opacity-40 ${
                itens.length > 0 ? 'border border-ouro text-ouro' : 'bg-ouro text-abismo'
              }`}
            >
              {lendo ? 'Lendo…' : `Ler ${aLer} print${aLer > 1 ? 's' : ''}`}
            </button>
          ) : null}
          {itens.length > 0 ? (
            <button
              type="button"
              disabled={marcadas === 0}
              onClick={importar}
              className="rounded bg-ouro px-4 py-1.5 text-sm font-semibold text-abismo disabled:opacity-40"
            >
              Adicionar {marcadas} troca{marcadas === 1 ? '' : 's'} ao planejamento
            </button>
          ) : null}
        </>
      }
    >
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
        <AreaDePrints prints={prints} lendo={lendo} onAdicionar={adicionar} onRemover={remover} />

        {progresso ? (
          <Aviso tipo="info">
            Lendo print {progresso.atual} de {progresso.total}… A primeira leitura também carrega o
            leitor de texto, então demora um pouco mais. As trocas já lidas aparecem abaixo.
          </Aviso>
        ) : null}

        {comErro.map((p) => (
          <Aviso key={p.id} tipo="erro">
            {p.nome}: {p.erro}
          </Aviso>
        ))}
        {semTrocas.map((p) => (
          <Aviso key={p.id} tipo="aviso">
            {p.nome}: nenhuma troca encontrada. A print mostra a janela “Informações de Permuta” com
            a lista de trocas?
          </Aviso>
        ))}

        {itens.length > 0 ? <RevisaoDeTrocas itens={itens} onMudar={setItens} /> : null}
      </div>
    </Modal>
  );
}

/** Barganha das marcadas frente ao que o plano deixa livre; atualiza a cada marcação. */
function ResumoDaBarganha({ barganha }: { barganha: BarganhaDaImportacao }) {
  const { livre, doPlano, selecionadas, sobra, vouchersNecessarios } = barganha;
  const passou = sobra < 0;
  return (
    <div
      className="mr-auto flex flex-wrap items-baseline gap-x-3 gap-y-0.5 self-center text-xs"
      title={`Plano atual já usa ${fmtInteiro(doPlano)} de barganha`}
    >
      <span className="text-slate-400">
        Livre <span className="text-slate-200">{fmtInteiro(livre)}</span>
      </span>
      <span className="text-slate-400">
        Marcadas <span className="text-ouro">−{fmtInteiro(selecionadas)}</span>
      </span>
      {passou ? (
        <span className="font-semibold text-red-300">
          Passa {fmtInteiro(-sobra)} ({vouchersNecessarios} refresh
          {vouchersNecessarios === 1 ? '' : 'es'})
        </span>
      ) : (
        <span className="text-slate-400">
          Sobra <span className="font-semibold text-emerald-300">{fmtInteiro(sobra)}</span>
        </span>
      )}
    </div>
  );
}
