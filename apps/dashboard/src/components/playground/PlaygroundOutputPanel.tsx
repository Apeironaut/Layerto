import { useState } from 'react';
import type { VisionResponse } from '@layerto/types';
import { BoundingBoxCanvas, Card, Chip, EmptyState, Icon, cn, usd } from '@layerto/ui';
import type { ChainStepResult } from '../../hooks/usePlaygroundRun';
import { PredictionList } from './PredictionList';

export interface PlaygroundOutputPanelProps {
  previewUrl: string | null;
  fileName?: string;
  running: boolean;
  result: VisionResponse | null;
  chainResults: ChainStepResult[];
  activeStepIndex: number;
  onSelectStepIndex: (idx: number) => void;
  isChainMode: boolean;
  threshold: number;
  onThresholdChange: (val: number) => void;
  highlightedIndex: number | null;
  onHoverBox: (idx: number | null) => void;
}

export function PlaygroundOutputPanel({
  previewUrl,
  fileName,
  running,
  result,
  chainResults,
  activeStepIndex,
  onSelectStepIndex,
  isChainMode,
  threshold,
  onThresholdChange,
  highlightedIndex,
  onHoverBox,
}: PlaygroundOutputPanelProps) {
  const [viewTab, setViewTab] = useState<'visual' | 'json'>('visual');

  // If in chain mode, get active step response, otherwise root result
  const activeResult: VisionResponse | null =
    isChainMode && chainResults.length > 0
      ? chainResults[activeStepIndex]?.response ?? result
      : result;

  // Pipeline totals for chain mode
  const totalLatency = chainResults.reduce((acc, s) => acc + (s.response.latency_ms || 0), 0);
  const totalChargeUsd = chainResults.reduce((acc, s) => {
    const val = parseFloat(s.response.charge_usd || '0');
    return acc + (isNaN(val) ? 0 : val);
  }, 0);

  return (
    <Card
      className="h-full min-h-[580px] flex flex-col justify-between border-line/80 shadow-l2"
      title="Inference & Output"
      actions={
        activeResult ? (
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex rounded-control border border-line p-0.5 bg-page text-xs">
              <button
                type="button"
                onClick={() => setViewTab('visual')}
                className={cn(
                  'px-2.5 py-1 rounded transition-colors font-medium',
                  viewTab === 'visual' ? 'bg-crimson text-white font-semibold' : 'text-muted hover:text-ink',
                )}
              >
                Visual Output
              </button>
              <button
                type="button"
                onClick={() => setViewTab('json')}
                className={cn(
                  'px-2.5 py-1 rounded transition-colors font-mono',
                  viewTab === 'json' ? 'bg-crimson text-white font-semibold' : 'text-muted hover:text-ink',
                )}
              >
                JSON Payload
              </button>
            </div>

            <Chip variant="brand">{activeResult.model}</Chip>
            <Chip variant="neutral">{activeResult.latency_ms} ms</Chip>
            <Chip variant="active">{usd(activeResult.charge_usd)}</Chip>
          </div>
        ) : null
      }
    >
      <div className="flex-1 flex flex-col space-y-4">
        {/* Chain Mode: Multi-step Navigation Bar */}
        {isChainMode && chainResults.length > 0 && (
          <div className="p-2.5 rounded-control border border-line bg-page space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-ink uppercase tracking-wider flex items-center gap-1.5">
                <Icon name="branch" className="w-4 h-4 text-crimson" />
                <span>Workflow Pipeline Execution</span>
              </span>
              <span className="font-mono text-muted">
                Total: {totalLatency} ms &middot; {usd(totalChargeUsd.toFixed(6))}
              </span>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {chainResults.map((step, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => onSelectStepIndex(idx)}
                  className={cn(
                    'px-3 py-1.5 rounded-control text-xs font-mono transition-all flex items-center gap-1.5',
                    activeStepIndex === idx
                      ? 'bg-crimson text-white font-semibold shadow-sm'
                      : 'bg-surface-muted text-muted hover:text-ink hover:border-crimson-border',
                  )}
                >
                  <span className="w-4 h-4 rounded-full bg-white/20 flex items-center justify-center text-[10px] font-bold">
                    {idx + 1}
                  </span>
                  <span>{step.model}</span>
                  <span className="text-[10px] opacity-80">({step.response.predictions.length})</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* State 1: No image selected */}
        {!previewUrl && (
          <div className="flex-1 flex flex-col items-center justify-center min-h-[380px] border-2 border-dashed border-line rounded-control p-8 text-center bg-page/50">
            <div className="w-16 h-16 rounded-full bg-surface-muted flex items-center justify-center mb-4 text-muted">
              <Icon name="image" className="w-8 h-8 opacity-60" />
            </div>
            <h4 className="text-base font-semibold text-ink">Inference Canvas Standby</h4>
            <p className="mt-1.5 text-xs text-muted max-w-sm leading-relaxed">
              Upload an image or pick a sample on the left panel to test real-time object detection, species classification, and model metrics.
            </p>
          </div>
        )}

        {/* State 2: Image selected, ready or running or executed */}
        {previewUrl && (
          <div className="flex-1 flex flex-col space-y-4">
            {/* Running Overlay indicator */}
            {running && (
              <div className="p-3 rounded-control bg-crimson-tint/80 border border-crimson-border text-xs text-crimson font-medium flex items-center justify-between animate-pulse">
                <span className="flex items-center gap-2">
                  <Icon name="spark" className="w-4 h-4 animate-spin" />
                  <span>Executing neural vision inference...</span>
                </span>
                <span className="font-mono">Processing payload</span>
              </div>
            )}

            {/* Ready to run banner if not running and no result */}
            {!running && !activeResult && (
              <div className="p-3 rounded-control bg-page border border-line text-xs text-muted flex items-center justify-between">
                <span>Image loaded: <strong className="text-ink">{fileName ?? 'Uploaded image'}</strong></span>
                <span className="text-crimson font-medium flex items-center gap-1">
                  Ready to test &rarr; Click &ldquo;Run Model&rdquo;
                </span>
              </div>
            )}

            {/* Visual Canvas View */}
            {viewTab === 'visual' && (
              <div className="space-y-4">
                <div className="relative rounded-control overflow-hidden border border-line bg-page">
                  <BoundingBoxCanvas
                    key={activeResult?.request_id ?? previewUrl}
                    imageSrc={previewUrl}
                    imageAlt={fileName ?? 'Uploaded image'}
                    predictions={activeResult?.predictions ?? []}
                    highlightedIndex={highlightedIndex}
                    onHoverBox={onHoverBox}
                    confidenceThreshold={threshold}
                  />
                </div>

                {/* Controls & Predictions (only when result exists) */}
                {activeResult && (
                  <div className="space-y-4 pt-1">
                    <label className="block">
                      <span className="flex justify-between text-xs font-medium text-ink">
                        <span>Confidence Threshold</span>
                        <span className="font-mono tabular-nums font-semibold text-crimson">
                          {Math.round(threshold * 100)}%
                        </span>
                      </span>
                      <input
                        type="range"
                        min={0}
                        max={1}
                        step={0.05}
                        value={threshold}
                        onChange={(e) => onThresholdChange(Number(e.target.value))}
                        className="mt-1.5 w-full accent-crimson cursor-grab active:cursor-grabbing"
                      />
                    </label>

                    {activeResult.predictions.length > 0 ? (
                      <div className="space-y-2">
                        <span className="text-xs font-semibold uppercase tracking-wider text-muted">
                          Detected Objects & Taxonomy ({activeResult.predictions.filter((p) => p.confidence >= threshold).length} active)
                        </span>
                        <PredictionList
                          predictions={activeResult.predictions}
                          threshold={threshold}
                          highlighted={highlightedIndex}
                          onHighlight={onHoverBox}
                        />
                      </div>
                    ) : (
                      <EmptyState
                        icon="info"
                        title="No Predictions Found"
                        description="The selected model found no objects matching the confidence criteria."
                      />
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Raw JSON Payload View */}
            {viewTab === 'json' && activeResult && (
              <div className="space-y-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted font-mono">
                  Full API Response Payload
                </span>
                <pre className="p-3.5 rounded-control bg-page border border-line text-xs font-mono text-ink overflow-x-auto max-h-[480px]">
                  {JSON.stringify(activeResult, null, 2)}
                </pre>
              </div>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}
