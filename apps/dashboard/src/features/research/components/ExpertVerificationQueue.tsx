import { useState } from 'react';
import { Button, Icon, Skeleton, useResource } from '@layerto/ui';
import type { LayertoClient } from '@layerto/api-client';
import type { ActiveLabelingItem } from '@layerto/types';

import { getDisciplineMeta } from '../templates';

interface ExpertVerificationQueueProps {
  areaId: string;
  scopedClient: LayertoClient;
  discipline?: string;
}

export function ExpertVerificationQueue({
  areaId,
  scopedClient,
  discipline,
}: ExpertVerificationQueueProps) {
  const meta = getDisciplineMeta(discipline);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [correcting, setCorrecting] = useState(false);
  const [selectedCorrection, setSelectedCorrection] = useState('');
  const [customLabel, setCustomLabel] = useState('');
  const [notes, setNotes] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [justResolvedMsg, setJustResolvedMsg] = useState<string | null>(null);

  // Fetch pending queue items from PostgreSQL
  const queueResource = useResource<ActiveLabelingItem[]>(
    () => scopedClient.researchList<ActiveLabelingItem>('active-labeling-queue', { area: areaId }),
    `active-labeling-queue-${areaId}`,
  );

  const allItems = queueResource.data || [];
  const pendingItems = allItems.filter(
    (item) => item.area_id === areaId && item.status === 'pending',
  );

  const currentItem = pendingItems[currentIndex] || pendingItems[0];

  const handleResolve = async (
    status: 'confirmed' | 'corrected' | 'ambiguous',
    resolvedLabel?: string,
  ) => {
    if (!currentItem) return;
    setActionLoading(true);
    try {
      await scopedClient.researchUpdate('active-labeling-queue', currentItem.id, {
        status,
        resolved_label: resolvedLabel || currentItem.predicted_label,
        reviewer_notes: notes.trim() || undefined,
      });

      setJustResolvedMsg(
        status === 'confirmed'
          ? `✓ Confirmed as ${resolvedLabel || currentItem.predicted_label}`
          : status === 'corrected'
          ? `✎ Corrected to ${resolvedLabel}`
          : `⚑ Flagged as Ambiguous / Field Re-sample`,
      );
      setTimeout(() => setJustResolvedMsg(null), 3000);

      setCorrecting(false);
      setSelectedCorrection('');
      setCustomLabel('');
      setNotes('');
      if (currentIndex >= pendingItems.length - 1) {
        setCurrentIndex(Math.max(0, pendingItems.length - 2));
      }
      queueResource.reload();
    } catch (err) {
      console.error('Failed to resolve queue item', err);
    } finally {
      setActionLoading(false);
    }
  };

  const confirmNoun = discipline?.includes('radiology') || discipline?.includes('clinical') || discipline?.includes('pathology')
    ? 'Diagnosis'
    : discipline?.includes('linguistics') || discipline?.includes('nlp')
    ? 'Character / Token'
    : 'Species';

  if (queueResource.loading) {
    return (
      <div className="rounded-l2 border border-line bg-card p-5 space-y-3">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-64 rounded-control" />
      </div>
    );
  }

  return (
    <div className="rounded-l2 border border-line bg-card p-5 shadow-l1 space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-3">
        <div className="flex items-center gap-2">
          <span className="flex size-7 items-center justify-center rounded-control bg-amber-500/10 text-amber-600 dark:text-amber-400">
            <Icon name="check" size={16} />
          </span>
          <div>
            <h4 className="text-sm font-bold text-ink">
              Expert Verification Flashcard Queue (Human-in-the-Loop)
            </h4>
            <p className="text-xs text-muted">
              Tech team AI models flag low-confidence predictions here for 1-click domain expert validation ({meta.labelNoun || 'labels'}).
            </p>
          </div>
        </div>

        {pendingItems.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="rounded-pill bg-amber-500/10 px-2.5 py-0.5 text-xs font-mono font-bold text-amber-700 dark:text-amber-300 border border-amber-500/30">
              {currentIndex + 1} of {pendingItems.length} Pending
            </span>
          </div>
        )}
      </div>

      {justResolvedMsg && (
        <div className="rounded-control bg-emerald-500/10 border border-emerald-500/30 p-2 text-xs font-semibold text-emerald-700 dark:text-emerald-300 flex items-center gap-2 animate-in fade-in duration-200">
          <Icon name="check" size={14} />
          <span>{justResolvedMsg}</span>
        </div>
      )}

      {pendingItems.length === 0 ? (
        <div className="rounded-control border border-dashed border-line bg-page/50 p-8 text-center space-y-2">
          <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <Icon name="check" size={24} />
          </div>
          <h5 className="text-sm font-bold text-ink">Queue Empty — All Predictions Verified</h5>
          <p className="text-xs text-muted max-w-md mx-auto">
            The computer vision models are operating with high certainty. When future batch inferences fall below the 60% confidence threshold, they will automatically appear here as flashcards.
          </p>
        </div>
      ) : currentItem ? (
        <div className="space-y-4">
          {/* Flashcard Body */}
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            {/* Visual Specimen Preview */}
            <div className="relative aspect-4/3 overflow-hidden rounded-control border border-line bg-black">
              <img
                src={currentItem.media_url}
                alt={currentItem.specimen_name}
                className="size-full object-cover"
              />
              <div className="absolute top-2 left-2 flex items-center gap-1.5">
                <span className="rounded bg-black/80 px-2 py-0.5 text-[10px] font-semibold text-white backdrop-blur-sm">
                  {currentItem.specimen_name}
                </span>
              </div>
              <div className="absolute bottom-2 right-2">
                <span className="rounded bg-amber-950/90 border border-amber-500/40 px-2 py-0.5 text-[10px] font-mono font-bold text-amber-300 backdrop-blur-sm">
                  Confidence: {(currentItem.confidence * 100).toFixed(0)}% (Low Confidence)
                </span>
              </div>
            </div>

            {/* Decision & Metadata Column */}
            <div className="flex flex-col justify-between space-y-3">
              <div className="space-y-3">
                <div className="rounded-control bg-page p-3 border border-line space-y-2">
                  <div className="text-[11px] font-semibold uppercase text-muted">Model Suggestion</div>
                  <div className="text-base font-bold text-ink flex items-center justify-between">
                    <span>{currentItem.predicted_label}</span>
                    <span className="text-xs font-mono text-amber-600 dark:text-amber-400">
                      {(currentItem.confidence * 100).toFixed(1)}% prob
                    </span>
                  </div>

                  {currentItem.alternative_label && (
                    <div className="pt-2 border-t border-line/60 text-xs text-muted">
                      <span className="font-semibold text-ink">Top Alternative:</span>{' '}
                      <span className="italic">{currentItem.alternative_label}</span>
                    </div>
                  )}
                </div>

                {correcting ? (
                  <div className="rounded-control border border-blue-500/30 bg-blue-500/5 p-3 space-y-2">
                    <label className="text-xs font-bold text-ink block">Select Correct Taxonomy Label</label>
                    <select
                      value={selectedCorrection}
                      onChange={(e) => setSelectedCorrection(e.target.value)}
                      className="w-full rounded-control border border-line bg-card px-2.5 py-1.5 text-xs text-ink cursor-pointer"
                    >
                      <option value="">-- Choose verified label --</option>
                      <option value="Chelonia mydas (Green Turtle)">Chelonia mydas (Green Turtle)</option>
                      <option value="Caretta caretta (Loggerhead Turtle)">Caretta caretta (Loggerhead Turtle)</option>
                      <option value="Eretmochelys imbricata (Hawksbill Turtle)">Eretmochelys imbricata (Hawksbill Turtle)</option>
                      <option value="Lepidochelys olivacea (Olive Ridley)">Lepidochelys olivacea (Olive Ridley)</option>
                      <option value="Dermochelys coriacea (Leatherback)">Dermochelys coriacea (Leatherback)</option>
                      <option value="other">Other / Custom Label</option>
                    </select>

                    {selectedCorrection === 'other' && (
                      <input
                        type="text"
                        placeholder="Enter verified label..."
                        value={customLabel}
                        onChange={(e) => setCustomLabel(e.target.value)}
                        className="w-full rounded-control border border-line bg-card px-2.5 py-1.5 text-xs text-ink"
                      />
                    )}

                    <div className="flex gap-2 justify-end pt-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setCorrecting(false)}
                      >
                        Cancel
                      </Button>
                      <Button
                        variant="primary"
                        size="sm"
                        disabled={!selectedCorrection || (selectedCorrection === 'other' && !customLabel.trim())}
                        loading={actionLoading}
                        onClick={() =>
                          handleResolve(
                            'corrected',
                            selectedCorrection === 'other' ? customLabel.trim() : selectedCorrection,
                          )
                        }
                        className="cursor-pointer"
                      >
                        Apply Correction
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <input
                      type="text"
                      placeholder="Optional observation notes / reviewer feedback..."
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      className="w-full rounded-control border border-line bg-page px-3 py-1.5 text-xs text-ink"
                    />
                  </div>
                )}
              </div>

              {/* 1-Click Action Buttons */}
              {!correcting && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2 border-t border-line/60">
                  <Button
                    variant="primary"
                    size="sm"
                    loading={actionLoading}
                    onClick={() => handleResolve('confirmed', currentItem.predicted_label)}
                    className="cursor-pointer bg-emerald-600 hover:bg-emerald-700 text-white font-semibold flex items-center justify-center gap-1.5"
                  >
                    <Icon name="check" size={14} />
                    <span>Confirm {confirmNoun}</span>
                  </Button>

                  <Button
                    variant="secondary"
                    size="sm"
                    loading={actionLoading}
                    onClick={() => {
                      setSelectedCorrection(currentItem.alternative_label || '');
                      setCorrecting(true);
                    }}
                    className="cursor-pointer font-semibold flex items-center justify-center gap-1.5"
                  >
                    <Icon name="pen" size={14} />
                    <span>Correct Label</span>
                  </Button>

                  <Button
                    variant="ghost"
                    size="sm"
                    loading={actionLoading}
                    onClick={() => handleResolve('ambiguous')}
                    className="cursor-pointer text-muted hover:text-ink flex items-center justify-center gap-1.5"
                  >
                    <Icon name="pin" size={14} />
                    <span>Flag Ambiguous</span>
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
