import { useMemo, useState } from 'react';
import type { PublicModelItem, WorkflowModelConfig } from '@layerto/types';
import { Chip, Icon, Input, usd } from '@layerto/ui';
import { sectionModels } from '../../lib/modelSearch';
import { ModelRow } from '../ModelRow';
import { ConfidenceSlider, FieldLabel } from './controls';

export interface ModelSettingsProps {
  config: WorkflowModelConfig;
  models: PublicModelItem[];
  favorites: string[];
  recent: string[];
  onToggleFavorite: (slug: string) => void;
  onModelUsed: (slug: string) => void;
  onChange: (p: Partial<WorkflowModelConfig>) => void;
}

export function ModelSettings({ config, models, favorites, recent, onToggleFavorite, onModelUsed, onChange }: ModelSettingsProps) {
  const [query, setQuery] = useState('');
  const [picking, setPicking] = useState(!config.model_slug);
  const current = models.find((m) => m.slug === config.model_slug);
  const sections = useMemo(() => sectionModels(models, query, favorites, recent), [models, query, favorites, recent]);
  const list = [...sections.favorites, ...sections.recent, ...sections.others];

  return (
    <div className="space-y-4">
      <div>
        <FieldLabel>Model</FieldLabel>
        {current && !picking ? (
          <div className="rounded-l2 border border-line p-3 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-bold truncate">{current.name}</p>
                <p className="text-xs text-muted font-mono">{current.slug}</p>
              </div>
              <button
                type="button"
                onClick={() => onToggleFavorite(current.slug)}
                aria-pressed={favorites.includes(current.slug)}
                aria-label={favorites.includes(current.slug) ? 'Remove from favourites' : 'Add to favourites'}
                className="p-1.5 rounded-control text-amber-500 hover:bg-page cursor-pointer"
              >
                <Icon name="star" size={18} fill={favorites.includes(current.slug) ? 'currentColor' : 'none'} />
              </button>
            </div>
            <p className="text-sm text-ink-secondary line-clamp-3">{current.description}</p>
            <div className="flex flex-wrap gap-1.5">
              <Chip variant="brand">{usd(current.price_usd)} / call</Chip>
              <Chip variant="neutral">{current.is_open ? 'Open model' : 'Layerto model'}</Chip>
            </div>
            <button type="button" onClick={() => setPicking(true)} className="text-sm font-semibold text-crimson hover:underline underline-offset-2 cursor-pointer">
              Change model
            </button>
          </div>
        ) : (
          <div className="rounded-l2 border border-line overflow-hidden">
            <div className="flex items-center gap-2 px-3 border-b border-line">
              <Icon name="search" size={15} className="text-muted" />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search models" aria-label="Search models" className="flex-1 py-2.5 text-sm bg-transparent outline-none" autoFocus />
            </div>
            <div role="listbox" className="max-h-64 overflow-y-auto p-1">
              {list.length === 0 && <p className="p-4 text-center text-sm text-muted">No models match.</p>}
              {list.map((m) => (
                <ModelRow
                  key={m.slug}
                  model={m}
                  active={m.slug === config.model_slug}
                  favorite={favorites.includes(m.slug)}
                  onToggleFavorite={() => onToggleFavorite(m.slug)}
                  onPick={() => {
                    onChange({ model_slug: m.slug });
                    onModelUsed(m.slug);
                    setPicking(false);
                    setQuery('');
                  }}
                />
              ))}
            </div>
          </div>
        )}
        {config.model_slug && !current && <p className="mt-2 text-xs text-crimson">“{config.model_slug}” is disabled or no longer exists. Choose another model.</p>}
      </div>
      <Input
        label="Step name (optional)"
        placeholder={current?.name ?? 'e.g. Detect turtles'}
        maxLength={60}
        value={config.label}
        onChange={(e) => onChange({ label: e.target.value })}
        helperText="Shown on the canvas and used as the step name in results."
      />
      <ConfidenceSlider
        label="Ignore predictions below"
        hint="Weaker predictions from this step are dropped before anything else sees them."
        value={config.min_confidence}
        onChange={(min_confidence) => onChange({ min_confidence })}
      />
    </div>
  );
}
