import { useEffect, useMemo, useRef, useState } from 'react';
import type { PublicModelItem, WorkflowNodeType } from '@layerto/types';
import { Icon, cn } from '@layerto/ui';
import { STEP_META } from '../../lib/definition';
import { sectionModels } from '../../lib/modelSearch';
import { ModelRow } from '../ModelRow';

export interface StepPick {
  type: WorkflowNodeType;
  slug?: string;
}

export interface AddStepMenuProps {
  /** Position inside the canvas, in pixels. */
  x: number;
  y: number;
  allowed: WorkflowNodeType[];
  models: PublicModelItem[];
  favorites: string[];
  recent: string[];
  onToggleFavorite: (slug: string) => void;
  onPick: (pick: StepPick) => void;
  onClose: () => void;
}

interface Entry {
  key: string;
  pick: StepPick;
  model?: PublicModelItem;
}

/** Searchable menu for choosing the next step: logic steps and models (favourites first). */
export function AddStepMenu({ x, y, allowed, models, favorites, recent, onToggleFavorite, onPick, onClose }: AddStepMenuProps) {
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const panel = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    input.current?.focus();
    const onDown = (e: PointerEvent) => {
      if (panel.current && !panel.current.contains(e.target as Node)) onClose();
    };
    window.addEventListener('pointerdown', onDown, true);
    return () => window.removeEventListener('pointerdown', onDown, true);
  }, [onClose]);

  const sections = useMemo(() => (allowed.includes('model') ? sectionModels(models, query, favorites, recent) : null), [allowed, models, query, favorites, recent]);
  const logic = useMemo(
    () =>
      (['condition', 'for_each', 'output'] as WorkflowNodeType[])
        .filter((t) => allowed.includes(t))
        .filter((t) => !query || `${STEP_META[t].label} ${STEP_META[t].description}`.toLowerCase().includes(query.toLowerCase())),
    [allowed, query],
  );

  const groups: { title: string; entries: Entry[] }[] = [];
  if (sections?.favorites.length) groups.push({ title: 'Favourites', entries: sections.favorites.map((m) => ({ key: `f-${m.slug}`, pick: { type: 'model', slug: m.slug }, model: m })) });
  if (sections?.recent.length) groups.push({ title: 'Recently used', entries: sections.recent.map((m) => ({ key: `r-${m.slug}`, pick: { type: 'model', slug: m.slug }, model: m })) });
  if (logic.length) groups.push({ title: 'Logic', entries: logic.map((t) => ({ key: t, pick: { type: t } })) });
  if (sections?.others.length) groups.push({ title: sections.favorites.length || sections.recent.length ? 'All models' : 'Models', entries: sections.others.map((m) => ({ key: `m-${m.slug}`, pick: { type: 'model', slug: m.slug }, model: m })) });
  const flat = groups.flatMap((g) => g.entries);
  const current = Math.min(active, Math.max(flat.length - 1, 0));

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, flat.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && flat[current]) {
      e.preventDefault();
      onPick(flat[current].pick);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  let index = -1;
  return (
    <div
      ref={panel}
      role="dialog"
      aria-label="Add a step"
      onKeyDown={onKeyDown}
      className="absolute z-30 w-80 rounded-l2 border border-line-strong bg-card shadow-l3 overflow-hidden"
      style={{ left: x, top: y }}
    >
      <div className="flex items-center gap-2 px-3 border-b border-line">
        <Icon name="search" size={16} className="text-muted" />
        <input
          ref={input}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
          }}
          placeholder="Search models and steps…"
          aria-label="Search models and steps"
          className="flex-1 bg-transparent py-3 text-sm outline-none placeholder:text-muted/70"
        />
        <kbd className="text-[10px] font-semibold text-muted border border-line rounded px-1.5 py-0.5">Esc</kbd>
      </div>
      <div role="listbox" className="max-h-80 overflow-y-auto p-1.5">
        {flat.length === 0 && <p className="px-3 py-6 text-center text-sm text-muted">Nothing matches “{query}”.</p>}
        {groups.map((g) => (
          <div key={g.title} className="mb-1">
            <div className="px-2.5 pt-2 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted">{g.title}</div>
            {g.entries.map((entry) => {
              index++;
              const isActive = index === current;
              const at = index;
              if (entry.model) {
                return (
                  <div key={entry.key} onMouseEnter={() => setActive(at)}>
                    <ModelRow
                      model={entry.model}
                      active={isActive}
                      favorite={favorites.includes(entry.model.slug)}
                      onPick={() => onPick(entry.pick)}
                      onToggleFavorite={() => onToggleFavorite(entry.model!.slug)}
                    />
                  </div>
                );
              }
              const meta = STEP_META[entry.pick.type];
              return (
                <div
                  key={entry.key}
                  role="option"
                  aria-selected={isActive}
                  onMouseEnter={() => setActive(at)}
                  onClick={() => onPick(entry.pick)}
                  className={cn('flex items-center gap-3 px-2.5 py-2 rounded-control cursor-pointer', isActive ? 'bg-crimson-tint' : 'hover:bg-page')}
                >
                  <span
                    className={cn(
                      'grid place-items-center h-8 w-8 shrink-0 rounded-control text-white',
                      entry.pick.type === 'condition' ? 'bg-amber-500' : entry.pick.type === 'for_each' ? 'bg-emerald-600' : 'bg-ink text-page',
                    )}
                  >
                    <Icon name={meta.icon} size={16} />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold">{meta.label}</span>
                    <span className="block text-xs text-muted truncate">{meta.description}</span>
                  </span>
                </div>
              );
            })}
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between gap-2 px-3 py-2 border-t border-line text-[11px] text-muted">
        <span>
          <kbd className="font-semibold">↑↓</kbd> to move · <kbd className="font-semibold">Enter</kbd> to add
        </span>
        <span className="inline-flex items-center gap-1">
          <Icon name="star" size={12} /> to favourite
        </span>
      </div>
    </div>
  );
}
