import type { Prediction } from '@layerto/types';
import { cn } from '@layerto/ui';

export interface PredictionListProps {
  predictions: Prediction[];
  threshold: number;
  highlighted: number | null;
  onHighlight: (index: number | null) => void;
}

/** Predictions above the threshold; hovering one highlights its box (and vice versa). */
export function PredictionList({ predictions, threshold, highlighted, onHighlight }: PredictionListProps) {
  const hidden = predictions.filter((p) => p.confidence < threshold).length;
  return (
    <div className="space-y-2">
      <ul className="space-y-2">
        {predictions.map((p, i) =>
          p.confidence < threshold ? null : (
            <li
              key={i}
              tabIndex={0}
              onMouseEnter={() => onHighlight(i)}
              onMouseLeave={() => onHighlight(null)}
              onFocus={() => onHighlight(i)}
              onBlur={() => onHighlight(null)}
              className={cn(
                'p-3 rounded-control border transition-colors cursor-pointer outline-none',
                highlighted === i ? 'border-crimson bg-crimson-tint' : 'border-line bg-page hover:border-crimson-border',
              )}
            >
              <div className="flex items-center justify-between gap-3">
                <span className="font-semibold">{p.label}</span>
                <span className="font-mono text-sm tabular-nums">{Math.round(p.confidence * 100)}%</span>
              </div>
              <div className="mt-2 h-1.5 rounded-full bg-line overflow-hidden" aria-hidden="true">
                <div className="h-full bg-crimson rounded-full" style={{ width: `${p.confidence * 100}%` }} />
              </div>
              {p.bbox && <div className="mt-2 font-mono text-xs text-muted">box [{p.bbox.join(', ')}]</div>}
              {p.extra && Object.keys(p.extra).length > 0 && (
                <div className="mt-1 font-mono text-xs text-muted break-all">{JSON.stringify(p.extra)}</div>
              )}
            </li>
          ),
        )}
      </ul>
      {hidden > 0 && <p className="text-xs text-muted">{hidden} below the threshold hidden</p>}
    </div>
  );
}
