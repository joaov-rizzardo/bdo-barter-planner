import { ItemBadge } from '../../components/ItemBadge';
import type { ViagemDoRoteiro } from '../../hooks/useRoteiro';
import { fmtInteiro, fmtLt } from '../../format';
import { PassoDoRoteiroItem } from './PassoDoRoteiroItem';

export function AbaDaViagem({ viagem }: { viagem: ViagemDoRoteiro }) {
  const concluidos = viagem.passos.filter((p) => p.concluido).length;

  return (
    <div className="rounded-lg border border-mar/60 bg-casco">
      <div className="grid gap-3 border-b border-mar/60 p-4 sm:grid-cols-4">
        <Indicador rotulo="Distância" valor={`${fmtInteiro(Math.round(viagem.distancia))} un.`} />
        <Indicador
          rotulo="Pico de peso"
          valor={`${fmtLt(viagem.picoPesoLt)}${viagem.emSobrepeso ? ' (sobrepeso)' : ''}`}
        />
        <Indicador rotulo="Pico de slots" valor={String(viagem.picoSlots)} />
        <Indicador rotulo="Barganha da viagem" valor={fmtInteiro(viagem.barganhaDaViagem)} />
      </div>

      {viagem.marinheirosDesequipados > 0 ? (
        <p className="border-b border-mar/60 bg-amber-500/10 px-4 py-2 text-xs text-amber-100">
          Antes de sair da base: desequipe {viagem.marinheirosDesequipados}{' '}
          {viagem.marinheirosDesequipados === 1 ? 'marinheiro' : 'marinheiros'} (libera{' '}
          {fmtLt(viagem.marinheirosDesequipadosLt)}) para caber as trocas desta viagem.
          {viagem.marinheirosDesequipados > 1 ? ' Comece pelos mais pesados.' : ''}
        </p>
      ) : viagem.marinheirosNoNavio > 0 ? (
        <p className="border-b border-mar/60 px-4 py-2 text-xs text-slate-400">
          Esta viagem cabe com todos os marinheiros: se desequipou algum, equipe de volta antes de
          sair da base.
        </p>
      ) : null}

      {viagem.inventario.length > 0 ? (
        <p className="flex flex-wrap items-center gap-2 border-b border-mar/60 px-4 py-2 text-xs text-slate-400">
          <span>No inventário do personagem (1 slot):</span>
          {viagem.inventario.map((i) => (
            <ItemBadge key={i.itemId} itemId={i.itemId} quantidade={i.qty} />
          ))}
        </p>
      ) : null}

      {viagem.vendidos.length > 0 ? (
        <p className="flex flex-wrap items-center gap-2 border-b border-mar/60 px-4 py-2 text-xs text-slate-400">
          <span>Vendidos no gerente de cais:</span>
          {viagem.vendidos.map((i, n) => (
            <ItemBadge key={`${i.itemId}-${n}`} itemId={i.itemId} quantidade={i.qty} />
          ))}
        </p>
      ) : null}

      <p className="px-4 pt-3 text-xs text-slate-500">
        {concluidos} de {viagem.passos.length} passos concluídos
      </p>

      <ul className="mt-1">
        {viagem.passos.map((passo) => (
          <PassoDoRoteiroItem key={passo.key} passo={passo} />
        ))}
      </ul>
    </div>
  );
}

function Indicador({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div>
      <p className="text-xs uppercase text-slate-500">{rotulo}</p>
      <p className="text-sm font-semibold text-slate-100">{valor}</p>
    </div>
  );
}
