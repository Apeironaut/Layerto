import { useMemo, useState } from 'react';
import type { PublicModelItem, WorkflowNodeType } from '@layerto/types';
import { Icon, SegmentedControl, Skeleton, cn } from '@layerto/ui';
import { STEP_META } from '../../lib/definition';
import { sectionModels } from '../../lib/modelSearch';
import { ModelRow } from '../ModelRow';

export const DRAG_MIME = 'application/x-layerto-step';

export interface StepPaletteProps {
  models: PublicModelItem[] | undefined;
  favorites: string[];
  recent: string[];
  onToggleFavorite: (slug: string) => void;
  onAdd: (type: WorkflowNodeType, slug?: string) => void;
  onCollapse: () => void;
}

type Tab = 'all' | 'favorites';

function dragData(e: React.DragEvent, type: WorkflowNodeType, slug?: string) {
  e.dataTransfer.setData(DRAG_MIME, JSON.stringify({ type, slug }));
  e.dataTransfer.effectAllowed = 'move';
}

/** Left panel: logic steps and models to drag onto the canvas (or click to add). */
export function StepPalette({ models, favorites, recent, onToggleFavorite, onAdd, onCollapse }: StepPaletteProps) {
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState<Tab>('all');
  const sections = useMemo(() => sectionModels(models ?? [], query, favorites, tab === 'all' ? recent : []), [models, query, favorites, recent, tab]);
  const shown = tab === 'favorites' ? sections.favorites : [...sections.favorites, ...sections.recent, ...sections.others];

  return (
    <aside className="w-64 shrink-0 border-r border-line bg-card flex flex-col min-h-0" aria-label="Steps">
      <div className="p-3 space-y-3 border-b border-line">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold">Steps</h2>
          <button type="button" onClick={onCollapse} aria-label="Hide the steps panel" title="Hide panel" className="p-1.5 rounded-control text-muted hover:text-ink hover:bg-page cursor-pointer">
            <Icon name="arrowLeft" size={16} />
          </button>
        </div>
        <div className="relative">
          <Icon name="search" size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search models"
            aria-label="Search models"
            className="w-full pl-9 pr-3 py-2 text-sm rounded-control border border-line bg-page focus:border-crimson outline-none"
          />
        </div>
        <SegmentedControl
          label="Show"
          segments={[
            { value: 'all', label: 'All' },
            { value: 'favorites', label: `Favourites${favorites.length ? ` (${favorites.length})` : ''}` },
          ]}
          value={tab}
          onChange={setTab}
        />
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {tab === 'all' && !query && (
          <section className="mb-3">
            <h3 className="px-2.5 pt-1 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted">Logic</h3>
            {(['condition', 'for_each'] as const).map((t) => (
              <div
                key={t}
                draggable
                onDragStart={(e) => dragData(e, t)}
                onClick={() => onAdd(t)}
                className="group flex items-center gap-3 px-2.5 py-2 rounded-control cursor-grab active:cursor-grabbing hover:bg-page"
              >
                <span className={cn('grid place-items-center h-8 w-8 shrink-0 rounded-control text-white', t === 'condition' ? 'bg-amber-500' : 'bg-emerald-600')}>
                  <Icon name={STEP_META[t].icon} size={16} />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold">{STEP_META[t].label}</span>
                  <span className="block text-xs text-muted line-clamp-2">{STEP_META[t].description}</span>
                </span>
              </div>
            ))}
          </section>
        )}

        <section>
          <h3 className="px-2.5 pt-1 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted">
            {tab === 'favorites' ? 'Favourite models' : 'Models'}
          </h3>
          {!models ? (
            <div className="space-y-2 px-1">
              <Skeleton className="h-12" />
              <Skeleton className="h-12" />
            </div>
          ) : shown.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-muted">
              {tab === 'favorites' ? 'Star a model to keep it here.' : `No models match “${query}”.`}
            </p>
          ) : (
            <div role="listbox" aria-label="Models">
              {shown.map((m) => (
                <ModelRow
                  key={m.slug}
                  model={m}
                  favorite={favorites.includes(m.slug)}
                  onPick={() => onAdd('model', m.slug)}
                  onToggleFavorite={() => onToggleFavorite(m.slug)}
                  draggable
                  onDragStart={(e) => dragData(e, 'model', m.slug)}
                />
              ))}
            </div>
          )}
        </section>
      </div>
      <p className="px-4 py-3 border-t border-line text-xs text-muted">Drag onto the canvas, or click to add after the selected step.</p>
    </aside>
  );
}
