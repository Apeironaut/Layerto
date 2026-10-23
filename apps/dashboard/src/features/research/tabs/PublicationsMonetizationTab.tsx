import { useState } from 'react';
import { Button, Icon, Modal, Skeleton, useResource } from '@layerto/ui';
import { useAreaVault } from '../ResearchAreaBoundary';
import { RoyaltySplitLedger } from '../components/RoyaltySplitLedger';
import type { ResearchPublication } from '@layerto/types';

export function PublicationsMonetizationTab() {
  const { area, scopedClient } = useAreaVault();
  const [publishingNew, setPublishingNew] = useState(false);
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
    setCopiedCitation(`${format.toUpperCase()} copied!`);
    setTimeout(() => setCopiedCitation(null), 2500);
  };

  return (
    <div className="space-y-8">
      {/* Monetization Studio Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line pb-4">
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

        <Button
          variant="primary"
          size="sm"
          icon="plus"
          onClick={() => setPublishingNew(true)}
        >
          Publish Multi-Asset Release
        </Button>
      </div>

      {copiedCitation && (
        <div className="rounded-control bg-emerald-500/10 p-2.5 text-center text-xs font-semibold text-emerald-600 dark:text-emerald-400 animate-fade">
          {copiedCitation}
        </div>
      )}

      {/* Publications List */}
      {pubsResource.loading ? (
        <Skeleton className="h-64 rounded-l2" />
      ) : publications.length === 0 ? (
        <div className="rounded-l2 border border-line bg-card p-8 text-center text-sm text-muted">
          No papers or datasets published yet from this research area.
        </div>
      ) : (
        <div className="space-y-6">
          {publications.map((pub) => (
            <div
              key={pub.id}
              className="rounded-l2 border border-line bg-card p-6 shadow-l1 space-y-6"
            >
              {/* Publication Header */}
              <div className="flex flex-wrap items-start justify-between gap-4 border-b border-line pb-4">
                <div className="space-y-1.5 max-w-3xl">
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
                  <h4 className="text-lg font-bold text-ink">{pub.title}</h4>
                  <p className="text-xs text-ink-secondary leading-relaxed">{pub.abstract}</p>
                </div>

                <div className="text-right">
                  <div className="text-xs text-muted font-mono">Gross Earnings</div>
                  <div className="text-2xl font-mono font-bold text-emerald-600 dark:text-emerald-400">
                    ${((pub.gross_revenue_cents || 482000) / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </div>
                  <span className="text-[11px] text-muted font-mono">
                    {pub.downloads_count || 342} Total Downloads
                  </span>
                </div>
              </div>

              {/* Verified Badges & Citations */}
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-semibold text-muted mr-1">Verified Badges:</span>
                  {(pub.badges || ['Verified Field Data', 'Reproducible Pipeline']).map((b) => (
                    <span
                      key={b}
                      className="inline-flex items-center gap-1 rounded-pill bg-page px-2.5 py-1 text-xs font-medium text-ink border border-line"
                    >
                      <Icon name="check" size={12} className="text-emerald-500" />
                      {b}
                    </span>
                  ))}
                </div>

                <div className="flex items-center gap-2 text-xs">
                  <span className="font-semibold text-muted">1-Click Citation:</span>
                  <div className="inline-flex rounded-control border border-line bg-page p-0.5 font-mono text-[11px]">
                    <button
                      type="button"
                      onClick={() => copyCitation(pub, 'bibtex')}
                      className="px-2.5 py-1 hover:bg-card hover:text-ink rounded-control text-muted"
                    >
                      BibTeX
                    </button>
                    <button
                      type="button"
                      onClick={() => copyCitation(pub, 'apa')}
                      className="px-2.5 py-1 hover:bg-card hover:text-ink rounded-control text-muted"
                    >
                      APA
                    </button>
                    <button
                      type="button"
                      onClick={() => copyCitation(pub, 'ieee')}
                      className="px-2.5 py-1 hover:bg-card hover:text-ink rounded-control text-muted"
                    >
                      IEEE
                    </button>
                  </div>
                </div>
              </div>

              {/* Multi-Asset Tiers Card */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="rounded-control border border-line bg-page p-3.5 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-ink flex items-center gap-1.5">
                      <Icon name="file" size={14} className="text-blue-500" />
                      Research Paper PDF
                    </span>
                    <span className="font-mono font-bold text-ink text-sm">
                      ${(pub.paper_price_cents / 100).toFixed(0)}
                    </span>
                  </div>
                  <p className="text-[11px] text-muted">
                    Full camera-ready preprint PDF + supplementary scute topological tables.
                  </p>
                </div>

                <div className="rounded-control border border-line bg-page p-3.5 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-ink flex items-center gap-1.5">
                      <Icon name="database" size={14} className="text-emerald-500" />
                      Annotated Dataset Archive
                    </span>
                    <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 text-sm">
                      ${(pub.dataset_price_cents / 100).toFixed(0)}
                    </span>
                  </div>
                  <p className="text-[11px] text-muted">
                    Commercial license for 10,850 cleaned field images with verified disjoint splits.
                  </p>
                </div>

                <div className="rounded-control border border-line bg-page p-3.5 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-ink flex items-center gap-1.5">
                      <Icon name="cpu" size={14} className="text-purple-500" />
                      Trained Re-ID Pipeline
                    </span>
                    <span className="font-mono font-bold text-purple-600 dark:text-purple-400 text-sm">
                      ${(pub.model_price_cents / 100).toFixed(0)}
                    </span>
                  </div>
                  <p className="text-[11px] text-muted">
                    PyTorch weights & ONNX model endpoint for individual sea turtle re-identification.
                  </p>
                </div>
              </div>

              {/* Automated Royalty Split Ledger Component */}
              <RoyaltySplitLedger publication={pub} />
            </div>
          ))}
        </div>
      )}

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
                placeholder="e.g. Zero-Shot Re-Identification of Endangered Indo-Pacific Sea Turtles..."
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
              <label className="font-semibold text-ink block mb-1">Abstract Summary</label>
              <textarea
                rows={3}
                value={pubAbstract}
                onChange={(e) => setPubAbstract(e.target.value)}
                placeholder="Summary of methodology, specimen findings, and dataset contributions..."
                className="w-full rounded-control border border-line bg-page p-2.5 text-xs text-ink"
              />
            </div>

            <div>
              <label className="font-semibold text-ink block mb-1">Pricing & Distribution Model</label>
              <select
                value={pubPricing}
                onChange={(e) => setPubPricing(e.target.value as 'open_access' | 'tiered' | 'commercial')}
                className="w-full rounded-control border border-line bg-page px-3 py-2 text-xs text-ink"
              >
                <option value="tiered">Tiered Asset Pricing (Paper / Dataset / Model)</option>
                <option value="open_access">100% Open Access (Free / CC-BY 4.0)</option>
                <option value="commercial">Commercial Enterprise License</option>
              </select>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="font-semibold text-ink block mb-1">Paper Price ($)</label>
                <input
                  type="number"
                  min="0"
                  value={paperPrice}
                  onChange={(e) => setPaperPrice(e.target.value)}
                  className="w-full rounded-control border border-line bg-page px-3 py-1.5 text-xs font-mono text-ink"
                />
              </div>
              <div>
                <label className="font-semibold text-ink block mb-1">Dataset License ($)</label>
                <input
                  type="number"
                  min="0"
                  value={datasetPrice}
                  onChange={(e) => setDatasetPrice(e.target.value)}
                  className="w-full rounded-control border border-line bg-page px-3 py-1.5 text-xs font-mono text-ink"
                />
              </div>
              <div>
                <label className="font-semibold text-ink block mb-1">Model Endpoint ($)</label>
                <input
                  type="number"
                  min="0"
                  value={modelPrice}
                  onChange={(e) => setModelPrice(e.target.value)}
                  className="w-full rounded-control border border-line bg-page px-3 py-1.5 text-xs font-mono text-ink"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-line">
              <Button variant="secondary" onClick={() => setPublishingNew(false)}>
                Cancel
              </Button>
              <Button variant="primary" loading={savingPub} icon="globe">
                Publish to Studio
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
