import type { ReactNode } from 'react';

export function Section({
  titulo,
  descricao,
  children,
}: {
  titulo: string;
  descricao?: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-lg border border-mar/60 bg-casco p-5">
      <h2 className="text-base font-semibold text-slate-100">{titulo}</h2>
      {descricao ? <p className="mt-1 text-sm text-slate-400">{descricao}</p> : null}
      <div className="mt-4 space-y-4">{children}</div>
    </section>
  );
}

export function Field({
  label,
  hint,
  htmlFor,
  children,
}: {
  label: string;
  hint?: string;
  htmlFor?: string;
  children: ReactNode;
}) {
  return (
    <div className="grid gap-1.5 sm:grid-cols-[13rem_minmax(0,1fr)] sm:items-center sm:gap-4">
      <label htmlFor={htmlFor} className="text-sm text-slate-300">
        {label}
        {hint ? <span className="mt-0.5 block text-xs text-slate-500">{hint}</span> : null}
      </label>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

const inputClass =
  'w-full rounded border border-mar bg-abismo px-2.5 py-1.5 text-sm text-slate-100 outline-none focus:border-ouro disabled:opacity-50';

export function NumberInput({
  id,
  value,
  onChange,
  min,
  max,
  step,
  disabled,
  suffix,
}: {
  id?: string;
  value: number;
  onChange: (valor: number) => void;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  suffix?: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <input
        id={id}
        type="number"
        className={`${inputClass} max-w-40`}
        value={Number.isFinite(value) ? value : ''}
        min={min}
        max={max}
        step={step ?? 1}
        disabled={disabled}
        onChange={(e) => onChange(e.target.valueAsNumber)}
      />
      {suffix ? <span className="text-xs text-slate-500">{suffix}</span> : null}
    </div>
  );
}

export function Select<T extends string | number>({
  id,
  value,
  onChange,
  options,
  groups,
  disabled,
}: {
  id?: string;
  value: T;
  onChange: (valor: string) => void;
  options?: { value: T; label: string }[];
  groups?: { label: string; options: { value: T; label: string }[] }[];
  disabled?: boolean;
}) {
  return (
    <select
      id={id}
      className={`${inputClass} max-w-md`}
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
    >
      {options?.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
      {groups?.map((g) => (
        <optgroup key={g.label} label={g.label}>
          {g.options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}

export function Toggle({
  id,
  checked,
  onChange,
  label,
  disabled,
}: {
  id?: string;
  checked: boolean;
  onChange: (valor: boolean) => void;
  label?: string;
  disabled?: boolean;
}) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-slate-300">
      <input
        id={id}
        type="checkbox"
        className="size-4 accent-[var(--color-ouro)]"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      {label}
    </label>
  );
}

export function Aviso({
  tipo = 'aviso',
  children,
}: {
  tipo?: 'erro' | 'aviso' | 'info';
  children: ReactNode;
}) {
  const cores = {
    erro: 'border-red-500/50 bg-red-500/10 text-red-200',
    aviso: 'border-amber-500/50 bg-amber-500/10 text-amber-100',
    info: 'border-mar bg-mar/30 text-slate-300',
  } as const;
  return (
    <div className={`rounded border px-3 py-2 text-sm whitespace-pre-line ${cores[tipo]}`}>
      {children}
    </div>
  );
}

export function TextButton({
  onClick,
  children,
  variante = 'normal',
}: {
  onClick: () => void;
  children: ReactNode;
  variante?: 'normal' | 'perigo';
}) {
  const cor =
    variante === 'perigo'
      ? 'border-red-500/50 text-red-200 hover:bg-red-500/10'
      : 'border-mar text-slate-300 hover:bg-mar/40';
  return (
    <button type="button" onClick={onClick} className={`rounded border px-3 py-1.5 text-sm ${cor}`}>
      {children}
    </button>
  );
}
