import { createContext, useContext, useState } from 'react';
import type { ReactNode } from 'react';
import type { ResearchArea } from '@layerto/types';
import { Icon, cn } from '@layerto/ui';

export interface ResearchCtx {
  areas: ResearchArea[];
  /** Selected area id, or '' for all areas. */
  area: string;
  setArea: (id: string) => void;
  reloadAreas: () => Promise<void>;
  areaName: (id: string | null | undefined) => string;
  areaColor: (id: string | null | undefined) => string;
  /** Can the user add or edit items in the current scope? */
  canWrite: (areaId?: string | null) => boolean;
  go: (tab: string) => void;
}

export const ResearchContext = createContext<ResearchCtx | null>(null);

export function useResearch(): ResearchCtx {
  const c = useContext(ResearchContext);
  if (!c) throw new Error('useResearch outside ResearchContext');
  return c;
}

export const AREA_COLORS = ['#E11D48', '#2563EB', '#16A34A', '#D97706', '#7C3AED', '#0891B2', '#DB2777', '#475569'];

export function AreaDot({ id, className }: { id: string | null | undefined; className?: string }) {
  const { areaColor } = useResearch();
  return <span aria-hidden className={cn('inline-block size-2 shrink-0 rounded-full', className)} style={{ background: areaColor(id) }} />;
}

export function AreaTag({ id }: { id: string | null | undefined }) {
  const { areaName } = useResearch();
  if (!id) return null;
  return (
    <span className="inline-flex items-center gap-1.5 rounded-pill bg-page px-2 py-0.5 text-[11px] text-ink-secondary">
      <AreaDot id={id} />
      {areaName(id)}
    </span>
  );
}

/** Small label + textarea used by research editors. */
export function TextArea({
  label,
  value,
  onChange,
  rows = 4,
  placeholder,
  mono,
  maxLength,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  rows?: number;
  placeholder?: string;
  mono?: boolean;
  maxLength?: number;
  hint?: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium">{label}</span>
      <textarea
        rows={rows}
        value={value}
        maxLength={maxLength}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          'w-full rounded-control border border-line-strong bg-card px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-focus',
          mono && 'font-mono text-[13px]',
        )}
      />
      {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
    </label>
  );
}

/** Comma/Enter separated tags editor. */
export function TagInput({ label, value, onChange, placeholder }: { label: string; value: string[]; onChange: (v: string[]) => void; placeholder?: string }) {
  const [text, setText] = useState('');
  const add = () => {
    const parts = text
      .split(/[,;\n]/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (parts.length) onChange([...new Set([...value, ...parts])].slice(0, 30));
    setText('');
  };
  return (
    <div>
      <span className="mb-1.5 block text-sm font-medium">{label}</span>
      <div className="flex min-h-10 flex-wrap items-center gap-1.5 rounded-control border border-line-strong bg-card px-2 py-1.5 focus-within:ring-2 focus-within:ring-focus">
        {value.map((t) => (
          <span key={t} className="inline-flex items-center gap-1 rounded-pill bg-crimson-tint px-2 py-0.5 text-xs text-crimson">
            {t}
            <button type="button" aria-label={`Remove ${t}`} className="cursor-pointer" onClick={() => onChange(value.filter((x) => x !== t))}>
              <Icon name="close" size={11} />
            </button>
          </span>
        ))}
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ',') {
              e.preventDefault();
              add();
            } else if (e.key === 'Backspace' && !text && value.length) {
              onChange(value.slice(0, -1));
            }
          }}
          onBlur={add}
          aria-label={label}
          placeholder={value.length ? '' : placeholder}
          className="min-w-24 flex-1 bg-transparent px-1 text-sm outline-none"
        />
      </div>
    </div>
  );
}

/** Pill-style filter buttons. */
export function Pills<T extends string>({ value, onChange, items }: { value: T; onChange: (v: T) => void; items: { value: T; label: string; count?: number }[] }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((i) => (
        <button
          key={i.value}
          type="button"
          onClick={() => onChange(i.value)}
          className={cn(
            'rounded-pill border px-3 py-1 text-xs font-medium transition-colors cursor-pointer',
            value === i.value ? 'border-crimson bg-crimson-tint text-crimson' : 'border-line text-muted hover:text-ink hover:border-line-strong',
          )}
        >
          {i.label}
          {typeof i.count === 'number' && <span className="ml-1 opacity-70">{i.count}</span>}
        </button>
      ))}
    </div>
  );
}

export function SearchBox({ value, onChange, placeholder = 'Search' }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <label className="flex h-9 items-center gap-2 rounded-control border border-line bg-card px-3 text-sm focus-within:ring-2 focus-within:ring-focus">
      <Icon name="search" size={15} className="text-muted" />
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="w-40 bg-transparent outline-none sm:w-56" aria-label={placeholder} />
    </label>
  );
}

/** Options for an area <Select> limited to areas the user can edit. */
export function areaOptions(areas: ResearchArea[], none = 'No area') {
  return [{ value: '', label: none }, ...areas.filter((a) => a.role !== 'viewer').map((a) => ({ value: a.id, label: a.name }))];
}

export function num(v: unknown): number | undefined {
  return typeof v === 'number' && Number.isFinite(v) ? v : undefined;
}

export function daysUntil(date: string): number {
  const d = new Date(`${date}T00:00:00`);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - now.getTime()) / 86400000);
}
