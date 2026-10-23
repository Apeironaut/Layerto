import { useState, useMemo } from 'react';
import { Card, EmptyState, Skeleton, Table, THead, Th, Tr, Td, SegmentedControl, usd } from '@layerto/ui';
import { useUsage } from '../../hooks/useUsage';
import { ActivityBarLineChart } from './ActivityBarLineChart';
import { DonutChart } from './DonutChart';
import { calculatePieSlices } from '../../lib/chartCalculations';
import { formatMicroUsd } from '../../lib/money';

const DAY_OPTIONS = [
  { value: '7', label: '7d' },
  { value: '30', label: '30d' },
  { value: '90', label: '90d' },
  { value: '365', label: '1y' },
];

const SLIDE_TITLES = [
  'Top models',
  'Daily activity',
  'Cost per model',
];

const SLIDE_SUBTITLES = [
  'Ranked by request volume over selected period.',
  'Daily request volume & spend (bars / line).',
  'Spend distribution across models (pie chart).',
];

/**
 * Top models card with 3-D shadow and arrow-navigable multi-graph views:
 * 1. Models breakdown table
 * 2. Bar chart / line chart of activity
 * 3. Cost-per-model pie chart
 * All filterable by days.
 */
export function TopModels() {
  const [days, setDays] = useState('30');
  const [slideIdx, setSlideIdx] = useState(0); // 0 = table, 1 = bar/line, 2 = pie chart
  const daysNum = Number(days);

  const { totals, daily, dailyLoading } = useUsage(daysNum);
  const usage = totals.data;

  const costSlices = useMemo(() => {
    if (!usage || !usage.by_model) return [];
    const items = usage.by_model.map((m) => ({
      label: m.model_slug,
      value: m.charge_micro_usd,
    }));
    return calculatePieSlices(items);
  }, [usage]);

  const handlePrev = () => setSlideIdx((i) => (i === 0 ? 2 : i - 1));
  const handleNext = () => setSlideIdx((i) => (i === 2 ? 0 : i + 1));

  const totalCostStr = usage ? usd(usage.total_charge_usd) : '$0.00';

  return (
    <Card
      title={`${SLIDE_TITLES[slideIdx]} (${days} days)`}
      subtitle={SLIDE_SUBTITLES[slideIdx]}
      className="h-full flex flex-col rounded-l1 bg-card border border-line shadow-l2 hover:shadow-l3 hover:-translate-y-1 transition-all duration-300 min-h-[460px]"
      actions={
        <div className="flex items-center gap-2 flex-wrap">
          <SegmentedControl
            label="Time range"
            segments={DAY_OPTIONS}
            value={days}
            onChange={setDays}
          />

          {/* Arrow navigation buttons between graphs */}
          <div className="flex items-center gap-1 bg-page border border-line rounded-control p-0.5">
            <button
              type="button"
              onClick={handlePrev}
              className="p-1.5 rounded-sm text-muted hover:text-ink hover:bg-card transition-colors cursor-pointer"
              title="Previous graph"
              aria-label="Previous graph"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <span className="text-[11px] font-mono text-muted px-1 select-none">
              {slideIdx + 1}/3
            </span>
            <button
              type="button"
              onClick={handleNext}
              className="p-1.5 rounded-sm text-muted hover:text-ink hover:bg-card transition-colors cursor-pointer"
              title="Next graph"
              aria-label="Next graph"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>
      }
    >
      <div className="flex-1 flex flex-col justify-between">
        {totals.loading ? (
          <Skeleton className="h-56" />
        ) : !usage || usage.by_model.length === 0 ? (
          <EmptyState
            icon="cpu"
            title={`No model calls in the last ${days} days`}
            description="Model inferences will appear here automatically."
          />
        ) : slideIdx === 0 ? (
          /* View 0: Table breakdown */
          <div className="overflow-x-auto">
            <Table label={`Top models (${days} days)`}>
              <THead>
                <Th>Model</Th>
                <Th className="text-right">Requests</Th>
                <Th className="text-right">Spend</Th>
                <Th>Share</Th>
              </THead>
              <tbody>
                {usage.by_model.map((m) => {
                  const pct =
                    usage.total_requests > 0
                      ? Math.round((m.requests / usage.total_requests) * 100)
                      : 0;
                  return (
                    <Tr key={m.model_slug}>
                      <Td className="font-mono text-xs font-semibold">{m.model_slug}</Td>
                      <Td className="text-right tabular-nums">{m.requests.toLocaleString()}</Td>
                      <Td className="text-right font-mono text-xs">{usd(m.charge_usd)}</Td>
                      <Td>
                        <div className="flex items-center gap-2">
                          <div
                            className="h-2 w-16 sm:w-24 rounded-full bg-line overflow-hidden"
                            aria-hidden="true"
                          >
                            <div
                              className="h-full bg-crimson rounded-full"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="text-xs text-muted tabular-nums">{pct}%</span>
                        </div>
                      </Td>
                    </Tr>
                  );
                })}
              </tbody>
            </Table>
          </div>
        ) : slideIdx === 1 ? (
          /* View 1: Bar & Line Activity chart */
          <div className="py-2">
            {dailyLoading ? (
              <Skeleton className="h-44 w-full" />
            ) : (
              <ActivityBarLineChart data={daily} />
            )}
          </div>
        ) : (
          /* View 2: Model Cost Pie chart */
          <div className="py-2">
            {usage.total_charge_micro_usd === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <p className="text-xs text-muted font-medium">All calls in this period were free tier.</p>
                <span className="text-xs font-mono text-crimson font-semibold mt-1">Total spend: $0.000000</span>
              </div>
            ) : (
              <DonutChart
                slices={costSlices}
                totalLabel="Total Spend"
                totalValue={totalCostStr}
                valueFormatter={(micro) => formatMicroUsd(micro)}
              />
            )}
          </div>
        )}

        {/* Footer controls: slide indicator dots and fast navigation */}
        <div className="pt-4 mt-auto border-t border-line/60 flex items-center justify-between text-xs text-muted">
          <div className="flex items-center gap-1.5" role="tablist" aria-label="Graph slides">
            {[0, 1, 2].map((i) => (
              <button
                key={i}
                type="button"
                onClick={() => setSlideIdx(i)}
                className={`h-2 rounded-full transition-all cursor-pointer ${
                  slideIdx === i ? 'w-5 bg-crimson' : 'w-2 bg-line hover:bg-muted'
                }`}
                aria-label={`Go to ${SLIDE_TITLES[i]}`}
                aria-selected={slideIdx === i}
                role="tab"
              />
            ))}
            <span className="ml-2 font-medium text-ink">
              {SLIDE_TITLES[slideIdx]}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrev}
              className="hover:text-crimson transition-colors cursor-pointer"
              aria-label="Previous view"
            >
              ← Prev
            </button>
            <span>·</span>
            <button
              type="button"
              onClick={handleNext}
              className="hover:text-crimson transition-colors cursor-pointer"
              aria-label="Next view"
            >
              Next →
            </button>
          </div>
        </div>
      </div>
    </Card>
  );
}
