import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Icon, cn, usd } from '@layerto/ui';

export interface PickerModel {
  slug: string;
  name: string;
  price_usd: string;
  group: 'Layerto' | 'My models' | 'Community';
  owner?: string;
  map?: number;
  classes?: string[];
  description?: string;
}

/** Searchable model chooser grouped by source, with price and accuracy at a glance. */
export function ModelPicker({ models, value, onChange, allowAuto = true, label = 'Model' }: { models: PickerModel[]; value: string; onChange: (slug: string) => void; allowAuto?: boolean; label?: string }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    setTimeout(() => input.current?.focus(), 10);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);
  const current = models.find((m) => m.slug === value);
  const groups = useMemo(() => {
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    const hit = (m: PickerModel) => words.every((w) => `${m.name} ${m.slug} ${m.owner ?? ''} ${(m.classes ?? []).join(' ')} ${m.description ?? ''}`.toLowerCase().includes(w));
    return (['My models', 'Layerto', 'Community'] as const).map((g) => ({ g, items: models.filter((m) => m.group === g && hit(m)) })).filter((x) => x.items.length);
  }, [models, q]);
  const pick = (slug: string) => {
    onChange(slug);
    setOpen(false);
    setQ('');
  };
  return (
    <div ref={ref} className="relative">
      <span className="mb-1.5 block text-xs font-semibold text-ink-secondary">{label}</span>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex h-11 w-full items-center gap-2 rounded-control border border-line-strong bg-card px-3 text-left text-sm transition-colors hover:border-crimson focus:outline-none focus:ring-2 focus:ring-focus cursor-pointer"
      >
        <Icon name={value === 'auto' ? 'route' : current?.group === 'My models' ? 'box' : current?.group === 'Community' ? 'users' : 'spark'} size={16} className="text-crimson" />
        <span className="min-w-0 flex-1 truncate font-medium">{value === 'auto' ? 'Auto: pick from my prompt' : current?.name ?? value}</span>
        {current && <span className="text-xs text-muted">{usd(current.price_usd)}</span>}
        <Icon name="chevronDown" size={15} className={cn('text-muted transition-transform', open && 'rotate-180')} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.12 }}
            className="absolute left-0 right-0 z-30 mt-1 overflow-hidden rounded-l2 border border-line bg-raised shadow-l3"
          >
            <div className="flex items-center gap-2 border-b border-line px-3">
              <Icon name="search" size={15} className="text-muted" />
              <input ref={input} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name, creator or class…" className="h-10 flex-1 bg-transparent text-sm outline-none" aria-label="Search models" />
            </div>
            <ul role="listbox" className="max-h-80 overflow-y-auto p-1.5">
              {allowAuto && !q && (
                <Option active={value === 'auto'} onClick={() => pick('auto')} icon="route" title="Auto" subtitle="Routes your prompt to the best catalogue model" />
              )}
              {groups.map(({ g, items }) => (
                <li key={g}>
                  <div className="px-2 pb-1 pt-2.5 text-[10px] font-bold uppercase tracking-wider text-muted">{g}</div>
                  <ul>
                    {items.map((m) => (
                      <Option
                        key={m.slug}
                        active={m.slug === value}
                        onClick={() => pick(m.slug)}
                        icon={g === 'My models' ? 'box' : g === 'Community' ? 'users' : 'spark'}
                        title={m.name}
                        subtitle={[m.owner && `@${m.owner}`, m.classes?.length ? `${m.classes.slice(0, 3).join(', ')}${m.classes.length > 3 ? '…' : ''}` : ''].filter(Boolean).join(' · ') || m.slug}
                        right={
                          <span className="text-right">
                            <span className="block text-xs font-semibold">{usd(m.price_usd)}</span>
                            {m.map != null && <span className="block text-[10px] text-muted">mAP {(m.map * 100).toFixed(1)}%</span>}
                          </span>
                        }
                      />
                    ))}
                  </ul>
                </li>
              ))}
              {groups.length === 0 && q && <li className="px-3 py-6 text-center text-sm text-muted">No models match “{q}”.</li>}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Option({ active, onClick, icon, title, subtitle, right }: { active: boolean; onClick: () => void; icon: 'route' | 'box' | 'users' | 'spark'; title: string; subtitle: string; right?: React.ReactNode }) {
  return (
    <li>
      <button type="button" role="option" aria-selected={active} onClick={onClick} className={cn('flex w-full items-center gap-3 rounded-control px-2.5 py-2 text-left cursor-pointer', active ? 'bg-crimson-tint' : 'hover:bg-page')}>
        <span className={cn('grid size-8 shrink-0 place-items-center rounded-control', active ? 'bg-crimson text-white' : 'bg-page text-muted')}>
          <Icon name={icon} size={15} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">{title}</span>
          <span className="block truncate text-[11px] text-muted">{subtitle}</span>
        </span>
        {right}
        {active && <Icon name="check" size={14} className="text-crimson" />}
      </button>
    </li>
  );
}
