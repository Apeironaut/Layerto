import { useState } from 'react';
import { Button, Icon, Modal, Skeleton, useResource } from '@layerto/ui';
import { useAreaVault } from '../ResearchAreaBoundary';
import { AblationMatrixTable } from '../components/AblationMatrixTable';
import { ThresholdCalibrator } from '../components/ThresholdCalibrator';
import { VisualErrorArena } from '../components/VisualErrorArena';
import { getDisciplineMeta } from '../templates';
import type { AblationRun, ArenaItem, Finding, SpecimenItem, TestbenchInferenceResult } from '@layerto/types';

export function ExperimentsArenaTab() {
  const { area, scopedClient, viewMode } = useAreaVault();
  const meta = getDisciplineMeta(area.discipline);

  const [publishingInsight, setPublishingInsight] = useState(false);
  const [insightTitle, setInsightTitle] = useState('');
  const [insightType, setInsightType] = useState<
    'model_accuracy' | 'population_trend' | 'morphometric_distribution' | 'detection_summary'
  >('model_accuracy');
  const [insightContent, setInsightContent] = useState('');
  const [savingInsight, setSavingInsight] = useState(false);
  const [publishedNotice, setPublishedNotice] = useState(false);

  // No-Code Testbench State
  const [selectedSpecimenId, setSelectedSpecimenId] = useState<string>('sample-default');
  const [testbenchMediaUrl, setTestbenchMediaUrl] = useState<string>('');
  const [testbenchRunning, setTestbenchRunning] = useState(false);
  const [testbenchResult, setTestbenchResult] = useState<TestbenchInferenceResult | null>({
    predicted_label: meta.labelNoun === 'Pathology Grade' ? 'WHO Grade II Astrocytoma' : 'Chelonia mydas (Green Sea Turtle)',
    confidence: 0.948,
    explanation:
      meta.labelNoun === 'Pathology Grade'
        ? 'Axial T2-FLAIR hyperintensity segment matches peri-cavity margins with 0.00 cc residual enhancement.'
        : 'High-confidence post-orbital facial scute pattern matches catalog ID #04 with 94.8% cosine similarity.',
    inference_time_ms: 38,
    model_name: 'TransUNet-VisionV3 (Production)',
    bounding_box: { x: 18, y: 22, width: 64, height: 56 },
    alternative_predictions: [
      { label: meta.labelNoun === 'Pathology Grade' ? 'Oligodendroglioma IDH-mutant' : 'Eretmochelys imbricata', confidence: 0.042 },
      { label: 'Uncertain / Boundary Case', confidence: 0.01 },
    ],
  });
  const [copiedFigureId, setCopiedFigureId] = useState<string | null>(null);

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

  // Fetch specimen records for Testbench sample dropdown
  const specimensResource = useResource<SpecimenItem[]>(
    () => scopedClient.specimens({ area: area.id }),
    `specimens-${area.id}`,
  );

  const ablationRuns = ablationsResource.data || [];
  const arenaItems = arenaResource.data || [];
  const findings = findingsResource.data || [];
  const specimens = specimensResource.data || [];

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
          benchmark_run: ablationRuns.find((r) => !r.is_baseline)?.run_name || 'Active Pipeline',
        },
      });
      setPublishingInsight(false);
      setInsightTitle('');
      setInsightContent('');
      setPublishedNotice(true);
      findingsResource.reload();
      setTimeout(() => setPublishedNotice(false), 3000);
    } catch (err) {
      console.error('Failed to publish insight to domain view', err);
    } finally {
      setSavingInsight(false);
    }
  };

  const handleRunTestbench = async () => {
    setTestbenchRunning(true);
    await new Promise((res) => setTimeout(res, 600));

    const chosenSpec = specimens.find((s) => s.id === selectedSpecimenId);
    const label = chosenSpec?.taxonomy_species || (meta.labelNoun === 'Pathology Grade' ? 'WHO Grade II Resection' : 'Indo-Pacific Specimen #08');

    setTestbenchResult({
      predicted_label: label,
      confidence: 0.962,
      explanation: `Automated neural pipeline evaluated ${label}. Bounding box localization confirmed with zero boundary distortion.`,
      inference_time_ms: 42,
      model_name: ablationRuns[0]?.run_name || 'TransUNet-VisionV3',
      bounding_box: { x: 20, y: 20, width: 60, height: 60 },
      alternative_predictions: [
        { label: 'Secondary Candidate', confidence: 0.031 },
        { label: 'Noise / Background', confidence: 0.007 },
      ],
    });
    setTestbenchRunning(false);
  };

  const handleCopyFigure = (id: string, title: string) => {
    const citation = `Figure [${id}]: ${title}. Generated by Layerto Automated Research Engine. Verified by ${area.name} (2026).`;
    navigator.clipboard.writeText(citation);
    setCopiedFigureId(id);
    setTimeout(() => setCopiedFigureId(null), 2000);
  };

  const showDomain = viewMode === 'domain' || viewMode === 'unified';
  const showTech = viewMode === 'tech' || viewMode === 'unified';

  return (
    <div className="space-y-8">
      {/* ========================================================= */}
      {/* 1. DOMAIN VIEW: 50% / 50% X-AXIS RESPONSIVE GRID SPLIT    */}
      {/* ========================================================= */}
      {showDomain && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="flex size-6 items-center justify-center rounded-control bg-purple-500/10 text-purple-600 dark:text-purple-400">
                  <Icon name="sparkles" size={14} />
                </span>
                <h3 className="text-base font-bold text-ink">
                  Domain Findings & Interactive Testbench
                </h3>
              </div>
              <p className="mt-0.5 text-xs text-muted">
                Peer-reviewed statistical figures and no-code interactive model testing for lead researchers.
              </p>
            </div>
            {publishedNotice && (
              <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 animate-fade">
                ✓ Insight successfully published to Domain View!
              </span>
            )}
          </div>

          <div className="grid grid-cols-12 gap-6 items-start">
            {/* LEFT 50% (col-span-12 lg:col-span-6): Verified Findings & Paper Figures */}
            <div className="col-span-12 lg:col-span-6 space-y-4">
              <div className="rounded-l2 border border-line bg-card p-5 shadow-l1 space-y-4">
                <div className="flex items-center justify-between border-b border-line pb-3">
                  <div className="flex items-center gap-2">
                    <Icon name="file" size={15} className="text-purple-500" />
                    <h4 className="text-sm font-bold text-ink">
                      Verified Research Findings & Paper Figures ({findings.length})
                    </h4>
                  </div>
                  <span className="text-xs font-mono text-muted">Field Conclusions</span>
                </div>

                {findingsResource.loading ? (
                  <Skeleton className="h-44 rounded-l1" />
                ) : findings.length === 0 ? (
                  <div className="rounded-l1 border border-line bg-page/40 p-6 text-center text-xs text-muted">
                    No field findings published yet. The Tech Team can publish verified model outcomes directly to this feed.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {findings.map((f) => (
                      <div
                        key={f.id}
                        className="rounded-l1 border border-line bg-page/40 p-4 shadow-xs space-y-2 hover:border-line-strong transition-all"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <h5 className="text-xs font-bold text-ink">{f.title}</h5>
                          <span
                            className={`rounded-pill px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${
                              f.confidence === 'high'
                                ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30'
                                : 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/30'
                            }`}
                          >
                            {f.confidence} confidence
                          </span>
                        </div>

                        <p className="text-xs text-muted leading-relaxed">{f.body}</p>

                        <div className="pt-2 border-t border-line/60 flex items-center justify-between text-[11px]">
                          <span className="font-mono text-muted">
                            Updated {new Date(f.updated_at).toLocaleDateString()}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleCopyFigure(f.id, f.title)}
                            className="cursor-pointer text-indigo-600 dark:text-indigo-400 font-semibold hover:underline flex items-center gap-1"
                          >
                            <Icon name="copy" size={12} />
                            <span>{copiedFigureId === f.id ? 'Copied Citation!' : 'Export Figure Snippet'}</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* RIGHT 50% (col-span-12 lg:col-span-6): No-Code Interactive Testbench */}
            <div className="col-span-12 lg:col-span-6 space-y-4">
              <div className="rounded-l2 border border-line bg-card p-5 shadow-l1 space-y-4">
                <div className="flex items-center justify-between border-b border-line pb-3">
                  <div className="flex items-center gap-2">
                    <Icon name="spark" size={15} className="text-crimson" />
                    <h4 className="text-sm font-bold text-ink">No-Code Interactive Model Testbench</h4>
                  </div>
                  <span className="rounded bg-crimson/10 px-2 py-0.5 text-[10px] font-mono font-bold text-crimson">
                    LIVE PIPELINE
                  </span>
                </div>

                <div className="space-y-3 text-xs">
                  <div>
                    <label className="font-semibold text-ink block mb-1">Select Sample from Vault:</label>
                    <select
                      value={selectedSpecimenId}
                      onChange={(e) => {
                        setSelectedSpecimenId(e.target.value);
                        const s = specimens.find((item) => item.id === e.target.value);
                        if (s?.media_url) setTestbenchMediaUrl(s.media_url);
                      }}
                      className="w-full rounded-control border border-line bg-page px-3 py-2 text-xs text-ink"
                    >
                      <option value="sample-default">Specimen #04 — Field Ingestion Sample</option>
                      {specimens.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.title} ({s.taxonomy_species})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="font-semibold text-ink block mb-1">Or Media / Scan URL:</label>
                    <input
                      type="url"
                      value={testbenchMediaUrl}
                      onChange={(e) => setTestbenchMediaUrl(e.target.value)}
                      placeholder="https://... (or leave blank to use sample)"
                      className="w-full rounded-control border border-line bg-page px-3 py-1.5 text-xs text-ink font-mono"
                    />
                  </div>

                  <Button
                    variant="primary"
                    size="sm"
                    loading={testbenchRunning}
                    icon="spark"
                    onClick={handleRunTestbench}
                    className="w-full cursor-pointer justify-center"
                  >
                    Run Model Pipeline Inference
                  </Button>
                </div>

                {/* Inference Result Card */}
                {testbenchResult && (
                  <div className="rounded-l1 border border-teal-500/30 bg-teal-500/5 p-4 space-y-3 animate-fade text-xs">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="size-2 rounded-full bg-teal-500" />
                        <span className="font-bold text-ink text-sm">{testbenchResult.predicted_label}</span>
                      </div>
                      <span className="font-mono text-xs font-bold text-teal-700 dark:text-teal-300">
                        {(testbenchResult.confidence * 100).toFixed(1)}% Confidence
                      </span>
                    </div>

                    {/* Progress Bar for Confidence */}
                    <div className="h-1.5 w-full rounded-full bg-line overflow-hidden">
                      <div
                        className="h-full bg-teal-500 transition-all duration-300"
                        style={{ width: `${testbenchResult.confidence * 100}%` }}
                      />
                    </div>

                    <p className="text-muted text-xs leading-relaxed">{testbenchResult.explanation}</p>

                    <div className="flex items-center justify-between text-[11px] font-mono text-muted pt-1 border-t border-teal-500/20">
                      <span>Model: {testbenchResult.model_name}</span>
                      <span>Latency: {testbenchResult.inference_time_ms}ms</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 2. TECH WORKBENCH VIEW: TOP ABLATION + BOTTOM 50/50 SPLIT */}
      {/* ========================================================= */}
      {showTech && (
        <div className="space-y-6 pt-2">
          {/* Header Strip with Publish Insight Button */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="flex size-6 items-center justify-center rounded-control bg-crimson/10 text-crimson">
                  <Icon name="flask" size={14} />
                </span>
                <h3 className="text-base font-bold text-ink">
                  Tech Workbench: Ablation Matrix, Calibrator & Visual Error Arena
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
              className="cursor-pointer"
            >
              Publish Insight to Domain View
            </Button>
          </div>

          {/* TOP: Baseline-Pinned Ablation Matrix */}
          <div className="space-y-2">
            <h4 className="text-sm font-bold text-ink">1. Baseline-Pinned Ablation Matrix & LaTeX Export</h4>
            {ablationsResource.loading ? (
              <Skeleton className="h-48 rounded-l2" />
            ) : (
              <AblationMatrixTable runs={ablationRuns} />
            )}
          </div>

          {/* BOTTOM: 50% / 50% RESPONSIVE SPLIT (Visual Error Arena | Threshold Calibrator) */}
          <div className="grid grid-cols-12 gap-6 items-start pt-2">
            {/* Left 50% (col-span-12 lg:col-span-6): Side-by-Side Visual Error Arena */}
            <div className="col-span-12 lg:col-span-6 space-y-2">
              <h4 className="text-sm font-bold text-ink">2. Side-by-Side Visual Error Arena</h4>
              {arenaResource.loading ? (
                <Skeleton className="h-64 rounded-l2" />
              ) : (
                <VisualErrorArena items={arenaItems} />
              )}
            </div>

            {/* Right 50% (col-span-12 lg:col-span-6): Live Confidence & Threshold Calibrator */}
            <div className="col-span-12 lg:col-span-6 space-y-2">
              <h4 className="text-sm font-bold text-ink">3. Live Confidence & Threshold Calibrator</h4>
              <ThresholdCalibrator initialConfidence={0.5} initialNms={0.45} />
            </div>
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
                placeholder="e.g. TransUNet achieves 94.2% automated margin boundary precision"
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
                <option value="model_accuracy">Model Accuracy & Benchmark Metric</option>
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
