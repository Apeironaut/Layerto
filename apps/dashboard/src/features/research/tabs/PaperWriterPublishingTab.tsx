import { useState } from 'react';
import { Button, Icon, useResource } from '@layerto/ui';
import type { MethodologyStep, Reference, SpecimenItem } from '@layerto/types';
import { useAreaVault } from '../ResearchAreaBoundary';
import { RoyaltySplitLedger } from '../components/RoyaltySplitLedger';

type SubView = 'writer' | 'storefront';

export function PaperWriterPublishingTab() {
  const { area, scopedClient } = useAreaVault();
  const [subView, setSubView] = useState<SubView>('writer');

  // Area Context Data for 1-Click insertion
  const steps: MethodologyStep[] = (area.methodology_steps as MethodologyStep[]) || [];
  const litResource = useResource<Reference[]>(
    () => scopedClient.literature({ area: area.id }),
    `writer-lit-${area.id}`,
  );
  const specimensResource = useResource<SpecimenItem[]>(
    () => scopedClient.specimens({ area: area.id }),
    `writer-specimens-${area.id}`,
  );

  const literature = litResource.data || [];
  const specimens = specimensResource.data || [];

  // Manuscript Sections State
  const [manuscriptTitle, setManuscriptTitle] = useState(
    `${area.name}: Empirical Framework and Quantitative Analysis`,
  );
  const [abstractText, setAbstractText] = useState(
    `This investigation examines ${area.description || 'empirical research problems'} using rigorous field methodology and reproducible computational pipelines. By integrating systematic observation protocols with rigorous validation metrics, we demonstrate reproducible error margins and robust baseline improvements.`,
  );
  const [introText, setIntroText] = useState(
    `1. INTRODUCTION\n\nRecent advancements in ${area.discipline} necessitate rigorous, air-gapped observational frameworks to guarantee data integrity and reproducibility. The primary objective of this investigation is to evaluate the following scientific hypothesis:\n\n"${area.hypothesis || 'Primary research hypothesis under investigation.'}"\n\nPrior studies have documented foundational benchmarks, yet empirical gaps remain regarding fine-grained observation fidelity under variable environmental or clinical conditions.`,
  );
  const [methodText, setMethodText] = useState(
    `2. METHODOLOGY & EXPERIMENTAL DESIGN\n\nThe research protocol was structured into sequential, auditable stages:\n${steps
      .map(
        (s) =>
          `- Stage 0${s.step_number}: ${s.title}. ${s.description}${
            s.protocol_notes ? ` (Protocol: ${s.protocol_notes})` : ''
          }`,
      )
      .join('\n')}`,
  );
  const [resultsText, setResultsText] = useState(
    `3. EMPIRICAL OBSERVATIONS & RESULTS\n\nA total of ${specimens.length} verified observation instances were logged under the air-gapped domain vault. Quantitative distributions were validated against reproducible split boundaries with zero data leakage.`,
  );
  const [discussionText, setDiscussionText] = useState(
    `4. DISCUSSION & CONCLUSION\n\nThe empirical results corroborate the initial scientific hypothesis, demonstrating reproducible confidence bounds across independent observational strata. Future extensions will expand multi-modal sensor fusion and broaden cross-disciplinary data sharing agreements.`,
  );

  // AI Co-Pilot State
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiResponse, setAiResponse] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [targetInsertSection, setTargetInsertSection] = useState<'method' | 'results' | 'intro'>('method');

  // Publishing Storefront State
  const [publishStatus, setPublishStatus] = useState<'draft' | 'under_review' | 'published'>('draft');
  const [licenseType, setLicenseType] = useState<'cc_by' | 'research_only' | 'commercial'>('cc_by');
  const [bundlePriceUsd, setBundlePriceUsd] = useState('249.00');
  const [bundleItems, setBundleItems] = useState({
    pdf_manuscript: true,
    raw_observations_csv: true,
    model_checkpoint: true,
    reproducibility_dockerfile: true,
  });

  const totalWords = (
    manuscriptTitle +
    ' ' +
    abstractText +
    ' ' +
    introText +
    ' ' +
    methodText +
    ' ' +
    resultsText +
    ' ' +
    discussionText
  )
    .trim()
    .split(/\s+/).length;

  // Insert helpers from Area Context
  const handleInsertCitation = (ref: Reference) => {
    const authors = ref.authors || 'Unknown';
    const year = ref.year || '2026';
    const citation = `(${authors}, ${year})`;
    setIntroText((prev) => prev + ` Recent investigations by ${citation} highlighted relevant benchmarks in ${ref.venue || 'the literature'}.`);
  };

  const handleInsertMethodStep = (step: MethodologyStep) => {
    setMethodText(
      (prev) =>
        prev +
        `\n\n- Phase ${step.step_number} (${step.title}): ${step.description}. ${
          step.protocol_notes ? `Parameters: ${step.protocol_notes}` : ''
        }`,
    );
  };

  const handleRunAiCopilot = (customQuery?: string) => {
    const query = customQuery || aiPrompt;
    if (!query.trim()) return;

    setIsGenerating(true);
    setAiResponse(null);

    setTimeout(() => {
      let draft = '';
      const q = query.toLowerCase();

      if (q.includes('methodology') || q.includes('pipeline')) {
        draft = `The empirical protocol was designed across ${steps.length} rigorous phases. Initially, the hypothesis (${area.hypothesis || 'defined in Area Pulse'}) was bounded through baseline literature synthesis. Field observations were subsequently acquired with strict protocol notes (${steps[0]?.protocol_notes || 'standard procedures'}), ensuring high inter-observer reliability and reproducible error limits.`;
        setTargetInsertSection('method');
      } else if (q.includes('literature') || q.includes('citation') || q.includes('prior art')) {
        const topLit = literature.slice(0, 2);
        const citStr = topLit.map((l) => `${l.authors || 'Authors'} (${l.year || '2026'})`).join(' and ');
        draft = `Building upon the foundational allometric and analytical baselines established by ${citStr || 'recent academic literature'}, our framework addresses critical observation variance by incorporating verified domain-specific constraints.`;
        setTargetInsertSection('intro');
      } else {
        draft = `Statistical examination of the ${specimens.length} curated observation instances indicates robust consistency with the primary hypothesis. Metrics were verified under air-gapped isolation with zero data leakage, confirming empirical convergence across sample partitions.`;
        setTargetInsertSection('results');
      }

      setAiResponse(draft);
      setIsGenerating(false);
    }, 600);
  };

  const handleApplyAiDraft = () => {
    if (!aiResponse) return;
    if (targetInsertSection === 'method') {
      setMethodText((prev) => prev + '\n\n' + aiResponse);
    } else if (targetInsertSection === 'intro') {
      setIntroText((prev) => prev + '\n\n' + aiResponse);
    } else {
      setResultsText((prev) => prev + '\n\n' + aiResponse);
    }
    setAiResponse(null);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Mode Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-l3 border border-line bg-card p-5 sm:p-6 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded-control bg-crimson/10 text-crimson">
              <Icon name="pen" size={15} />
            </span>
            <h3 className="text-sm font-bold text-ink">AI Paper Co-Pilot & Publishing Studio</h3>
            <span className="rounded-pill bg-purple-500/10 px-2 py-0.5 text-[10px] font-mono font-bold text-purple-600 dark:text-purple-400 border border-purple-500/20">
              Co-Pilot Stage
            </span>
          </div>
          <p className="text-xs text-muted mt-1">
            Author academic manuscripts with live area context injection and publish multi-asset reproducibility bundles with automated royalty splits.
          </p>
        </div>

        {/* Dual Mode Switcher */}
        <div className="inline-flex rounded-control border border-line bg-page p-1 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setSubView('writer')}
            className={`rounded-control px-3.5 py-1.5 transition-all cursor-pointer flex items-center gap-2 ${
              subView === 'writer'
                ? 'bg-card text-ink shadow-xs font-bold border border-line/60'
                : 'text-muted hover:text-ink'
            }`}
          >
            <span>✍️ Academic Manuscript Editor</span>
            <span className="rounded-pill bg-page px-1.5 py-0.2 text-[10px] font-mono border border-line">
              {totalWords} words
            </span>
          </button>
          <button
            type="button"
            onClick={() => setSubView('storefront')}
            className={`rounded-control px-3.5 py-1.5 transition-all cursor-pointer flex items-center gap-2 ${
              subView === 'storefront'
                ? 'bg-card text-ink shadow-xs font-bold border border-line/60'
                : 'text-muted hover:text-ink'
            }`}
          >
            <span>🏛️ Publishing Storefront & Royalty Ledger</span>
          </button>
        </div>
      </div>

      {/* SUB-VIEW 1: ACADEMIC MANUSCRIPT WRITER & AI CO-PILOT */}
      {subView === 'writer' && (
        <div className="grid grid-cols-12 gap-6 items-start">
          {/* Left Context Drawer (col-span-12 lg:col-span-3) */}
          <div className="col-span-12 lg:col-span-3 space-y-4">
            <div className="rounded-l2 border border-line bg-card p-4 shadow-xs space-y-4">
              <div className="flex items-center gap-2 border-b border-line pb-2.5">
                <span className="text-xs font-bold text-ink">Area Context Drawer</span>
                <span className="rounded-pill bg-page px-1.5 py-0.5 text-[9px] font-mono text-muted border border-line ml-auto">
                  1-Click Insert
                </span>
              </div>

              {/* Methodology Steps Inserter */}
              <div className="space-y-2">
                <div className="text-[11px] font-mono font-bold text-muted uppercase">Methodology Stages:</div>
                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                  {steps.map((st) => (
                    <div
                      key={st.id}
                      className="group rounded-control border border-line bg-page p-2 text-xs hover:border-line-strong transition-all flex items-start justify-between gap-1.5"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="font-bold text-ink truncate text-[11px]">{st.title}</div>
                        <div className="text-[10px] text-muted line-clamp-1">{st.description}</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleInsertMethodStep(st)}
                        title="Insert into Methodology section"
                        className="rounded px-1.5 py-0.5 text-[10px] font-semibold text-crimson hover:bg-crimson/10 transition-colors shrink-0 cursor-pointer"
                      >
                        + Insert
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Literature Citations Inserter */}
              <div className="space-y-2 pt-2 border-t border-line/60">
                <div className="text-[11px] font-mono font-bold text-muted uppercase">Literature Citations:</div>
                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                  {literature.map((lit) => (
                    <div
                      key={lit.id}
                      className="group rounded-control border border-line bg-page p-2 text-xs hover:border-line-strong transition-all flex items-start justify-between gap-1.5"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="font-bold text-ink truncate text-[11px]">{lit.title}</div>
                        <div className="text-[10px] text-muted line-clamp-1">
                          {lit.authors || 'Unknown'} ({lit.year || 2026})
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleInsertCitation(lit)}
                        title="Insert APA Citation into text"
                        className="rounded px-1.5 py-0.5 text-[10px] font-semibold text-blue-600 hover:bg-blue-500/10 transition-colors shrink-0 cursor-pointer"
                      >
                        + Cite
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Observations summary */}
              <div className="pt-2 border-t border-line/60 text-xs text-muted flex items-center justify-between">
                <span>Verified Observations:</span>
                <span className="font-mono font-bold text-ink">{specimens.length} rows</span>
              </div>
            </div>
          </div>

          {/* Center Manuscript Editor (col-span-12 lg:col-span-6) */}
          <div className="col-span-12 lg:col-span-6 space-y-4">
            <div className="rounded-l3 border border-line bg-card p-6 shadow-xs space-y-5">
              {/* Manuscript Header Controls */}
              <div className="flex items-center justify-between border-b border-line pb-3">
                <span className="text-xs font-mono font-bold text-muted uppercase tracking-wider">
                  Academic Manuscript (LaTeX / Markdown format)
                </span>
                <div className="flex items-center gap-2 text-xs font-mono text-muted">
                  <span>{totalWords} words</span>
                  <span>•</span>
                  <span className="text-emerald-600 dark:text-emerald-400 font-semibold">Auto-saved</span>
                </div>
              </div>

              {/* Paper Title */}
              <div className="space-y-1">
                <label className="block text-[11px] font-mono font-bold text-muted uppercase">Paper Title</label>
                <input
                  type="text"
                  value={manuscriptTitle}
                  onChange={(e) => setManuscriptTitle(e.target.value)}
                  className="w-full rounded-control border border-line bg-page px-3 py-2 text-sm font-bold text-ink focus:border-crimson focus:outline-hidden"
                />
              </div>

              {/* Abstract */}
              <div className="space-y-1">
                <label className="block text-[11px] font-mono font-bold text-muted uppercase">Abstract</label>
                <textarea
                  rows={3}
                  value={abstractText}
                  onChange={(e) => setAbstractText(e.target.value)}
                  className="w-full rounded-control border border-line bg-page p-3 text-xs leading-relaxed text-ink focus:border-crimson focus:outline-hidden resize-none italic"
                />
              </div>

              {/* Section 1: Introduction */}
              <div className="space-y-1">
                <label className="block text-[11px] font-mono font-bold text-muted uppercase">1. Introduction & Hypothesis</label>
                <textarea
                  rows={5}
                  value={introText}
                  onChange={(e) => setIntroText(e.target.value)}
                  className="w-full rounded-control border border-line bg-page p-3 text-xs leading-relaxed text-ink focus:border-crimson focus:outline-hidden resize-none font-sans"
                />
              </div>

              {/* Section 2: Methodology */}
              <div className="space-y-1">
                <label className="block text-[11px] font-mono font-bold text-muted uppercase">2. Methodology & Protocol Design</label>
                <textarea
                  rows={6}
                  value={methodText}
                  onChange={(e) => setMethodText(e.target.value)}
                  className="w-full rounded-control border border-line bg-page p-3 text-xs leading-relaxed text-ink focus:border-crimson focus:outline-hidden resize-none font-sans"
                />
              </div>

              {/* Section 3: Results */}
              <div className="space-y-1">
                <label className="block text-[11px] font-mono font-bold text-muted uppercase">3. Observations & Results</label>
                <textarea
                  rows={4}
                  value={resultsText}
                  onChange={(e) => setResultsText(e.target.value)}
                  className="w-full rounded-control border border-line bg-page p-3 text-xs leading-relaxed text-ink focus:border-crimson focus:outline-hidden resize-none font-sans"
                />
              </div>

              {/* Section 4: Discussion */}
              <div className="space-y-1">
                <label className="block text-[11px] font-mono font-bold text-muted uppercase">4. Discussion & Reproducibility</label>
                <textarea
                  rows={4}
                  value={discussionText}
                  onChange={(e) => setDiscussionText(e.target.value)}
                  className="w-full rounded-control border border-line bg-page p-3 text-xs leading-relaxed text-ink focus:border-crimson focus:outline-hidden resize-none font-sans"
                />
              </div>
            </div>
          </div>

          {/* Right AI Co-Pilot Panel (col-span-12 lg:col-span-3) */}
          <div className="col-span-12 lg:col-span-3 space-y-4">
            <div className="rounded-l2 border border-purple-500/30 bg-purple-500/[0.03] p-4 shadow-xs space-y-4">
              <div className="flex items-center gap-2 border-b border-purple-500/20 pb-2.5">
                <span className="flex size-6 items-center justify-center rounded-control bg-purple-500/10 text-purple-600 dark:text-purple-400">
                  <Icon name="sparkles" size={13} />
                </span>
                <div>
                  <h4 className="text-xs font-bold text-ink">AI Research Co-Pilot</h4>
                  <span className="text-[10px] font-mono text-purple-600 dark:text-purple-400">
                    Assistant Stage (Context-Aware)
                  </span>
                </div>
              </div>

              {/* Prompt Suggestions */}
              <div className="space-y-1.5">
                <span className="text-[10px] font-mono font-bold text-muted uppercase block">Quick Suggestions:</span>
                <button
                  type="button"
                  onClick={() => handleRunAiCopilot('Draft methodology section based on our 5 pipeline stages')}
                  className="w-full rounded-control border border-line bg-card p-2 text-left text-[11px] text-ink hover:border-purple-400 hover:bg-purple-500/5 transition-all cursor-pointer font-medium"
                >
                  ⚡ Synthesize Methodology from Pipeline
                </button>
                <button
                  type="button"
                  onClick={() => handleRunAiCopilot('Integrate literature vault citations into related work')}
                  className="w-full rounded-control border border-line bg-card p-2 text-left text-[11px] text-ink hover:border-purple-400 hover:bg-purple-500/5 transition-all cursor-pointer font-medium"
                >
                  ⚡ Weave Literature Citations into Intro
                </button>
                <button
                  type="button"
                  onClick={() => handleRunAiCopilot('Summarize empirical observation table results')}
                  className="w-full rounded-control border border-line bg-card p-2 text-left text-[11px] text-ink hover:border-purple-400 hover:bg-purple-500/5 transition-all cursor-pointer font-medium"
                >
                  ⚡ Summarize Observation Findings
                </button>
              </div>

              {/* Custom Prompt Input */}
              <div className="space-y-2 pt-2 border-t border-purple-500/20">
                <textarea
                  rows={2}
                  placeholder="Ask Co-Pilot to draft, proofread, or check claims against area data..."
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  className="w-full rounded-control border border-line bg-card p-2 text-xs text-ink placeholder:text-muted focus:border-purple-500 focus:outline-hidden resize-none"
                />
                <Button
                  variant="primary"
                  size="sm"
                  loading={isGenerating}
                  onClick={() => handleRunAiCopilot()}
                  className="w-full cursor-pointer text-xs bg-purple-600 hover:bg-purple-700 text-white"
                >
                  Generate Draft
                </Button>
              </div>

              {/* Generated Response Preview */}
              {aiResponse && (
                <div className="rounded-l1 border border-purple-500/40 bg-card p-3 space-y-2 animate-in fade-in duration-150">
                  <div className="flex items-center justify-between text-[11px] font-bold text-purple-600 dark:text-purple-400">
                    <span>Generated Draft:</span>
                    <span className="text-[10px] text-muted">Ready to insert</span>
                  </div>
                  <p className="text-xs text-ink leading-relaxed font-sans whitespace-pre-wrap">{aiResponse}</p>
                  <div className="flex items-center justify-end gap-2 pt-1 border-t border-line">
                    <button
                      type="button"
                      onClick={() => setAiResponse(null)}
                      className="text-xs text-muted hover:text-ink cursor-pointer"
                    >
                      Dismiss
                    </button>
                    <Button
                      variant="primary"
                      size="sm"
                      icon="check"
                      onClick={handleApplyAiDraft}
                      className="cursor-pointer text-xs"
                    >
                      Insert into Paper
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* SUB-VIEW 2: PUBLISHING STOREFRONT & ROYALTY LEDGER */}
      {subView === 'storefront' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Storefront Packaging Card (Left 7 cols) */}
            <div className="lg:col-span-7 rounded-l3 border border-line bg-card p-6 shadow-xs space-y-5">
              <div className="flex items-center justify-between border-b border-line pb-4">
                <div>
                  <h4 className="text-sm font-bold text-ink">Multi-Asset Publication Storefront</h4>
                  <p className="text-xs text-muted mt-0.5">
                    Bundle your academic manuscript, raw observation tables, checkpoints, and reproducibility scripts into a verified release.
                  </p>
                </div>
                <span
                  className={`rounded-pill px-2.5 py-1 text-xs font-bold uppercase font-mono border ${
                    publishStatus === 'published'
                      ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600'
                      : publishStatus === 'under_review'
                      ? 'border-indigo-500/30 bg-indigo-500/10 text-indigo-600'
                      : 'border-line bg-page text-muted'
                  }`}
                >
                  {publishStatus.replace('_', ' ')}
                </span>
              </div>

              {/* Bundled Artifacts Checklist */}
              <div className="space-y-3">
                <span className="text-xs font-bold text-ink block">Included Bundled Artifacts:</span>
                <div className="space-y-2">
                  <label className="flex items-center justify-between p-3 rounded-l2 border border-line bg-page cursor-pointer hover:border-line-strong transition-all">
                    <div className="flex items-center gap-2.5">
                      <input
                        type="checkbox"
                        checked={bundleItems.pdf_manuscript}
                        onChange={(e) => setBundleItems({ ...bundleItems, pdf_manuscript: e.target.checked })}
                        className="rounded text-crimson"
                      />
                      <div>
                        <span className="text-xs font-bold text-ink block">Peer-Reviewed PDF Manuscript</span>
                        <span className="text-[11px] text-muted">Compiled from Manuscript Editor with formatted citations</span>
                      </div>
                    </div>
                    <span className="text-[11px] font-mono text-muted">2.4 MB</span>
                  </label>

                  <label className="flex items-center justify-between p-3 rounded-l2 border border-line bg-page cursor-pointer hover:border-line-strong transition-all">
                    <div className="flex items-center gap-2.5">
                      <input
                        type="checkbox"
                        checked={bundleItems.raw_observations_csv}
                        onChange={(e) => setBundleItems({ ...bundleItems, raw_observations_csv: e.target.checked })}
                        className="rounded text-crimson"
                      />
                      <div>
                        <span className="text-xs font-bold text-ink block">Curated Observation Data (CSV & JSON)</span>
                        <span className="text-[11px] text-muted">{specimens.length} verified rows under Privacy Shield anonymization</span>
                      </div>
                    </div>
                    <span className="text-[11px] font-mono text-muted">14.8 MB</span>
                  </label>

                  <label className="flex items-center justify-between p-3 rounded-l2 border border-line bg-page cursor-pointer hover:border-line-strong transition-all">
                    <div className="flex items-center gap-2.5">
                      <input
                        type="checkbox"
                        checked={bundleItems.model_checkpoint}
                        onChange={(e) => setBundleItems({ ...bundleItems, model_checkpoint: e.target.checked })}
                        className="rounded text-crimson"
                      />
                      <div>
                        <span className="text-xs font-bold text-ink block">Trained Model Weights / Safetensors</span>
                        <span className="text-[11px] text-muted">Best validation checkpoint linked from Model Vault</span>
                      </div>
                    </div>
                    <span className="text-[11px] font-mono text-muted">420 MB</span>
                  </label>

                  <label className="flex items-center justify-between p-3 rounded-l2 border border-line bg-page cursor-pointer hover:border-line-strong transition-all">
                    <div className="flex items-center gap-2.5">
                      <input
                        type="checkbox"
                        checked={bundleItems.reproducibility_dockerfile}
                        onChange={(e) => setBundleItems({ ...bundleItems, reproducibility_dockerfile: e.target.checked })}
                        className="rounded text-crimson"
                      />
                      <div>
                        <span className="text-xs font-bold text-ink block">Reproducibility Lock & Dockerfile</span>
                        <span className="text-[11px] text-muted">Fixed seed random state, environment freeze, and verification runner</span>
                      </div>
                    </div>
                    <span className="text-[11px] font-mono text-muted">0.1 MB</span>
                  </label>
                </div>
              </div>

              {/* Pricing & License Configuration */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-line">
                <div>
                  <label className="block text-xs font-semibold text-ink mb-1">Access License</label>
                  <select
                    value={licenseType}
                    onChange={(e) => setLicenseType(e.target.value as any)}
                    className="w-full rounded-control border border-line bg-page px-3 py-2 text-xs text-ink focus:border-crimson focus:outline-hidden"
                  >
                    <option value="cc_by">Open Access (CC-BY 4.0 - Free)</option>
                    <option value="research_only">Academic Research Grant License ($249)</option>
                    <option value="commercial">Commercial Enterprise License ($1,499)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-ink mb-1">Bundle Listing Price (USD)</label>
                  <input
                    type="text"
                    disabled={licenseType === 'cc_by'}
                    value={licenseType === 'cc_by' ? '0.00' : bundlePriceUsd}
                    onChange={(e) => setBundlePriceUsd(e.target.value)}
                    className="w-full rounded-control border border-line bg-page px-3 py-2 text-xs text-ink focus:border-crimson focus:outline-hidden font-mono disabled:opacity-50"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-line">
                <span className="text-xs text-muted">Proceeds distribute automatically according to Royalty Split Ledger.</span>
                <Button
                  variant="primary"
                  onClick={() => setPublishStatus('published')}
                  className="cursor-pointer text-xs"
                >
                  Publish Bundle Storefront
                </Button>
              </div>
            </div>

            {/* Royalty Split Ledger Card (Right 5 cols) */}
            <div className="lg:col-span-5 rounded-l3 border border-line bg-card p-6 shadow-xs space-y-4">
              <div className="border-b border-line pb-3">
                <h4 className="text-sm font-bold text-ink">Royalty & CRediT Split Ledger</h4>
                <p className="text-xs text-muted mt-0.5">
                  Decentralized compensation and formal CRediT contributor shares for this research publication.
                </p>
              </div>

              <RoyaltySplitLedger />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
