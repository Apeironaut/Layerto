import { useId, useState } from 'react';
import type { ReactNode } from 'react';
import { Icon, cn } from '@layerto/ui';

export function FieldLabel({ htmlFor, children, hint }: { htmlFor?: string; children: ReactNode; hint?: ReactNode }) {
  return (
    <div className="mb-1.5">
      <label htmlFor={htmlFor} className="text-xs font-semibold text-ink-secondary">
        {children}
      </label>
      {hint && <p className="text-xs text-muted mt-0.5">{hint}</p>}
    </div>
  );
}

/** 0–1 confidence as a percentage slider. */
export function ConfidenceSlider({ label, hint, value, onChange }: { label: string; hint?: ReactNode; value: number; onChange: (v: number) => void }) {
  const id = useId();
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <FieldLabel htmlFor={id} hint={hint}>
          {label}
        </FieldLabel>
        <span className="font-mono text-sm font-semibold tabular-nums">{Math.round(value * 100)}%</span>
      </div>
      <input
        id={id}
        type="range"
        min={0}
        max={1}
        step={0.05}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-crimson cursor-grab active:cursor-grabbing"
      />
    </div>
  );
}

/** Whole-number input with − / + buttons. */
export function NumberStepper({ label, hint, value, min, max, onChange, suffix }: { label: string; hint?: ReactNode; value: number; min: number; max: number; onChange: (v: number) => void; suffix?: string }) {
  const id = useId();
  const clamp = (n: number) => Math.max(min, Math.min(max, Math.round(n)));
  const btn = 'grid place-items-center h-9 w-9 text-ink-secondary hover:bg-crimson-tint hover:text-crimson disabled:opacity-35 cursor-pointer';
  return (
    <div>
      <FieldLabel htmlFor={id} hint={hint}>
        {label}
      </FieldLabel>
      <div className="inline-flex items-center rounded-control border border-line bg-card overflow-hidden">
        <button type="button" className={btn} onClick={() => onChange(clamp(value - 1))} disabled={value <= min} aria-label={`Decrease ${label}`}>
          −
        </button>
        <input
          id={id}
          type="number"
          min={min}
          max={max}
          value={value}
          onChange={(e) => onChange(clamp(Number(e.target.value) || min))}
          className="w-14 h-9 text-center text-sm font-semibold tabular-nums bg-transparent outline-none border-x border-line"
        />
        <button type="button" className={btn} onClick={() => onChange(clamp(value + 1))} disabled={value >= max} aria-label={`Increase ${label}`}>
          +
        </button>
        {suffix && <span className="px-3 text-sm text-muted">{suffix}</span>}
      </div>
    </div>
  );
}

/** Labels typed as chips: Enter or comma adds, Backspace removes the last one. */
export function TagInput({ label, hint, values, onChange, placeholder, max = 50 }: { label: string; hint?: ReactNode; values: string[]; onChange: (v: string[]) => void; placeholder?: string; max?: number }) {
  const id = useId();
  const [draft, setDraft] = useState('');
  const add = (raw: string) => {
    const parts = raw.split(',').map((s) => s.trim()).filter(Boolean);
    const next = [...values];
    for (const p of parts) if (p.length <= 100 && !next.some((v) => v.toLowerCase() === p.toLowerCase()) && next.length < max) next.push(p);
    onChange(next);
    setDraft('');
  };
  return (
    <div>
      <FieldLabel htmlFor={id} hint={hint}>
        {label}
      </FieldLabel>
      <div className="flex flex-wrap items-center gap-1.5 min-h-10 px-2 py-1.5 rounded-control border border-line bg-card focus-within:border-crimson">
        {values.map((v) => (
          <span key={v} className="inline-flex items-center gap-1 pl-2 pr-1 py-0.5 rounded-pill bg-crimson-tint text-crimson text-xs font-semibold">
            {v}
            <button type="button" onClick={() => onChange(values.filter((x) => x !== v))} aria-label={`Remove ${v}`} className="grid place-items-center h-4 w-4 rounded-full hover:bg-crimson hover:text-white cursor-pointer">
              <Icon name="close" size={10} strokeWidth={3} />
            </button>
          </span>
        ))}
        <input
          id={id}
          value={draft}
          onChange={(e) => (e.target.value.endsWith(',') ? add(e.target.value) : setDraft(e.target.value))}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && draft.trim()) {
              e.preventDefault();
              add(draft);
            } else if (e.key === 'Backspace' && !draft && values.length) {
              onChange(values.slice(0, -1));
            }
          }}
          onBlur={() => draft.trim() && add(draft)}
          placeholder={values.length ? '' : placeholder}
          className="flex-1 min-w-24 bg-transparent text-sm outline-none py-1 placeholder:text-muted/70"
        />
      </div>
    </div>
  );
}

/** A titled, collapsible group of settings. */
export function Section({ title, children, defaultOpen = true, aside }: { title: string; children: ReactNode; defaultOpen?: boolean; aside?: ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="border-b border-line last:border-0">
      <div className="flex items-center gap-2 px-4 py-3">
        <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex flex-1 items-center gap-2 text-left text-sm font-bold cursor-pointer">
          <Icon name="arrowDown" size={16} className={cn('text-muted transition-transform', !open && '-rotate-90')} />
          {title}
        </button>
        {aside}
      </div>
      {open && <div className="px-4 pb-4 space-y-4">{children}</div>}
    </section>
  );
}

/** Radio cards: one option per row with a short hint. */
export function OptionCards<T extends string>({ label, options, value, onChange }: { label: string; options: { value: T; label: string; hint: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <fieldset>
      <legend className="text-xs font-semibold text-ink-secondary mb-1.5">{label}</legend>
      <div className="grid gap-1.5">
        {options.map((o) => (
          <label
            key={o.value}
            className={cn(
              'flex items-start gap-2.5 px-3 py-2 rounded-control border cursor-pointer transition-colors',
              value === o.value ? 'border-crimson bg-crimson-tint' : 'border-line hover:border-line-strong',
            )}
          >
            <input type="radio" className="mt-1 accent-crimson" checked={value === o.value} onChange={() => onChange(o.value)} />
            <span>
              <span className="block text-sm font-semibold">{o.label}</span>
              <span className="block text-xs text-muted">{o.hint}</span>
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
