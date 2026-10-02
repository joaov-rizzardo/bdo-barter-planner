import { Aviso } from '../../../components/controls';
import { ItemBadge } from '../../../components/ItemBadge';
import { Modal } from '../../../components/Modal';
import { nomeDaIlha } from '../../../describe';
import { useIlhas } from '../../../hooks/useIlhas';
import { useLeitorDePrints } from '../../../hooks/useLeitorDePrints';
import { AreaDePrints } from './AreaDePrints';

/**
 * Importação de trocas a partir de prints da janela "Informações de Permuta":
 * o usuário junta as prints (arquivos, Ctrl+V, arrastar), manda ler e confere
 * o que foi encontrado.
 */
export function ModalImportarPrints({ onFechar }: { onFechar: () => void }) {
  const { prints, lendo, progresso, adicionar, remover, lerTodas } = useLeitorDePrints();
  const ilhas = useIlhas();

  const aLer = prints.filter((p) => p.estado === 'pendente' || p.estado === 'erro').length;
  const lidas = prints.filter((p) => p.estado === 'pronta');

  return (
    <Modal
      titulo="Importar trocas de prints"
      onFechar={onFechar}
      tamanho="xl"
      acoes={
        <>
          <button
            type="button"
            onClick={onFechar}
            className="rounded border border-mar px-3 py-1.5 text-sm text-slate-300 hover:bg-mar/40"
          >
            Fechar
          </button>
          <button
            type="button"
            disabled={lendo || aLer === 0}
            onClick={() => void lerTodas(prints)}
            className="rounded bg-ouro px-4 py-1.5 text-sm font-semibold text-abismo disabled:opacity-40"
          >
            {lendo ? 'Lendo…' : aLer > 0 ? `Ler ${aLer} print${aLer > 1 ? 's' : ''}` : 'Ler prints'}
          </button>
        </>
      }
    >
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
        <AreaDePrints prints={prints} lendo={lendo} onAdicionar={adicionar} onRemover={remover} />

        {progresso ? (
          <Aviso tipo="info">
            Lendo print {progresso.atual} de {progresso.total}… A primeira leitura também carrega o
            leitor de texto, então demora um pouco mais.
          </Aviso>
        ) : null}

        {lidas.map((p) => (
          <section key={p.id} className="rounded border border-mar/60">
            <h3 className="border-b border-mar/60 px-3 py-2 text-xs font-semibold text-slate-300">
              {p.nome} — {p.resultado?.trocas.length ?? 0} troca(s)
            </h3>
            {p.resultado && p.resultado.trocas.length > 0 ? (
              <ul className="divide-y divide-mar/30">
                {p.resultado.trocas.map((t, i) => (
                  <li key={i} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-1.5">
                    <span className="w-48 truncate text-slate-200">
                      {nomeDaIlha(t.rota.islandId, ilhas)}
                    </span>
                    <ItemBadge itemId={t.rota.giveItemId} quantidade={t.rota.giveQty} />
                    <span className="text-slate-500">→</span>
                    <ItemBadge itemId={t.rota.receiveItemId} quantidade={t.recebePorTroca} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-3 py-2 text-xs text-slate-500">
                Nenhuma troca encontrada. A print mostra a janela “Informações de Permuta”?
              </p>
            )}
          </section>
        ))}
      </div>
    </Modal>
  );
}
