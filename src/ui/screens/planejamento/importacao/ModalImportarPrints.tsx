import { useEffect, useRef, useState } from 'react';
import { trocasSelecionadas } from '../../../../core/ocr/paraTroca';
import { incluirLeitura, type ItemDeRevisao } from '../../../../core/ocr/revisao';
import { usePlanStore } from '../../../../store/planStore';
import { Aviso } from '../../../components/controls';
import { Modal } from '../../../components/Modal';
import { useLeitorDePrints } from '../../../hooks/useLeitorDePrints';
import { AreaDePrints } from './AreaDePrints';
import { RevisaoDeTrocas } from './RevisaoDeTrocas';

/**
 * Importação de trocas a partir de prints da janela "Informações de Permuta":
 * o usuário junta as prints (arquivos, Ctrl+V, arrastar), manda ler, revisa as
 * trocas encontradas e leva as marcadas para o plano.
 */
export function ModalImportarPrints({
  onFechar,
  onImportar,
}: {
  onFechar: () => void;
  /** Chamado com o número de trocas que entraram no plano. */
  onImportar: (quantidade: number) => void;
}) {
  const { prints, progresso, lendo, adicionar, remover, lerTodas } = useLeitorDePrints();
  const plano = usePlanStore((s) => s.trades);
  const adicionarAoPlano = usePlanStore((s) => s.adicionar);
  const [itens, setItens] = useState<ItemDeRevisao[]>([]);
  const incluidas = useRef(new Set<string>());

  // Cada print lida entra na revisão assim que termina, sem esperar as outras.
  useEffect(() => {
    const novas = prints.filter((p) => p.resultado && !incluidas.current.has(p.id));
    if (novas.length === 0) return;
    for (const p of novas) incluidas.current.add(p.id);
    setItens((atuais) =>
      novas.reduce(
        (lista, p) => incluirLeitura(lista, { origem: p.nome, trocas: p.resultado!.trocas }, plano),
        atuais,
      ),
    );
  }, [prints, plano]);

  const aLer = prints.filter((p) => p.estado === 'pendente' || p.estado === 'erro').length;
  const semTrocas = prints.filter((p) => p.estado === 'pronta' && p.resultado?.trocas.length === 0);
  const comErro = prints.filter((p) => p.estado === 'erro');
  const marcadas = itens.filter((i) => i.selecionada).length;

  const importar = () => {
    const trocas = trocasSelecionadas(itens);
    for (const troca of trocas) adicionarAoPlano(troca);
    onImportar(trocas.length);
  };

  return (
    <Modal
      titulo="Importar trocas de prints"
      onFechar={onFechar}
      tamanho="xl"
      // Com trocas lidas (ou lendo), Esc e clique fora não descartam o trabalho.
      fechamentoRapido={!lendo && itens.length === 0}
      acoes={
        <>
          <button
            type="button"
            onClick={onFechar}
            className="rounded border border-mar px-3 py-1.5 text-sm text-slate-300 hover:bg-mar/40"
          >
            Cancelar
          </button>
          {aLer > 0 || lendo ? (
            <button
              type="button"
              disabled={lendo}
              onClick={() => void lerTodas(prints)}
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
