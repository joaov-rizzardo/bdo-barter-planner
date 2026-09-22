import { useDataStore } from '../../../store/dataStore';
import { Aviso, Section } from '../../components/controls';
import { ItemBadge } from '../../components/ItemBadge';
import { nomeDaIlha } from '../../describe';
import { fmtInteiro } from '../../format';
import { useIlhas } from '../../hooks/useIlhas';
import type { CadeiaDoPlano } from '../../hooks/useCadeia';
import type { FaltaDeOrigem } from '../../../core/chain/resolveChain';

/**
 * Entradas sem origem. O app não adiciona nada: só mostra o que falta e em
 * quais portos existe a troca precedente, para o usuário informá-la.
 */
export function PainelFaltas({ cadeia }: { cadeia: CadeiaDoPlano }) {
  const items = useDataStore((s) => s.items);
  const ilhas = useIlhas();

  if (cadeia.faltas.length === 0) return null;

  return (
    <Section
      titulo={`Trocas precedentes que faltam (${cadeia.faltas.length})`}
      descricao="Informe a troca que produz o item ou marque que você já tem o item em estoque."
    >
      {cadeia.faltas.map((falta) => (
        <div key={falta.itemId} className="rounded border border-mar bg-abismo/60 p-3">
          <p className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-slate-400">Faltam {fmtInteiro(falta.qty)}×</span>
            <ItemBadge itemId={falta.itemId} />
          </p>

          {falta.possivel ? (
            <>
              <p className="mt-2 text-xs uppercase text-slate-500">
                Portos que fazem essa troca ({falta.opcoes.length})
              </p>
              <ul className="mt-1 space-y-1 text-sm">
                {falta.opcoes.map((opcao) => (
                  <li key={opcao.routeKey} className="flex flex-wrap items-center gap-2">
                    <span className="text-slate-300">{nomeDaIlha(opcao.islandId, ilhas)}</span>
                    <span className="text-slate-500">·</span>
                    <span>
                      {fmtInteiro(opcao.giveQty)}× {items.nameOf(opcao.giveItemId)} →{' '}
                      {opcao.receiveQtyMax > opcao.receiveQty
                        ? `${fmtInteiro(opcao.receiveQty)}–${fmtInteiro(opcao.receiveQtyMax)}`
                        : fmtInteiro(opcao.receiveQty)}
                      × {items.nameOf(falta.itemId)}
                    </span>
                    <span className="text-xs text-slate-500">
                      máx {opcao.maxTrades} · {fmtInteiro(opcao.baseBarterCost)} barganha
                    </span>
                  </li>
                ))}
              </ul>
              {falta.opcoes[0] ? <EstimativaDeTrocas falta={falta} /> : null}
            </>
          ) : (
            <Aviso tipo="erro">
              Não existe troca precedente possível para esse item em nenhum ponto da cadeia: marque
              o estoque na troca ou remova a troca do plano.
            </Aviso>
          )}
        </div>
      ))}
    </Section>
  );
}

/** Quantas trocas da primeira opção cobrem a falta (faixa, quando a rota varia). */
function EstimativaDeTrocas({ falta }: { falta: FaltaDeOrigem }) {
  const opcao = falta.opcoes[0]!;
  const maximo = Math.ceil(falta.qty / opcao.receiveQty);
  const minimo = Math.ceil(falta.qty / opcao.receiveQtyMax);

  return (
    <p className="mt-2 text-xs text-slate-500">
      Precisa de {minimo === maximo ? minimo : `${minimo} a ${maximo}`} troca(s) na primeira opção
      para cobrir a quantidade.
    </p>
  );
}
