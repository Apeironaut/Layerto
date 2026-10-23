import { useState } from 'react';
import type { ArenaItem } from '@layerto/types';
import { Button, Icon } from '@layerto/ui';
import { useAreaVault } from '../ResearchAreaBoundary';

interface VisualErrorArenaProps {
  items: ArenaItem[];
}

export function VisualErrorArena({ items }: VisualErrorArenaProps) {
  const { area, scopedClient } = useAreaVault();
  const [filter, setFilter] = useState<'all' | 'false_positive' | 'disagreement' | 'boundary_uncertainty'>('all');
  const [selectedId, setSelectedId] = useState<string>(() => items[0]?.id ?? '');
  const [pushing, setPushing] = useState(false);
  const [pushedIds, setPushedIds] = useState<Set<string>>(new Set());
  const [pushMsg, setPushMsg] = useState<string | null>(null);

  const filteredItems = filter === 'all' ? items : items.filter((it) => it.failure_category === filter);
  const activeItem = items.find((it) => it.id === selectedId) ?? filteredItems[0] ?? items[0];

  const handlePushToQueue = async () => {
    if (!activeItem) return;
    setPushing(true);
    try {
      await scopedClient.researchCreate('active-labeling-queue', {
        area_id: area.id,
        specimen_id: activeItem.specimen_id,
        specimen_name: activeItem.sample_name,
        media_url: activeItem.image_url,
        predicted_label: (activeItem.model_a_prediction as any)?.label || 'Predicted Species',
        confidence: (activeItem.model_a_prediction as any)?.confidence || 0.45,
        alternative_label: (activeItem.model_b_prediction as any)?.label || 'Alternative Species',
        status: 'pending',
      });
      setPushedIds((prev) => new Set(prev).add(activeItem.id));
      setPushMsg(`✓ Pushed "${activeItem.sample_name}" to Domain Biologist Queue`);
      setTimeout(() => setPushMsg(null), 3000);
    } catch (err) {
      console.error('Failed to push item to queue', err);
    } finally {
      setPushing(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Category Filter Pills */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <span className="font-semibold text-muted mr-1">Error Arena Filters:</span>
          <button
            type="button"
            onClick={() => setFilter('all')}
            className={`rounded-pill px-3 py-1 font-medium transition-all ${
              filter === 'all'
                ? 'bg-ink text-page shadow-sm'
                : 'border border-line bg-card text-muted hover:text-ink'
            }`}
          >
            All Failures ({items.length})
          </button>
          <button
            type="button"
            onClick={() => setFilter('false_positive')}
            className={`rounded-pill px-3 py-1 font-medium transition-all ${
              filter === 'false_positive'
                ? 'bg-rose-600 text-white shadow-sm'
                : 'border border-line bg-card text-muted hover:text-ink'
            }`}
          >
            High-Confidence False Positives
          </button>
          <button
            type="button"
            onClick={() => setFilter('disagreement')}
            className={`rounded-pill px-3 py-1 font-medium transition-all ${
              filter === 'disagreement'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'border border-line bg-card text-muted hover:text-ink'
            }`}
          >
            High Model Disagreement
          </button>
          <button
            type="button"
            onClick={() => setFilter('boundary_uncertainty')}
            className={`rounded-pill px-3 py-1 font-medium transition-all ${
              filter === 'boundary_uncertainty'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'border border-line bg-card text-muted hover:text-ink'
            }`}
          >
            Boundary Uncertainty / Occlusion
          </button>
        </div>
      </div>

      {activeItem ? (
        <div className="rounded-l2 border border-line bg-card p-5 shadow-l1 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-ink">{activeItem.sample_name}</span>
                <span
                  className={`rounded-pill px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                    activeItem.failure_category === 'false_positive'
                      ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                      : activeItem.failure_category === 'disagreement'
                      ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                      : 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300'
                  }`}
                >
                  {activeItem.failure_category.replace(/_/g, ' ')}
                </span>
                <span className="text-xs text-muted">Difficulty: {activeItem.difficulty}</span>
              </div>
            </div>
            <div className="flex items-center gap-2.5">
              <span className="text-xs text-muted font-mono">Sample ID: {activeItem.id.slice(0, 8)}</span>
              <Button
                variant={pushedIds.has(activeItem.id) ? 'secondary' : 'primary'}
                size="sm"
                loading={pushing}
                disabled={pushedIds.has(activeItem.id)}
                onClick={handlePushToQueue}
                className="cursor-pointer text-xs flex items-center gap-1.5"
              >
                <Icon name={pushedIds.has(activeItem.id) ? 'check' : 'arrowRight'} size={12} />
                <span>{pushedIds.has(activeItem.id) ? 'Pushed to Biologist' : 'Push to Biologist Queue'}</span>
              </Button>
            </div>
          </div>

          {pushMsg && (
            <div className="rounded-control bg-emerald-500/10 border border-emerald-500/30 p-2 text-xs font-semibold text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
              <Icon name="check" size={14} />
              <span>{pushMsg}</span>
            </div>
          )}

          {/* Three-Column Visual Canvas */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {/* Ground Truth */}
            <div className="rounded-control border border-line bg-page p-3 space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                <span className="flex items-center gap-1.5">
                  <Icon name="check" size={13} /> Ground Truth
                </span>
                <span className="font-mono text-[11px] text-muted">Verified</span>
              </div>
              <div className="relative aspect-video overflow-hidden rounded-control bg-black">
                <img
                  src={activeItem.image_url}
                  alt="Ground Truth"
                  className="size-full object-cover"
                />
                <div className="absolute inset-x-2 bottom-2 rounded bg-black/75 px-2 py-1 text-[11px] text-white backdrop-blur-sm">
                  <span className="font-semibold text-emerald-400">Target: </span>
                  {activeItem.ground_truth?.label || 'Verified Specimen'}
                </div>
              </div>
              <div className="rounded bg-card p-2 text-xs font-mono border border-line text-muted">
                <div>Class: {activeItem.ground_truth?.label}</div>
                {activeItem.ground_truth?.bbox && (
                  <div>Box: [{activeItem.ground_truth.bbox.join(', ')}]</div>
                )}
              </div>
            </div>

            {/* Model A */}
            <div className="rounded-control border border-line bg-page p-3 space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold text-rose-600 dark:text-rose-400">
                <span className="flex items-center gap-1.5">
                  <Icon name="alert" size={13} /> Model A (YOLOv11m)
                </span>
                <span className="font-mono text-[11px] text-muted">
                  Conf: {((activeItem.model_a_prediction?.confidence ?? 0) * 100).toFixed(0)}%
                </span>
              </div>
              <div className="relative aspect-video overflow-hidden rounded-control bg-black ring-1 ring-rose-500/40">
                <img
                  src={activeItem.image_url}
                  alt="Model A Output"
                  className="size-full object-cover filter contrast-125"
                />
                <div className="absolute inset-x-2 bottom-2 rounded bg-black/75 px-2 py-1 text-[11px] text-white backdrop-blur-sm">
                  <span className="font-semibold text-rose-400">Predicted: </span>
                  {activeItem.model_a_prediction?.label || 'Predicted Label'}
                </div>
              </div>
              <div className="rounded bg-card p-2 text-xs font-mono border border-line text-muted">
                <div>Model: {activeItem.model_a_prediction?.model || 'YOLOv11m-Base'}</div>
                <div>Confidence: {((activeItem.model_a_prediction?.confidence ?? 0) * 100).toFixed(1)}%</div>
              </div>
            </div>

            {/* Model B */}
            <div className="rounded-control border border-line bg-page p-3 space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold text-blue-600 dark:text-blue-400">
                <span className="flex items-center gap-1.5">
                  <Icon name="sparkles" size={13} /> Model B (YOLOv11 + BioCLIP)
                </span>
                <span className="font-mono text-[11px] text-muted">
                  Conf: {((activeItem.model_b_prediction?.confidence ?? 0) * 100).toFixed(0)}%
                </span>
              </div>
              <div className="relative aspect-video overflow-hidden rounded-control bg-black ring-1 ring-blue-500/40">
                <img
                  src={activeItem.image_url}
                  alt="Model B Output"
                  className="size-full object-cover"
                />
                <div className="absolute inset-x-2 bottom-2 rounded bg-black/75 px-2 py-1 text-[11px] text-white backdrop-blur-sm">
                  <span className="font-semibold text-blue-400">Predicted: </span>
                  {activeItem.model_b_prediction?.label || 'BioCLIP Match'}
                </div>
              </div>
              <div className="rounded bg-card p-2 text-xs font-mono border border-line text-muted">
                <div>Model: {activeItem.model_b_prediction?.model || 'BioCLIP ViT/L'}</div>
                <div>Confidence: {((activeItem.model_b_prediction?.confidence ?? 0) * 100).toFixed(1)}%</div>
              </div>
            </div>
          </div>

          {/* Sample Thumbnails Selector */}
          <div className="pt-2 border-t border-line">
            <span className="text-xs font-semibold text-muted block mb-2">Failure Samples in Arena:</span>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {filteredItems.map((it) => (
                <button
                  key={it.id}
                  type="button"
                  onClick={() => setSelectedId(it.id)}
                  className={`flex items-center gap-2 rounded-control border px-2.5 py-1.5 text-xs transition-all shrink-0 ${
                    it.id === activeItem.id
                      ? 'border-crimson bg-crimson/10 font-semibold text-ink'
                      : 'border-line bg-card text-muted hover:border-line-strong hover:text-ink'
                  }`}
                >
                  <img src={it.image_url} alt="" className="size-6 rounded object-cover" />
                  <span>{it.sample_name}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-control border border-line bg-card p-8 text-center text-sm text-muted">
          No failure items match the selected filter.
        </div>
      )}
    </div>
  );
}
