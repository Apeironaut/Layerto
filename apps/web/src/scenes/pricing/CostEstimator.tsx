import { useState } from 'react';
import type { PublicModelItem } from '@layerto/types';
import { Input, Select } from '@layerto/ui';
import { FREE_CALLS, estimateMicro, formatMicro, toMicro } from './money';

const PRESETS = [100, 1_000, 10_000, 100_000];

/** Pick a model and a number of calls; see the exact cost at today's live price. */
export function CostEstimator({ models }: { models: PublicModelItem[] }) {
  const [slug, setSlug] = useState(models[0]?.slug ?? '');
  const [callsText, setCallsText] = useState('1000');
  const [useFree, setUseFree] = useState(true);

  const model = models.find((m) => m.slug === slug) ?? models[0];
  if (!model) return null;
  const calls = Math.max(0, Math.min(10_000_000, Math.floor(Number(callsText) || 0)));
  const price = toMicro(model.price_usd);
  const free = useFree ? FREE_CALLS : 0;
  const { paidCalls, micro } = estimateMicro(calls, price, free);

  return (
    <div className="rounded-l1 border border-line bg-card p-6 sm:p-8">
      <h3 className="text-xl font-bold">Estimate your cost</h3>
      <p className="mt-1 text-sm text-muted">Uses the live price of each model.</p>

      <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
        <div className="space-y-4">
          <Select label="Model" value={model.slug} onChange={(e) => setSlug(e.target.value)} options={models.map((m) => ({ value: m.slug, label: m.name }))} />
          <Input
            label="Number of calls"
            type="number"
            inputMode="numeric"
            min={0}
            value={callsText}
            onChange={(e) => setCallsText(e.target.value)}
          />
          <div className="flex flex-wrap gap-2" aria-label="Quick picks">
            {PRESETS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setCallsText(String(p))}
                aria-pressed={calls === p}
                className={`px-3 py-1.5 rounded-pill border text-xs font-semibold cursor-pointer transition-colors ${
                  calls === p ? 'border-crimson-border bg-crimson-tint text-crimson' : 'border-line text-ink-secondary hover:border-line-strong'
                }`}
              >
                {p.toLocaleString('en-US')}
              </button>
            ))}
          </div>
          <label className="flex items-center gap-2 text-sm text-ink-secondary cursor-pointer">
            <input type="checkbox" checked={useFree} onChange={(e) => setUseFree(e.target.checked)} className="accent-crimson h-4 w-4" />
            New account (first {FREE_CALLS} calls free)
          </label>
        </div>

        <div className="rounded-l2 bg-page border border-line p-6" aria-live="polite">
          <div className="text-sm text-muted">Estimated cost</div>
          <div className="mt-1 text-4xl sm:text-5xl font-bold tabular-nums tracking-tight break-all">{formatMicro(micro)}</div>
          <dl className="mt-6 space-y-2 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-muted">Price per call</dt>
              <dd className="font-mono tabular-nums">{formatMicro(price)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted">Calls</dt>
              <dd className="font-mono tabular-nums">{calls.toLocaleString('en-US')}</dd>
            </div>
            {useFree && (
              <div className="flex justify-between gap-4">
                <dt className="text-muted">Free calls</dt>
                <dd className="font-mono tabular-nums">−{Math.min(calls, FREE_CALLS)}</dd>
              </div>
            )}
            <div className="flex justify-between gap-4 pt-2 border-t border-line">
              <dt className="text-muted">Paid calls × price</dt>
              <dd className="font-mono tabular-nums">
                {paidCalls.toLocaleString('en-US')} × {formatMicro(price)}
              </dd>
            </div>
          </dl>
          <p className="mt-4 text-xs text-muted">Failed calls are not charged, so your real cost can only be lower.</p>
        </div>
      </div>
    </div>
  );
}
