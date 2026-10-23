import { useMemo, useState } from 'react';
import { Icon } from '@layerto/ui';

interface ThresholdCalibratorProps {
  initialConfidence?: number;
  initialNms?: number;
}

export function ThresholdCalibrator({
  initialConfidence = 0.5,
  initialNms = 0.45,
}: ThresholdCalibratorProps) {
  const [confidence, setConfidence] = useState<number>(initialConfidence);
  const [nms, setNms] = useState<number>(initialNms);

  // Dynamic simulation of metrics based on confidence & NMS trade-offs
  const metrics = useMemo(() => {
    // As confidence threshold increases:
    // - Precision generally increases (fewer false positives)
    // - Recall generally decreases (more false negatives)
    // Base population: 1,000 true targets, 250 background distractors
    const totalPositives = 1000;
    const totalDistractors = 250;

    // Recall formula: exponential dropoff above 0.4, high recall below 0.3
    const recallFactor = Math.max(0.1, 1 - Math.pow(confidence, 1.6) * 0.7 - (1 - nms) * 0.15);
    const truePositives = Math.round(totalPositives * recallFactor);
    const falseNegatives = totalPositives - truePositives;

    // False positives drop sharply as confidence rises
    const falsePositives = Math.round(totalDistractors * Math.pow(1 - confidence, 2.2) * (1 + (1 - nms) * 0.3));

    const precision = truePositives + falsePositives > 0
      ? (truePositives / (truePositives + falsePositives)) * 100
      : 100;

    const recall = (truePositives / totalPositives) * 100;
    const f1 = (2 * precision * recall) / (precision + recall || 1);

    return {
      precision: precision.toFixed(1),
      recall: recall.toFixed(1),
      f1: f1.toFixed(1),
      truePositives,
      falsePositives,
      falseNegatives,
      trueNegatives: totalDistractors * 10 - falsePositives,
    };
  }, [confidence, nms]);

  return (
    <div className="rounded-l2 border border-line bg-card p-5 shadow-l1 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex size-6 items-center justify-center rounded-control bg-crimson/10 text-crimson">
              <Icon name="gauge" size={14} />
            </span>
            <h3 className="text-sm font-bold text-ink">Live Confidence & NMS Threshold Slider</h3>
          </div>
          <p className="mt-0.5 text-xs text-muted">
            Calibrate detection confidence cutoff and Non-Maximum Suppression (NMS) IoU overlap in real-time.
          </p>
        </div>
        <div className="flex items-center gap-4 text-xs font-mono">
          <div>
            <span className="text-muted">Conf: </span>
            <span className="font-bold text-ink">{confidence.toFixed(2)}</span>
          </div>
          <div>
            <span className="text-muted">NMS IoU: </span>
            <span className="font-bold text-ink">{nms.toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* Sliders Grid */}
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs">
            <label htmlFor="conf-slider" className="font-semibold text-ink">
              Confidence Threshold (τ_conf)
            </label>
            <span className="font-mono font-bold text-crimson">{confidence.toFixed(2)}</span>
          </div>
          <input
            id="conf-slider"
            type="range"
            min="0.05"
            max="0.95"
            step="0.01"
            value={confidence}
            onChange={(e) => setConfidence(parseFloat(e.target.value))}
            className="w-full accent-crimson cursor-pointer"
          />
          <div className="flex justify-between text-[10px] text-muted font-mono">
            <span>0.05 (High Recall)</span>
            <span>0.50 (Balanced)</span>
            <span>0.95 (High Precision)</span>
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="flex justify-between text-xs">
            <label htmlFor="nms-slider" className="font-semibold text-ink">
              NMS IoU Overlap (τ_nms)
            </label>
            <span className="font-mono font-bold text-blue-600 dark:text-blue-400">
              {nms.toFixed(2)}
            </span>
          </div>
          <input
            id="nms-slider"
            type="range"
            min="0.10"
            max="0.90"
            step="0.01"
            value={nms}
            onChange={(e) => setNms(parseFloat(e.target.value))}
            className="w-full accent-blue-600 cursor-pointer"
          />
          <div className="flex justify-between text-[10px] text-muted font-mono">
            <span>0.10 (Aggressive suppression)</span>
            <span>0.45 (Standard)</span>
            <span>0.90 (Permissive boxes)</span>
          </div>
        </div>
      </div>

      {/* Live Metrics Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 pt-1">
        <div className="rounded-control border border-line bg-page p-3 text-center">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted">
            Precision
          </span>
          <div className="mt-1 font-mono text-xl font-bold text-emerald-600 dark:text-emerald-400">
            {metrics.precision}%
          </div>
          <span className="text-[10px] text-muted">TP / (TP + FP)</span>
        </div>

        <div className="rounded-control border border-line bg-page p-3 text-center">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted">
            Recall
          </span>
          <div className="mt-1 font-mono text-xl font-bold text-blue-600 dark:text-blue-400">
            {metrics.recall}%
          </div>
          <span className="text-[10px] text-muted">TP / (TP + FN)</span>
        </div>

        <div className="rounded-control border border-line bg-page p-3 text-center ring-1 ring-crimson/30">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted">
            F1 Score
          </span>
          <div className="mt-1 font-mono text-xl font-bold text-crimson">
            {metrics.f1}%
          </div>
          <span className="text-[10px] text-muted">Harmonic Mean</span>
        </div>

        <div className="rounded-control border border-line bg-page p-3 text-center">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted">
            False Positives
          </span>
          <div className="mt-1 font-mono text-xl font-bold text-amber-600 dark:text-amber-400">
            {metrics.falsePositives}
          </div>
          <span className="text-[10px] text-muted">Ghost detections</span>
        </div>
      </div>

      {/* Confusion Matrix Mini-Grid */}
      <div className="rounded-control border border-line/60 bg-page/50 p-3">
        <div className="text-[11px] font-semibold text-muted mb-2">Confusion Matrix Breakdown</div>
        <div className="grid grid-cols-2 gap-2 text-xs font-mono">
          <div className="rounded bg-emerald-500/10 p-2 border border-emerald-500/20">
            <span className="text-[10px] text-muted block">True Positives (TP)</span>
            <span className="font-bold text-emerald-700 dark:text-emerald-300">
              {metrics.truePositives}
            </span>
          </div>
          <div className="rounded bg-rose-500/10 p-2 border border-rose-500/20">
            <span className="text-[10px] text-muted block">False Positives (FP)</span>
            <span className="font-bold text-rose-700 dark:text-rose-300">
              {metrics.falsePositives}
            </span>
          </div>
          <div className="rounded bg-amber-500/10 p-2 border border-amber-500/20">
            <span className="text-[10px] text-muted block">False Negatives (FN)</span>
            <span className="font-bold text-amber-700 dark:text-amber-300">
              {metrics.falseNegatives}
            </span>
          </div>
          <div className="rounded bg-slate-500/10 p-2 border border-slate-500/20">
            <span className="text-[10px] text-muted block">True Negatives (TN)</span>
            <span className="font-bold text-slate-700 dark:text-slate-300">
              {metrics.trueNegatives}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
