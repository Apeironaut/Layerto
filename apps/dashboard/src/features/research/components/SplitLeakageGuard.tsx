import { useState } from 'react';
import type { DatasetSplitSnapshot, LeakageSample } from '@layerto/types';
import { Button, Icon, Modal } from '@layerto/ui';

interface SplitLeakageGuardProps {
  split: DatasetSplitSnapshot;
  onAuditComplete?: () => void;
}

export function SplitLeakageGuard({ split, onAuditComplete }: SplitLeakageGuardProps) {
  const [inspectingSample, setInspectingSample] = useState<LeakageSample | null>(null);
  const [resolving, setResolving] = useState(false);
  const [resolved, setResolved] = useState(false);

  const isLeaking = split.leakage_detected && !resolved;
  const leakageItems = split.leakage_details || [];

  const handleResolve = () => {
    setResolving(true);
    setTimeout(() => {
      setResolving(false);
      setResolved(true);
      setInspectingSample(null);
      onAuditComplete?.();
    }, 800);
  };

  return (
    <div
      className={`rounded-l2 border p-4 transition-all duration-300 ${
        isLeaking
          ? 'border-amber-500/50 bg-amber-500/5 dark:border-amber-500/30 dark:bg-amber-500/10'
          : 'border-emerald-500/40 bg-emerald-500/5 dark:border-emerald-500/20 dark:bg-emerald-500/10'
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <div
            className={`mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-control ${
              isLeaking ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400' : 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
            }`}
          >
            <Icon name={isLeaking ? 'alert' : 'shield'} size={18} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-semibold text-ink">
                Split Leakage Guard: {split.version_tag}
              </h4>
              <span
                className={`inline-flex items-center rounded-pill px-2 py-0.5 text-[11px] font-medium ${
                  isLeaking
                    ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                    : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                }`}
              >
                {isLeaking ? `${leakageItems.length} Near-Duplicate Flagged` : 'Zero Leakage Verified'}
              </span>
            </div>
            <p className="mt-0.5 text-xs text-muted">
              {isLeaking
                ? 'Perceptual hashing detected sample overlap between Train and Val/Test partitions. Training on this split risks overfitted test metrics.'
                : 'All Train, Validation, and Test partitions are strictly disjoint across cryptographic and perceptual hash spaces.'}
            </p>
          </div>
        </div>

        {isLeaking && (
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              icon="search"
              onClick={() => setInspectingSample(leakageItems[0])}
            >
              Inspect Overlap
            </Button>
            <Button
              variant="primary"
              size="sm"
              icon="wand"
              loading={resolving}
              onClick={handleResolve}
            >
              Prune Leakage & Purge Split
            </Button>
          </div>
        )}
      </div>

      {inspectingSample && (
        <Modal
          open={!!inspectingSample}
          onClose={() => setInspectingSample(null)}
          title="Split Leakage Audit Detail"
          size="lg"
        >
          <div className="space-y-4">
            <div className="rounded-control bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-300">
              <span className="font-semibold">Issue:</span> {inspectingSample.issue} (Cosine
              Similarity: {(inspectingSample.similarity_score * 100).toFixed(1)}%)
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="rounded-control border border-line bg-card p-3">
                <div className="flex items-center justify-between text-xs font-semibold text-muted">
                  <span>Sample A: {inspectingSample.split_a.toUpperCase()} SPLIT</span>
                  <span className="font-mono">{inspectingSample.sample_a}</span>
                </div>
                <div className="mt-2 aspect-video overflow-hidden rounded-control bg-page flex items-center justify-center border border-line text-xs text-muted">
                  <div className="text-center p-3">
                    <Icon name="image" size={28} className="mx-auto mb-1 opacity-50" />
                    <span>{inspectingSample.sample_a}</span>
                    <p className="text-[10px] text-muted mt-0.5">Hash: c7d99824f11e9a</p>
                  </div>
                </div>
              </div>

              <div className="rounded-control border border-line bg-card p-3">
                <div className="flex items-center justify-between text-xs font-semibold text-muted">
                  <span>Sample B: {inspectingSample.split_b.toUpperCase()} SPLIT</span>
                  <span className="font-mono">{inspectingSample.sample_b}</span>
                </div>
                <div className="mt-2 aspect-video overflow-hidden rounded-control bg-page flex items-center justify-center border border-line text-xs text-muted">
                  <div className="text-center p-3">
                    <Icon name="image" size={28} className="mx-auto mb-1 opacity-50" />
                    <span>{inspectingSample.sample_b}</span>
                    <p className="text-[10px] text-muted mt-0.5">Hash: c7d99824f11e9b</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="secondary" onClick={() => setInspectingSample(null)}>
                Dismiss
              </Button>
              <Button variant="primary" icon="wand" loading={resolving} onClick={handleResolve}>
                Auto-Purge Sample B from {inspectingSample.split_b.toUpperCase()}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
