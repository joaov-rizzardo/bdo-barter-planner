import { useEffect, useMemo, useRef, useState } from 'react';
import type { ItemInfo } from '../../core/models/itemIndex';
import type { Tier } from '../../core/models/types';
import { useDataStore } from '../../store/dataStore';
import { semAcento } from '../format';
import { rotuloTier, TIERS_EM_ORDEM } from '../tiers';
import { Modal } from './Modal';

const TODOS = 'todos';

/**
 * Escolha de item em modal: abas por tier, busca por nome (pt ou inglês,
 * ignorando acentos) e ícone de cada item.
 */
export function SeletorDeItem({
  value,
  opcoes,
  onChange,
  titulo,
  placeholder = '— selecione —',
  disabled,
  id,
}: {
  value: string;
  /** Ids dos itens que podem ser escolhidos. */
  opcoes: readonly string[];
  onChange: (itemId: string) => void;
  titulo: string;
  placeholder?: string;
  disabled?: boolean;
  id?: string;
}) {
  const items = useDataStore((s) => s.items);
  const [aberto, setAberto] = useState(false);
  const selecionado = value ? items.get(value) : undefined;

  const infos = useMemo(
    () =>
      opcoes
        .map((itemId) => items.get(itemId))
        .filter((i): i is ItemInfo => i !== undefined)
        .sort((a, b) => a.namePt.localeCompare(b.namePt, 'pt-BR')),
    [opcoes, items],
  );

  return (
    <>
      <button
        id={id}
        type="button"
        disabled={disabled || infos.length === 0}
        onClick={() => setAberto(true)}
        title={selecionado?.namePt}
        className="flex w-full max-w-md items-center gap-2 rounded border border-mar bg-abismo px-2.5 py-1.5 text-left text-sm text-slate-100 hover:border-ouro disabled:opacity-50"
      >
        {selecionado ? (
          <>
            <Icone info={selecionado} />
            <span className="min-w-0 flex-1 truncate">{selecionado.namePt}</span>
            <span className="shrink-0 text-xs text-slate-500">{rotuloTier(selecionado.tier)}</span>
          </>
        ) : (
          <span className="flex-1 text-slate-500">
            {infos.length === 0 ? 'nenhuma opção disponível' : placeholder}
          </span>
        )}
        <span aria-hidden className="text-slate-500">
          ▾
        </span>
      </button>

      {aberto ? (
        <ModalDeItens
          titulo={titulo}
          infos={infos}
          value={value}
          onFechar={() => setAberto(false)}
          onEscolher={(itemId) => {
            onChange(itemId);
            setAberto(false);
          }}
        />
      ) : null}
    </>
  );
}

function ModalDeItens({
  titulo,
  infos,
  value,
  onFechar,
  onEscolher,
}: {
  titulo: string;
  infos: ItemInfo[];
  value: string;
  onFechar: () => void;
  onEscolher: (itemId: string) => void;
}) {
  const [busca, setBusca] = useState('');
  const [tier, setTier] = useState<Tier | typeof TODOS>(TODOS);
  const campoBusca = useRef<HTMLInputElement>(null);

  useEffect(() => {
    campoBusca.current?.focus();
  }, []);

  const tiersPresentes = useMemo(
    () => TIERS_EM_ORDEM.filter((t) => infos.some((i) => i.tier === t)),
    [infos],
  );

  const visiveis = useMemo(() => {
    const termo = semAcento(busca.trim());
    return infos.filter((i) => {
      if (tier !== TODOS && i.tier !== tier) return false;
      if (!termo) return true;
      // o nome em inglês não aparece na lista, mas continua valendo na busca
      return semAcento(`${i.namePt} ${i.name}`).includes(termo);
    });
  }, [infos, busca, tier]);

  const abas: { id: Tier | typeof TODOS; label: string; total: number }[] = [
    { id: TODOS, label: 'Todos', total: infos.length },
    ...tiersPresentes.map((t) => ({
      id: t,
      label: rotuloTier(t),
      total: infos.filter((i) => i.tier === t).length,
    })),
  ];

  return (
    <Modal titulo={titulo} onFechar={onFechar} tamanho="lg">
      <input
        ref={campoBusca}
        type="search"
        value={busca}
        placeholder="Buscar item…"
        onChange={(e) => setBusca(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && visiveis[0]) onEscolher(visiveis[0].id);
        }}
        className="w-full rounded border border-mar bg-abismo px-2.5 py-1.5 text-sm text-slate-100 outline-none focus:border-ouro"
      />

      {abas.length > 2 ? (
        <nav className="flex flex-wrap gap-1">
          {abas.map((aba) => (
            <button
              key={aba.id}
              type="button"
              onClick={() => setTier(aba.id)}
              className={`rounded px-2.5 py-1 text-xs ${
                aba.id === tier
                  ? 'bg-mar text-white'
                  : 'border border-mar text-slate-400 hover:bg-mar/40'
              }`}
            >
              {aba.label}
              <span className="ml-1.5 text-slate-500">{aba.total}</span>
            </button>
          ))}
        </nav>
      ) : null}

      <div className="min-h-0 flex-1 overflow-y-auto rounded border border-mar">
        {visiveis.length === 0 ? (
          <p className="p-4 text-sm text-slate-500">Nenhum item encontrado.</p>
        ) : (
          <ul className="grid grid-cols-1 sm:grid-cols-2">
            {visiveis.map((info) => (
              <li key={info.id}>
                <button
                  type="button"
                  title={info.namePt}
                  onClick={() => onEscolher(info.id)}
                  className={`flex w-full items-center gap-2 border-b border-mar/40 px-3 py-2 text-left text-sm hover:bg-mar/30 ${
                    info.id === value ? 'bg-mar/40 text-white' : 'text-slate-200'
                  }`}
                >
                  <Icone info={info} />
                  <span className="min-w-0 flex-1 truncate">{info.namePt}</span>
                  <span className="shrink-0 text-xs text-slate-500">{rotuloTier(info.tier)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className="text-xs text-slate-500">
        {visiveis.length} de {infos.length} itens · Enter escolhe o primeiro · Esc fecha
      </p>
    </Modal>
  );
}

function Icone({ info }: { info: ItemInfo }) {
  return info.icon ? (
    <img src={`/${info.icon}`} alt="" className="size-7 shrink-0" loading="lazy" />
  ) : (
    <span className="size-7 shrink-0 rounded bg-mar/60" />
  );
}
