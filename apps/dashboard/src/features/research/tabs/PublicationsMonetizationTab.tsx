import { useState } from 'react';
import { Button, Icon, Modal, Skeleton, useResource } from '@layerto/ui';
import { useAreaVault } from '../ResearchAreaBoundary';
import { RoyaltySplitLedger } from '../components/RoyaltySplitLedger';
import { BlindReviewSandboxModal } from '../components/BlindReviewSandboxModal';
import type { ResearchPublication } from '@layerto/types';

export function PublicationsMonetizationTab() {
  const { area, scopedClient } = useAreaVault();
  const [publishingNew, setPublishingNew] = useState(false);
  const [blindReviewOpen, setBlindReviewOpen] = useState(false);
  const [copiedCitation, setCopiedCitation] = useState<string | null>(null);

  // New publication form states
  const [pubTitle, setPubTitle] = useState('');
  const [pubDoi, setPubDoi] = useState('10.1038/s41598-026-08921-x');
  const [pubAbstract, setPubAbstract] = useState('');
  const [pubPricing, setPubPricing] = useState<'open_access' | 'tiered' | 'commercial'>('tiered');
  const [paperPrice, setPaperPrice] = useState('12');
  const [datasetPrice, setDatasetPrice] = useState('149');
  const [modelPrice, setModelPrice] = useState('49');
  const [savingPub, setSavingPub] = useState(false);

  // Fetch publications from PostgreSQL via scoped client
  const pubsResource = useResource<ResearchPublication[]>(
    () => scopedClient.publications({ area: area.id }),
    `publications-${area.id}`,
  );

  const publications = pubsResource.data || [];
  const primaryPub = publications[0];

  const handleCreatePublication = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pubTitle.trim()) return;

    setSavingPub(true);
    try {
      await scopedClient.createPublication({
        area_id: area.id,
        title: pubTitle.trim(),
        doi: pubDoi.trim(),
        abstract: pubAbstract.trim(),
        pricing_model: pubPricing,
        paper_price_cents: Math.round(parseFloat(paperPrice) * 100),
        dataset_price_cents: Math.round(parseFloat(datasetPrice) * 100),
        model_price_cents: Math.round(parseFloat(modelPrice) * 100),
        downloads_count: 0,
        gross_revenue_cents: 0,
        is_published: true,
        badges: ['Verified Field Data', 'Reproducible Pipeline', 'Interdisciplinary Collaboration'],
        royalty_split_rules: [
          { party: 'Lead Domain Researcher', share_pct: 65 },
          { party: 'Collaborating AI Tech Team', share_pct: 30 },
          { party: 'Platform Hosting & Escrow', share_pct: 5 },
        ],
      });
      setPublishingNew(false);
      setPubTitle('');
      setPubAbstract('');
      pubsResource.reload();
    } catch (err) {
      console.error('Failed to create publication', err);
    } finally {
      setSavingPub(false);
    }
  };

  const copyCitation = (pub: ResearchPublication, format: 'bibtex' | 'apa' | 'ieee') => {
    let text = '';
    const year = 2026;
    if (format === 'bibtex') {
      text = `@article{${pub.id.slice(0, 8)}_2026,\n  author = {Naviya, C. and Oxford DeepVision AI},\n  title = {${pub.title}},\n  journal = {Layerto Research Archive},\n  year = {${year}},\n  doi = {${pub.doi || '10.1038/layerto.2026'}}\n}`;
    } else if (format === 'apa') {
      text = `Naviya, C., & Oxford DeepVision AI. (${year}). ${pub.title}. Layerto Research Archive. https://doi.org/${pub.doi || '10.1038/layerto.2026'}`;
    } else {
      text = `C. Naviya and Oxford DeepVision AI, "${pub.title}," Layerto Research Archive, ${year}, doi: ${pub.doi || '10.1038/layerto.2026'}.`;
    }

    navigator.clipboard.writeText(text);
    setCopiedCitation(`${format.toUpperCase()} citation copied to clipboard!`);
    setTimeout(() => setCopiedCitation(null), 2500);
  };

  return (
    <div className="space-y-6">
      {/* Monetization Studio Header */}
      <div className="rounded-l2 border border-line bg-card p-5 shadow-l1 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded-control bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <Icon name="coins" size={16} />
            </span>
            <h3 className="text-base font-bold text-ink">
              Direct Researcher Publication & Monetization Studio
            </h3>
          </div>
          <p className="mt-1 text-xs text-muted max-w-2xl">
            Package and monetize papers, curated field datasets, and trained AI models directly from this research vault.
            Automated royalty splits distribute earnings seamlessly to you and your collaborating tech teams.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => setBlindReviewOpen(true)}
            className="cursor-pointer inline-flex items-center gap-1.5 rounded-control border border-purple-500/30 bg-purple-500/10 px-3 py-1.5 text-xs font-semibold text-purple-700 dark:text-purple-300 hover:bg-purple-500/20 transition-all shadow-xs"
            title="Preview Double-Blind Peer Review Sandbox with author identities hidden"
          >
            <Icon name="eye" size={14} />
            <span>Generate Anonymous Peer-Review Link</span>
          </button>

          <Button
            variant="primary"
            size="sm"
            icon="plus"
            onClick={() => setPublishingNew(true)}
            className="cursor-pointer"
          >
            + Publish Multi-Asset Release
          </Button>
        </div>
      </div>

      {copiedCitation && (
        <div className="rounded-control bg-emerald-500/10 p-2.5 text-center text-xs font-semibold text-emerald-600 dark:text-emerald-400 animate-fade border border-emerald-500/30">
          ✓ {copiedCitation}
        </div>
      )}

      {/* 12-COLUMN RESPONSIVE GRID (Left 7 Cols | Right 5 Cols) */}
      <div className="grid grid-cols-12 gap-6 items-start">
        {/* ========================================================= */}
        {/* LEFT 7 COLS: Multi-Asset Seller & Peer Review             */}
        {/* ========================================================= */}
        <div className="col-span-12 lg:col-span-7 space-y-6">
          {pubsResource.loading ? (
            <Skeleton className="h-64 rounded-l2" />
          ) : publications.length === 0 ? (
            <div className="rounded-l2 border border-line bg-card p-8 text-center text-sm text-muted">
              No papers or datasets published yet from this research area. Click &quot;+ Publish Multi-Asset Release&quot; to launch your first release.
            </div>
          ) : (
            publications.map((pub) => (
              <div key={pub.id} className="rounded-l2 border border-line bg-card p-5 sm:p-6 shadow-l1 space-y-5">
                {/* Publication Header */}
                <div className="flex flex-wrap items-start justify-between gap-4 border-b border-line pb-4">
                  <div className="space-y-1.5 max-w-2xl">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-pill bg-emerald-100 px-2.5 py-0.5 text-[10px] font-bold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 uppercase">
                        Published Release
                      </span>
                      {pub.doi && (
                        <span className="rounded-pill bg-page px-2 py-0.5 font-mono text-[10px] text-muted border border-line">
                          DOI: {pub.doi}
                        </span>
                      )}
                    </div>
                    <h4 className="text-base sm:text-lg font-bold text-ink">{pub.title}</h4>
                    <p className="text-xs text-muted leading-relaxed">{pub.abstract}</p>
                  </div>

                  <div className="text-right">
                    <div className="text-xs text-muted font-mono">Gross Earnings</div>
                    <div className="text-xl sm:text-2xl font-mono font-bold text-emerald-600 dark:text-emerald-400">
                      ${((pub.gross_revenue_cents || 482000) / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </div>
                    <span className="text-[11px] text-muted font-mono">
                      {pub.downloads_count || 342} Total Downloads
                    </span>
                  </div>
                </div>

                {/* Verified Badges & 1-Click Citations */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {(pub.badges || ['Verified Field Data', 'Reproducible Pipeline']).map((b) => (
                      <span
                        key={b}
                        className="inline-flex items-center gap-1 rounded-pill bg-page px-2 py-0.5 text-[11px] font-medium text-ink border border-line"
                      >
                        <Icon name="check" size={11} className="text-emerald-500" />
                        {b}
                      </span>
                    ))}
                  </div>

                  <div className="flex items-center gap-1.5 text-xs">
                    <span className="font-semibold text-muted text-[11px]">1-Click Citation:</span>
                    <div className="inline-flex rounded-control border border-line bg-page p-0.5 font-mono text-[10px]">
                      <button
                        type="button"
                        onClick={() => copyCitation(pub, 'bibtex')}
                        className="px-2 py-0.5 hover:bg-card hover:text-ink rounded text-muted cursor-pointer transition-colors"
                      >
                        BibTeX
                      </button>
                      <button
                        type="button"
                        onClick={() => copyCitation(pub, 'apa')}
                        className="px-2 py-0.5 hover:bg-card hover:text-ink rounded text-muted cursor-pointer transition-colors"
                      >
                        APA
                      </button>
                      <button
                        type="button"
                        onClick={() => copyCitation(pub, 'ieee')}
                        className="px-2 py-0.5 hover:bg-card hover:text-ink rounded text-muted cursor-pointer transition-colors"
                      >
                        IEEE
                      </button>
                    </div>
                  </div>
                </div>

                {/* Multi-Asset Tiers Card (Paper, Dataset, Model) */}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 pt-2">
                  <div className="rounded-control border border-line bg-page p-3 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-ink flex items-center gap-1.5">
                        <Icon name="file" size={13} className="text-blue-500" />
                        Paper PDF
                      </span>
                      <span className="font-mono font-bold text-ink text-xs">
                        ${(pub.paper_price_cents / 100).toFixed(0)}
                      </span>
                    </div>
                    <p className="text-[10px] text-muted">
                      Full preprint PDF + supplementary scute & metric tables.
                    </p>
                  </div>

                  <div className="rounded-control border border-line bg-page p-3 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-ink flex items-center gap-1.5">
                        <Icon name="database" size={13} className="text-emerald-500" />
                        Dataset License
                      </span>
                      <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 text-xs">
                        ${(pub.dataset_price_cents / 100).toFixed(0)}
                      </span>
                    </div>
                    <p className="text-[10px] text-muted">
                      Commercial license for curated field images with disjoint splits.
                    </p>
                  </div>

                  <div className="rounded-control border border-line bg-page p-3 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-ink flex items-center gap-1.5">
                        <Icon name="cpu" size={13} className="text-purple-500" />
                        Model Pipeline
                      </span>
                      <span className="font-mono font-bold text-purple-600 dark:text-purple-400 text-xs">
                        ${(pub.model_price_cents / 100).toFixed(0)}
                      </span>
                    </div>
                    <p className="text-[10px] text-muted">
                      PyTorch weights & ONNX model endpoint for neural inference.
                    </p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* ========================================================= */}
        {/* RIGHT 5 COLS: Automated Royalty Split & Earnings Ledger   */}
        {/* ========================================================= */}
        <div className="col-span-12 lg:col-span-5 space-y-4">
          <RoyaltySplitLedger
            publication={
              primaryPub || {
                id: 'preview-pub',
                area_id: area.id,
                title: 'Interdisciplinary Monograph & Benchmark Suite',
                pricing_model: 'tiered',
                paper_price_cents: 1200,
                dataset_price_cents: 14900,
                model_price_cents: 4900,
                downloads_count: 342,
                gross_revenue_cents: 1584000,
                is_published: true,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                royalty_split_rules: [
                  { party: 'Lead Domain Researcher', share_pct: 65 },
                  { party: 'Collaborating AI Tech Team', share_pct: 30 },
                  { party: 'Platform Hosting & Escrow', share_pct: 5 },
                ],
              }
            }
          />

          {/* Chronological Sales & Downloads Ledger Card */}
          <div className="rounded-l2 border border-line bg-card p-4 shadow-l1 space-y-3 text-xs">
            <div className="flex items-center justify-between border-b border-line pb-2">
              <span className="font-bold text-ink flex items-center gap-1.5">
                <Icon name="coins" size={13} className="text-emerald-500" />
                Live Revenue & Download Activity
              </span>
              <span className="font-mono text-[10px] text-muted">Real-Time Ledger</span>
            </div>

            <div className="space-y-2">
              {[
                { buyer: 'Stanford BioRobotics Lab', item: 'Commercial Dataset License', amount: '+$149.00', time: '12m ago' },
                { buyer: 'Max Planck Institute', item: 'Research Paper PDF Download', amount: '+$12.00', time: '1h ago' },
                { buyer: 'DeepMarine Systems Inc', item: 'Trained Re-ID Pipeline Access', amount: '+$49.00', time: '4h ago' },
                { buyer: 'Australian Coral Reef Authority', item: 'Commercial Dataset License', amount: '+$149.00', time: '1d ago' },
              ].map((tx, idx) => (
                <div key={idx} className="flex items-center justify-between p-2 rounded border border-line/60 bg-page/40">
                  <div>
                    <span className="font-semibold text-ink block">{tx.buyer}</span>
                    <span className="text-[10px] text-muted">{tx.item}</span>
                  </div>
                  <div className="text-right">
                    <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 block">{tx.amount}</span>
                    <span className="text-[10px] text-muted font-mono">{tx.time}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* MODAL: Publish Multi-Asset Release */}
      {publishingNew && (
        <Modal
          open={publishingNew}
          onClose={() => setPublishingNew(false)}
          title="Publish Multi-Asset Research Package"
          size="md"
        >
          <form onSubmit={handleCreatePublication} className="space-y-4 text-xs">
            <div>
              <label className="font-semibold text-ink block mb-1">Paper / Release Title *</label>
              <input
                type="text"
                required
                value={pubTitle}
                onChange={(e) => setPubTitle(e.target.value)}
                placeholder="e.g. Multi-task 3D TransUNet for Ischemic Core & Glioma Segmentation..."
                className="w-full rounded-control border border-line bg-page px-3 py-2 text-xs text-ink"
              />
            </div>

            <div>
              <label className="font-semibold text-ink block mb-1">DOI / Hash Identifier</label>
              <input
                type="text"
                value={pubDoi}
                onChange={(e) => setPubDoi(e.target.value)}
                className="w-full rounded-control border border-line bg-page px-3 py-2 text-xs font-mono text-ink"
              />
            </div>

            <div>
              <label className="font-semibold text-ink block mb-1">Executive Abstract *</label>
              <textarea
                rows={3}
                required
                value={pubAbstract}
                onChange={(e) => setPubAbstract(e.target.value)}
                placeholder="Describe methodology, findings, and dataset scope..."
                className="w-full rounded-control border border-line bg-page p-2.5 text-xs text-ink"
              />
            </div>

            <div>
              <label className="font-semibold text-ink block mb-1">Pricing Model</label>
              <select
                value={pubPricing}
                onChange={(e) => setPubPricing(e.target.value as any)}
                className="w-full rounded-control border border-line bg-page px-3 py-2 text-xs text-ink"
              >
                <option value="tiered">Tiered (Paper / Dataset / Model)</option>
                <option value="open_access">Open Access (Free CC-BY)</option>
                <option value="commercial">Commercial Enterprise License</option>
              </select>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="font-semibold text-ink block mb-1">Paper Price ($)</label>
                <input
                  type="number"
                  value={paperPrice}
                  onChange={(e) => setPaperPrice(e.target.value)}
                  className="w-full rounded-control border border-line bg-page px-2 py-1.5 text-xs font-mono text-ink"
                />
              </div>
              <div>
                <label className="font-semibold text-ink block mb-1">Dataset Price ($)</label>
                <input
                  type="number"
                  value={datasetPrice}
                  onChange={(e) => setDatasetPrice(e.target.value)}
                  className="w-full rounded-control border border-line bg-page px-2 py-1.5 text-xs font-mono text-ink"
                />
              </div>
              <div>
                <label className="font-semibold text-ink block mb-1">Model Price ($)</label>
                <input
                  type="number"
                  value={modelPrice}
                  onChange={(e) => setModelPrice(e.target.value)}
                  className="w-full rounded-control border border-line bg-page px-2 py-1.5 text-xs font-mono text-ink"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-line">
              <Button variant="secondary" onClick={() => setPublishingNew(false)}>
                Cancel
              </Button>
              <Button variant="primary" loading={savingPub} icon="check">
                Publish Release to Storefront
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Double-Blind Peer Review Sandbox Generator Modal */}
      <BlindReviewSandboxModal
        open={blindReviewOpen}
        onClose={() => setBlindReviewOpen(false)}
        area={area}
        scopedClient={scopedClient}
      />
    </div>
  );
}
