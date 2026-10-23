import { useState } from 'react';
import { Button, Icon, Modal, Skeleton, useResource } from '@layerto/ui';
import { useAreaVault } from '../ResearchAreaBoundary';
import { AblationMatrixTable } from '../components/AblationMatrixTable';
import { ThresholdCalibrator } from '../components/ThresholdCalibrator';
import { VisualErrorArena } from '../components/VisualErrorArena';
import type { AblationRun, ArenaItem, Finding } from '@layerto/types';

export function ExperimentsArenaTab() {
  const { area, scopedClient, viewMode } = useAreaVault();
  const [publishingInsight, setPublishingInsight] = useState(false);
  const [insightTitle, setInsightTitle] = useState('');
  const [insightType, setInsightType] = useState<'model_accuracy' | 'population_trend' | 'morphometric_distribution' | 'detection_summary'>('model_accuracy');
  const [insightContent, setInsightContent] = useState('');
  const [savingInsight, setSavingInsight] = useState(false);
  const [publishedNotice, setPublishedNotice] = useState(false);

  // Fetch ablation runs from PostgreSQL
  const ablationsResource = useResource<AblationRun[]>(
    () => scopedClient.ablationRuns({ area: area.id }),
    `ablations-${area.id}`,
  );

  // Fetch arena items from PostgreSQL
  const arenaResource = useResource<ArenaItem[]>(
    () => scopedClient.arenaItems({ area: area.id }),
    `arena-${area.id}`,
  );

  // Fetch findings for Domain View from PostgreSQL
  const findingsResource = useResource<Finding[]>(
    () => scopedClient.findings({ area: area.id }),
    `findings-${area.id}`,
  );

  const ablationRuns = ablationsResource.data || [];
  const arenaItems = arenaResource.data || [];
  const findings = findingsResource.data || [];

  const handlePublishInsight = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!insightTitle.trim() || !insightContent.trim()) return;

    setSavingInsight(true);
    try {
      await scopedClient.createDomainInsight({
        area_id: area.id,
        title: insightTitle.trim(),
        insight_type: insightType,
        content: insightContent.trim(),
        pinned: true,
        chart_data: {
          verified_by: 'AI Tech Team',
          benchmark_run: ablationRuns.find((r) => !r.is_baseline)?.run_name || 'YOLOv11+BioCLIP',
        },
      });
      setPublishingInsight(false);
      setInsightTitle('');
      setInsightContent('');
      setPublishedNotice(true);
      setTimeout(() => setPublishedNotice(false), 3000);
    } catch (err) {
      console.error('Failed to publish insight to domain view', err);
    } finally {
      setSavingInsight(false);
    }
  };

  const showDomain = viewMode === 'domain' || viewMode === 'unified';
  const showTech = viewMode === 'tech' || viewMode === 'unified';

  return (
    <div className="space-y-8">
      {/* SECTION 1: DOMAIN FINDINGS & FIELD REPORTS */}
      {showDomain && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="flex size-6 items-center justify-center rounded-control bg-purple-500/10 text-purple-600 dark:text-purple-400">
                  <Icon name="sparkles" size={14} />
                </span>
                <h3 className="text-base font-bold text-ink">
                  Visual Findings & Field Research Conclusions
                </h3>
              </div>
              <p className="mt-0.5 text-xs text-muted">
                Executive research summaries, verified species trends, and non-technical findings.
              </p>
            </div>
            {publishedNotice && (
              <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 animate-fade">
                Insight successfully published to Domain View!
              </span>
            )}
          </div>

          {findingsResource.loading ? (
            <Skeleton className="h-40 rounded-l2" />
          ) : findings.length === 0 ? (
            <div className="rounded-l2 border border-line bg-card p-6 text-center text-sm text-muted">
              No field findings published yet for this area.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {findings.map((f) => (
                <div key={f.id} className="rounded-l2 border border-line bg-card p-4 shadow-l1 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="text-sm font-bold text-ink">{f.title}</h4>
                    <span
                      className={`rounded-pill px-2 py-0.5 text-[10px] font-semibold uppercase ${
                        f.confidence === 'high'
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                          : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                      }`}
                    >
                      {f.confidence} confidence
                    </span>
                  </div>
                  <p className="text-xs text-ink-secondary leading-relaxed">{f.body}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* SECTION 2: TECH WORKBENCH (Ablation Matrix, Threshold Slider, Error Arena, Bridge) */}
      {showTech && (
        <div className="space-y-6 pt-2">
          {/* Bridge Action Header */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="flex size-6 items-center justify-center rounded-control bg-crimson/10 text-crimson">
                  <Icon name="flask" size={14} />
                </span>
                <h3 className="text-base font-bold text-ink">
                  Tech Workbench: Ablation Matrix & Calibrator
                </h3>
              </div>
              <p className="mt-0.5 text-xs text-muted">
                Pin baselines, compute relative performance deltas, tune detection thresholds, and audit visual failure cases.
              </p>
            </div>

            <Button
              variant="secondary"
              size="sm"
              icon="spark"
              onClick={() => setPublishingInsight(true)}
            >
              Publish Insight to Domain View
            </Button>
          </div>

          {/* Ablation Matrix Table */}
          <div className="space-y-2">
            <h4 className="text-sm font-bold text-ink">1. Ablation & Experiment Matrix</h4>
            {ablationsResource.loading ? (
              <Skeleton className="h-48 rounded-l2" />
            ) : (
              <AblationMatrixTable runs={ablationRuns} />
            )}
          </div>

          {/* Threshold Calibrator */}
          <div className="space-y-2 pt-2">
            <h4 className="text-sm font-bold text-ink">2. Interactive Threshold Calibrator</h4>
            <ThresholdCalibrator initialConfidence={0.5} initialNms={0.45} />
          </div>

          {/* Visual Error Arena */}
          <div className="space-y-2 pt-2">
            <h4 className="text-sm font-bold text-ink">3. Visual Error Arena & Side-by-Side Comparison</h4>
            {arenaResource.loading ? (
              <Skeleton className="h-64 rounded-l2" />
            ) : (
              <VisualErrorArena items={arenaItems} />
            )}
          </div>
        </div>
      )}

      {/* MODAL: Publish Insight to Domain View */}
      {publishingInsight && (
        <Modal
          open={publishingInsight}
          onClose={() => setPublishingInsight(false)}
          title="Publish Model Insight to Domain View"
          size="md"
        >
          <form onSubmit={handlePublishInsight} className="space-y-4 text-xs">
            <p className="text-muted leading-relaxed">
              Bridge technical results to the non-technical Lead Researcher's notebook in plain language, free of engineering jargon.
            </p>

            <div>
              <label className="font-semibold text-ink block mb-1">Insight Headline *</label>
              <input
                type="text"
                required
                value={insightTitle}
                onChange={(e) => setInsightTitle(e.target.value)}
                placeholder="e.g. YOLOv11+BioCLIP Achieves 94.2% Automated Re-ID Accuracy"
                className="w-full rounded-control border border-line bg-page px-3 py-2 text-xs text-ink"
              />
            </div>

            <div>
              <label className="font-semibold text-ink block mb-1">Insight Category</label>
              <select
                value={insightType}
                onChange={(e) => setInsightType(e.target.value as any)}
                className="w-full rounded-control border border-line bg-page px-3 py-2 text-xs text-ink"
              >
                <option value="model_accuracy">Model Accuracy & Re-ID Metric</option>
                <option value="population_trend">Population Distribution / Site Fidelity</option>
                <option value="morphometric_distribution">Morphometric Measurement</option>
                <option value="detection_summary">Field Detection Summary</option>
              </select>
            </div>

            <div>
              <label className="font-semibold text-ink block mb-1">Human-Readable Explanation *</label>
              <textarea
                rows={3}
                required
                value={insightContent}
                onChange={(e) => setInsightContent(e.target.value)}
                placeholder="Explain what the AI model discovered and what it means for field conservation..."
                className="w-full rounded-control border border-line bg-page p-2.5 text-xs text-ink"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-line">
              <Button variant="secondary" onClick={() => setPublishingInsight(false)}>
                Cancel
              </Button>
              <Button variant="primary" loading={savingInsight} icon="spark">
                Publish to Domain Feed
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
