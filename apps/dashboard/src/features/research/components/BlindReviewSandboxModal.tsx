import { useState } from 'react';
import { Button, Icon, Modal } from '@layerto/ui';
import type { ResearchArea } from '@layerto/types';
import type { LayertoClient } from '@layerto/api-client';

interface BlindReviewSandboxModalProps {
  open: boolean;
  onClose: () => void;
  area: ResearchArea;
  scopedClient: LayertoClient;
}

export function BlindReviewSandboxModal({
  open,
  onClose,
  area,
}: BlindReviewSandboxModalProps) {
  const [activeTab, setActiveTab] = useState<'manuscript' | 'metrics' | 'data' | 'evaluation'>('manuscript');
  const [copied, setCopied] = useState(false);
  const [recommendation, setRecommendation] = useState('accept_minor');
  const [reviewerComment, setReviewerComment] = useState('');
  const [submittedReview, setSubmittedReview] = useState(false);

  // Peer review link
  const reviewToken = `pr-rev-${area.id.slice(0, 8)}-${area.discipline}`;
  const reviewUrl = `https://layerto.io/review/sandbox?token=${reviewToken}`;

  const handleCopyLink = () => {
    navigator.clipboard?.writeText(reviewUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleSimulateSubmit = () => {
    setSubmittedReview(true);
    setTimeout(() => setSubmittedReview(false), 3500);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Anonymous Double-Blind Peer-Review Sandbox"
      size="xl"
    >
      <div className="space-y-5">
        {/* Blind Review Banner */}
        <div className="rounded-l2 border border-purple-500/40 bg-purple-500/10 p-4 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="flex size-7 items-center justify-center rounded-control bg-purple-500/20 text-purple-600 dark:text-purple-400">
                <Icon name="eye" size={16} />
              </span>
              <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-purple-800 dark:text-purple-200">
                Double-Blind Sandbox Mode Active
              </h4>
            </div>
            <span className="rounded bg-purple-500/20 px-2 py-0.5 text-[10px] font-mono font-bold text-purple-900 dark:text-purple-100">
              IDENTITIES REDACTED
            </span>
          </div>
          <p className="text-xs text-muted leading-relaxed">
            All author names, institutional affiliations, contributor emails, and private repository roots
            are stripped from this sandbox to prevent unconscious bias during academic peer review.
          </p>

          {/* Copyable Anonymous Link Bar */}
          <div className="pt-2 flex items-center gap-2">
            <div className="flex-1 flex items-center rounded-control border border-line bg-card px-3 py-1.5 text-xs font-mono text-muted">
              <Icon name="link" size={13} className="mr-2 text-muted shrink-0" />
              <span className="truncate">{reviewUrl}</span>
            </div>
            <Button
              variant={copied ? 'secondary' : 'primary'}
              size="sm"
              icon={copied ? 'check' : 'copy'}
              onClick={handleCopyLink}
              className="cursor-pointer shrink-0"
            >
              {copied ? 'Copied Link' : 'Copy Reviewer Link'}
            </Button>
          </div>
        </div>

        {/* Anonymized Metadata Header */}
        <div className="rounded-control border border-line bg-page p-4 text-xs space-y-2.5">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <div>
              <span className="text-muted block text-[11px]">Primary Author</span>
              <span className="font-mono font-bold text-ink">
                [REDACTED — Blind Reviewer ID #REV-2026-9041]
              </span>
            </div>
            <div>
              <span className="text-muted block text-[11px]">Affiliation</span>
              <span className="font-mono font-bold text-ink">
                [Protected Institution — Double-Blind Protocol]
              </span>
            </div>
            <div>
              <span className="text-muted block text-[11px]">Research Area Discipline</span>
              <span className="font-bold text-ink capitalize">{area.discipline}</span>
            </div>
            <div>
              <span className="text-muted block text-[11px]">Reproducibility Verification</span>
              <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                ✓ Cryptographic SHA-256 Dataset Seal
              </span>
            </div>
          </div>
        </div>

        {/* Sandbox Navigation Tabs */}
        <div className="flex border-b border-line gap-2 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setActiveTab('manuscript')}
            className={`cursor-pointer pb-2 px-3 border-b-2 transition-all ${
              activeTab === 'manuscript'
                ? 'border-crimson text-ink'
                : 'border-transparent text-muted hover:text-ink'
            }`}
          >
            Manuscript Draft & Abstract
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('metrics')}
            className={`cursor-pointer pb-2 px-3 border-b-2 transition-all ${
              activeTab === 'metrics'
                ? 'border-crimson text-ink'
                : 'border-transparent text-muted hover:text-ink'
            }`}
          >
            Reproducible Ablations & Metrics
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('data')}
            className={`cursor-pointer pb-2 px-3 border-b-2 transition-all ${
              activeTab === 'data'
                ? 'border-crimson text-ink'
                : 'border-transparent text-muted hover:text-ink'
            }`}
          >
            Audit-Safe Specimen Data
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('evaluation')}
            className={`cursor-pointer pb-2 px-3 border-b-2 transition-all ${
              activeTab === 'evaluation'
                ? 'border-crimson text-ink'
                : 'border-transparent text-muted hover:text-ink'
            }`}
          >
            Reviewer Evaluation Form
          </button>
        </div>

        {/* TAB 1: MANUSCRIPT & ABSTRACT */}
        {activeTab === 'manuscript' && (
          <div className="space-y-4 text-xs">
            <div className="rounded-l2 border border-line bg-card p-5 space-y-3">
              <h3 className="text-base font-bold text-ink">
                Autonomous Computer Vision and Morphometric Graphing for High-Precision Population Telemetry
              </h3>
              <div className="text-[11px] font-mono text-muted">
                Manuscript ID: MS-2026-ZOOLOGY-7714 • Blind Review Copy
              </div>

              <div className="pt-2 border-t border-line space-y-2">
                <h4 className="font-bold text-ink">Abstract</h4>
                <p className="text-ink-secondary leading-relaxed">
                  {area.hypothesis ||
                    'Accurate in-situ identification and morphometric characterization of marine organisms in coastal biospheres require high-precision computer vision resilient to turbidity, lighting shifts, and underwater occlusion. We demonstrate an air-gapped pipeline integrating hybrid transformer backbones with zero cross-split data leakage, validated against ground-truth taxonomy.'}
                </p>
              </div>

              <div className="pt-2 flex items-center justify-between">
                <span className="text-[11px] text-muted font-mono">
                  Word Count: 6,420 words • 7 Figures • 4 Tables
                </span>
                <Button variant="secondary" size="sm" icon="download" className="cursor-pointer">
                  Download Anonymized Manuscript PDF
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: REPRODUCIBLE ABLATIONS & METRICS */}
        {activeTab === 'metrics' && (
          <div className="space-y-3 text-xs">
            <div className="rounded-control bg-page p-3 border border-line flex items-center justify-between">
              <div>
                <span className="font-bold text-ink block">Deterministic Pipeline Check</span>
                <span className="text-muted text-[11px]">All random seeds (seed=42) and CUDA benchmark deterministic flags locked</span>
              </div>
              <span className="rounded bg-emerald-500/10 px-2.5 py-1 text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400">
                100% REPRODUCIBLE
              </span>
            </div>

            <div className="rounded-l2 border border-line bg-card overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-page text-muted uppercase font-mono text-[10px] border-b border-line">
                  <tr>
                    <th className="p-3">Architecture</th>
                    <th className="p-3">Parameters</th>
                    <th className="p-3">Top-1 Accuracy</th>
                    <th className="p-3">mAP@50</th>
                    <th className="p-3">Inference Latency</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line/60 font-mono">
                  <tr>
                    <td className="p-3 font-bold text-ink">ResNet-50 Baseline</td>
                    <td className="p-3 text-muted">25.6M</td>
                    <td className="p-3 text-muted">84.2%</td>
                    <td className="p-3 text-muted">0.812</td>
                    <td className="p-3 text-muted">14.2ms</td>
                  </tr>
                  <tr>
                    <td className="p-3 font-bold text-ink">YOLOv8-X (Medium)</td>
                    <td className="p-3 text-muted">68.2M</td>
                    <td className="p-3 text-muted">89.8%</td>
                    <td className="p-3 text-muted">0.874</td>
                    <td className="p-3 text-muted">19.8ms</td>
                  </tr>
                  <tr className="bg-teal-500/5">
                    <td className="p-3 font-bold text-teal-700 dark:text-teal-300">
                      Swin-Transformer (Ours)
                    </td>
                    <td className="p-3 text-ink">88.0M</td>
                    <td className="p-3 font-bold text-emerald-600">94.6%</td>
                    <td className="p-3 font-bold text-emerald-600">0.938</td>
                    <td className="p-3 text-ink">24.5ms</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 3: AUDIT-SAFE SPECIMEN DATA */}
        {activeTab === 'data' && (
          <div className="space-y-3 text-xs">
            <div className="rounded-control bg-emerald-500/10 border border-emerald-500/30 p-3 text-emerald-800 dark:text-emerald-200">
              <span className="font-bold flex items-center gap-1.5">
                <Icon name="shield" size={14} />
                Geo-Privacy Enforcement Active
              </span>
              <p className="text-[11px] text-muted mt-1 leading-relaxed">
                All specimen GPS coordinates are masked (±10km conservation blur) to protect wildlife habitats from poaching, conforming to IUCN Red List data publication standards.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { name: 'Specimen #CM-089', species: 'Chelonia mydas', gps: '6.0°N, 80.2°E (Fuzzed)' },
                { name: 'Specimen #CC-031', species: 'Caretta caretta', gps: '5.9°N, 80.4°E (Fuzzed)' },
                { name: 'Specimen #EI-104', species: 'Eretmochelys imbricata', gps: '6.1°N, 80.1°E (Fuzzed)' },
                { name: 'Specimen #LO-012', species: 'Lepidochelys olivacea', gps: '6.0°N, 80.3°E (Fuzzed)' },
              ].map((s) => (
                <div key={s.name} className="rounded-control border border-line bg-card p-3 space-y-1">
                  <div className="font-bold text-ink">{s.name}</div>
                  <div className="italic text-muted text-[11px]">{s.species}</div>
                  <div className="font-mono text-[10px] text-teal-600 dark:text-teal-400">{s.gps}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 4: REVIEWER EVALUATION FORM */}
        {activeTab === 'evaluation' && (
          <div className="space-y-4 text-xs">
            {submittedReview ? (
              <div className="rounded-control bg-emerald-500/10 border border-emerald-500/30 p-4 text-center space-y-2">
                <Icon name="check" size={24} className="mx-auto text-emerald-600" />
                <h5 className="font-bold text-ink">Evaluation Recorded in Peer-Review Sandbox</h5>
                <p className="text-muted text-[11px]">
                  Thank you for conducting this double-blind review. The editorial board will receive your anonymized decision.
                </p>
              </div>
            ) : (
              <div className="rounded-l2 border border-line bg-card p-4 space-y-3">
                <h4 className="font-bold text-ink">Reviewer Verification Checklist</h4>
                <div className="space-y-2 text-ink-secondary">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" defaultChecked className="rounded border-line text-crimson" />
                    <span>Methodology is clearly reproducible from open code and configuration specs</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" defaultChecked className="rounded border-line text-crimson" />
                    <span>Dataset splits exhibit zero cross-split data leakage or subject leakage</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" defaultChecked className="rounded border-line text-crimson" />
                    <span>Geo-privacy coordinates are properly fuzzed to protect endangered fauna</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" defaultChecked className="rounded border-line text-crimson" />
                    <span>Animal ethics approvals (IRB) and wildlife research permits are in order</span>
                  </label>
                </div>

                <div className="pt-2 border-t border-line space-y-2">
                  <label className="font-bold text-ink block">Reviewer Recommendation</label>
                  <select
                    value={recommendation}
                    onChange={(e) => setRecommendation(e.target.value)}
                    className="w-full rounded-control border border-line bg-page px-3 py-2 text-xs text-ink cursor-pointer"
                  >
                    <option value="accept_as_is">Accept (As Is) — Outstanding Contribution</option>
                    <option value="accept_minor">Accept (Minor Revisions Required)</option>
                    <option value="major_revisions">Major Revisions Required</option>
                    <option value="reject">Reject</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-ink block mb-1">Confidential Comments to Editor & Authors</label>
                  <textarea
                    rows={3}
                    placeholder="Enter peer-review feedback, ablation questions, or morphometric comments..."
                    value={reviewerComment}
                    onChange={(e) => setReviewerComment(e.target.value)}
                    className="w-full rounded-control border border-line bg-page p-2.5 text-xs text-ink"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="primary" size="sm" onClick={handleSimulateSubmit} className="cursor-pointer">
                    Submit Blind Review Decision
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="flex justify-end border-t border-line pt-3">
          <Button variant="secondary" onClick={onClose} className="cursor-pointer">
            Exit Sandbox Preview
          </Button>
        </div>
      </div>
    </Modal>
  );
}
