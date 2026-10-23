import { useState } from 'react';
import type { ResearchPublication } from '@layerto/types';
import { Icon } from '@layerto/ui';

interface RoyaltySplitLedgerProps {
  publication?: ResearchPublication;
}

export function RoyaltySplitLedger({ publication }: RoyaltySplitLedgerProps) {
  const [downloads, setDownloads] = useState<number>(publication?.downloads_count || 342);
  const [paperPrice, setPaperPrice] = useState<number>(
    publication?.paper_price_cents ? publication.paper_price_cents / 100 : 12,
  );
  const [datasetPrice, setDatasetPrice] = useState<number>(
    publication?.dataset_price_cents ? publication.dataset_price_cents / 100 : 149,
  );

  // Default royalty rules if none set in publication
  const rules = publication?.royalty_split_rules?.length
    ? publication.royalty_split_rules
    : [
        { party: 'Lead Domain Researcher', share_pct: 65 },
        { party: 'Collaborating AI Tech Team', share_pct: 30 },
        { party: 'Platform Hosting & Escrow', share_pct: 5 },
      ];

  // Assume 75% paper downloads, 25% commercial dataset licenses
  const paperDownloads = Math.round(downloads * 0.75);
  const datasetLicenses = Math.round(downloads * 0.25);
  const totalRevenue = paperDownloads * paperPrice + datasetLicenses * datasetPrice;

  return (
    <div className="rounded-l2 border border-line bg-card p-5 shadow-l1 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex size-6 items-center justify-center rounded-control bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <Icon name="coins" size={14} />
            </span>
            <h3 className="text-sm font-bold text-ink">
              Automated Co-Author & Tech Team Royalty Ledger
            </h3>
          </div>
          <p className="mt-0.5 text-xs text-muted">
            Live revenue distribution calculator for paper preprints, dataset downloads, and model endpoints.
          </p>
        </div>
        <div className="rounded-control bg-emerald-500/10 px-3 py-1 text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400">
          Gross Volume: ${totalRevenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </div>
      </div>

      {/* Pricing Inputs */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div>
          <label className="text-xs font-semibold text-muted block mb-1">
            Paper Download Price ($)
          </label>
          <input
            type="number"
            min="0"
            step="1"
            value={paperPrice}
            onChange={(e) => setPaperPrice(parseFloat(e.target.value) || 0)}
            className="w-full rounded-control border border-line bg-page px-3 py-1.5 text-xs font-mono text-ink"
          />
          <span className="text-[10px] text-muted mt-0.5 block">{paperDownloads} downloads</span>
        </div>

        <div>
          <label className="text-xs font-semibold text-muted block mb-1">
            Dataset License Price ($)
          </label>
          <input
            type="number"
            min="0"
            step="1"
            value={datasetPrice}
            onChange={(e) => setDatasetPrice(parseFloat(e.target.value) || 0)}
            className="w-full rounded-control border border-line bg-page px-3 py-1.5 text-xs font-mono text-ink"
          />
          <span className="text-[10px] text-muted mt-0.5 block">{datasetLicenses} commercial licenses</span>
        </div>

        <div>
          <label className="text-xs font-semibold text-muted block mb-1">
            Total Download Count
          </label>
          <input
            type="number"
            min="1"
            value={downloads}
            onChange={(e) => setDownloads(parseInt(e.target.value, 10) || 0)}
            className="w-full rounded-control border border-line bg-page px-3 py-1.5 text-xs font-mono text-ink"
          />
          <span className="text-[10px] text-muted mt-0.5 block">Across all tiers</span>
        </div>
      </div>

      {/* Royalty Distribution Ledger Table */}
      <div className="overflow-hidden rounded-control border border-line bg-page">
        <table className="w-full border-collapse text-left text-xs">
          <thead>
            <tr className="border-b border-line bg-page/80 text-muted">
              <th className="py-2.5 pl-4 pr-3 font-semibold">Beneficiary / Party</th>
              <th className="py-2.5 px-3 font-semibold text-right">Agreed Share (%)</th>
              <th className="py-2.5 pr-4 pl-3 font-semibold text-right">Payout Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line/60">
            {rules.map((rule) => {
              const payout = (totalRevenue * rule.share_pct) / 100;
              return (
                <tr key={rule.party} className="hover:bg-card/50 transition-colors">
                  <td className="py-2.5 pl-4 pr-3">
                    <span className="font-semibold text-ink">{rule.party}</span>
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono font-medium text-ink">
                    {rule.share_pct}%
                  </td>
                  <td className="py-2.5 pr-4 pl-3 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                    ${payout.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-xs text-muted pt-1">
        <span className="flex items-center gap-1.5">
          <Icon name="shield" size={13} className="text-emerald-500" /> Smart escrow contract ready
          & distributed via micro-USD on-chain or bank wire.
        </span>
        <span className="font-mono text-[11px]">Contract ID: ESC-{publication?.id ? publication.id.slice(0, 8) : '9948a201'}</span>
      </div>
    </div>
  );
}
