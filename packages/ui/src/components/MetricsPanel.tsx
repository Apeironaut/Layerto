import type { ModelMetrics } from '@layerto/types';
import { cn } from '../lib/cn';
import { LineChart } from './LineChart';

/** What each detection metric means, in one line, for people new to computer vision. */
export const METRIC_INFO: Record<string, { label: string; help: string; pct: boolean }> = {
  map50_95: { label: 'mAP 50–95', help: 'Main COCO score: accuracy averaged over box-overlap thresholds 0.50 to 0.95. Higher is better.', pct: true },
  map50: { label: 'mAP 50', help: 'Accuracy when a box only needs to overlap the truth by 50%. Good for “is it found at all”.', pct: true },
  map75: { label: 'mAP 75', help: 'Accuracy with strict 75% overlap: how tight the boxes are.', pct: true },
  map_small: { label: 'mAP small', help: 'Accuracy on small objects (under 32×32 px).', pct: true },
  map_medium: { label: 'mAP medium', help: 'Accuracy on medium objects (32–96 px).', pct: true },
  map_large: { label: 'mAP large', help: 'Accuracy on large objects (over 96 px).', pct: true },
  ar1: { label: 'Recall @1', help: 'Share of objects found when keeping 1 detection per image.', pct: true },
  ar10: { label: 'Recall @10', help: 'Share of objects found with 10 detections per image.', pct: true },
  ar100: { label: 'Recall @100', help: 'Share of all objects the model finds (up to 100 per image).', pct: true },
  precision: { label: 'Precision', help: 'Share of predicted boxes that are correct.', pct: true },
  recall: { label: 'Recall', help: 'Share of real objects that are found.', pct: true },
  f1: { label: 'F1', help: 'Balance of precision and recall.', pct: true },
  latency_ms: { label: 'Latency', help: 'Measured inference time per image during validation (ms).', pct: false },
  params_m: { label: 'Parameters', help: 'Model size in millions of parameters.', pct: false },
  model_mb: { label: 'Weights', help: 'Size of the weights file (MB).', pct: false },
  img: { label: 'Input size', help: 'Image size the model was trained at (px).', pct: false },
  epochs: { label: 'Epochs', help: 'Training passes over the data.', pct: false },
  best_epoch: { label: 'Best epoch', help: 'The epoch whose weights were kept.', pct: false },
  train_images: { label: 'Train images', help: 'Images used for training.', pct: false },
  val_images: { label: 'Val images', help: 'Held-out images the metrics were measured on.', pct: false },
};

const ORDER = ['map50_95', 'map50', 'map75', 'ar100', 'precision', 'recall', 'f1', 'map_small', 'map_medium', 'map_large', 'ar1', 'ar10',
  'latency_ms', 'params_m', 'model_mb', 'img', 'epochs', 'best_epoch', 'train_images', 'val_images'];

export function formatMetric(key: string, v: unknown): string {
  if (typeof v !== 'number' || Number.isNaN(v)) return '—';
  const info = METRIC_INFO[key];
  if (info?.pct) return `${(v * 100).toFixed(1)}%`;
  if (key === 'latency_ms') return `${v.toFixed(v < 10 ? 1 : 0)} ms`;
  if (key === 'params_m') return `${v.toFixed(1)}M`;
  if (key === 'model_mb') return `${v.toFixed(1)} MB`;
  if (key === 'img') return `${v} px`;
  return String(Math.round(v * 100) / 100);
}

/**
 * Everything measured about a detection model: headline metrics, scale/recall breakdown,
 * per-class AP bars and the learning curve. Only metrics that were actually measured are shown.
 */
export function MetricsPanel({
  metrics,
  history = [],
  source = 'trained',
  className,
  compact = false,
}: {
  metrics: ModelMetrics;
  history?: { epoch: number; map50_95?: number; map50?: number }[];
  source?: 'trained' | 'imported';
  className?: string;
  compact?: boolean;
}) {
  const keys = ORDER.filter((k) => typeof (metrics as Record<string, unknown>)[k] === 'number');
  const headline = keys.filter((k) => METRIC_INFO[k]?.pct).slice(0, compact ? 4 : 12);
  const other = keys.filter((k) => !METRIC_INFO[k]?.pct);
  const perClass = Object.entries(metrics.per_class_ap ?? {}).sort((a, b) => b[1] - a[1]);
  const curve = history.filter((p) => typeof p.map50_95 === 'number');
  const curve50 = history.filter((p) => typeof p.map50 === 'number');
  return (
    <div className={cn('space-y-5', className)}>
      <div className="flex flex-wrap items-center gap-2 text-xs">
        {metrics.self_reported || source === 'imported' ? (
          <span className="rounded-pill border border-amber-500/40 bg-amber-500/10 px-2.5 py-1 font-medium text-amber-800 dark:text-amber-300">
            Self-reported by the creator
          </span>
        ) : (
          <span className="rounded-pill border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-1 font-medium text-emerald-800 dark:text-emerald-300">
            Measured by Layerto on the held-out validation split
          </span>
        )}
        {metrics.size && <span className="rounded-pill border border-line px-2.5 py-1 text-muted">LTVision-{metrics.size.toUpperCase()}</span>}
      </div>
      {headline.length === 0 ? (
        <p className="text-sm text-muted">No accuracy metrics recorded.</p>
      ) : (
        <div className={cn('grid gap-2', compact ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4')}>
          {headline.map((k) => {
            const v = (metrics as Record<string, number>)[k];
            return (
              <div key={k} className="group relative rounded-control border border-line bg-page p-3" title={METRIC_INFO[k].help}>
                <div className="text-[11px] font-medium uppercase tracking-wider text-muted">{METRIC_INFO[k].label}</div>
                <div className="mt-1 text-lg font-bold text-ink font-mono">{formatMetric(k, v)}</div>
                <div className="mt-2 h-1 rounded-pill bg-line overflow-hidden">
                  <div className="h-full bg-crimson rounded-pill transition-[width] duration-700" style={{ width: `${Math.max(2, Math.min(100, v * 100))}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      )}
      {!compact && other.length > 0 && (
        <dl className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-2 text-sm">
          {other.map((k) => (
            <div key={k} title={METRIC_INFO[k].help}>
              <dt className="text-xs text-muted">{METRIC_INFO[k].label}</dt>
              <dd className="font-mono text-ink">{formatMetric(k, (metrics as Record<string, number>)[k])}</dd>
            </div>
          ))}
        </dl>
      )}
      {!compact && perClass.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted">AP per class</h4>
          <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
            {perClass.map(([name, v]) => (
              <div key={name} className="grid grid-cols-[minmax(0,9rem)_1fr_3.5rem] items-center gap-2 text-xs">
                <span className="truncate text-ink-secondary" title={name}>{name}</span>
                <div className="h-2 rounded-pill bg-line overflow-hidden">
                  <div className="h-full rounded-pill bg-crimson/80" style={{ width: `${Math.max(1, v * 100)}%` }} />
                </div>
                <span className="text-right font-mono text-ink">{(v * 100).toFixed(1)}%</span>
              </div>
            ))}
          </div>
        </div>
      )}
      {!compact && curve.length > 1 && (
        <div className="space-y-2">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted">Learning curve</h4>
          <LineChart
            series={[
              { name: 'mAP 50–95', points: curve.map((p) => ({ x: p.epoch, y: p.map50_95 as number })) },
              ...(curve50.length > 1 ? [{ name: 'mAP 50', points: curve50.map((p) => ({ x: p.epoch, y: p.map50 as number })) }] : []),
            ]}
            height={200}
          />
        </div>
      )}
    </div>
  );
}
