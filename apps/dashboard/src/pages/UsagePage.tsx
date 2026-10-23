import { useState } from 'react';
import { AnimatedNumber, Card, PageHeader, Reveal, SegmentedControl, Skeleton, StatCard, UsageChart, usd } from '@layerto/ui';
import type { BalanceResponse } from '@layerto/types';
import { ModelBreakdown } from '../components/usage/ModelBreakdown';
import { useUsage } from '../hooks/useUsage';
import { dollarsToNumber } from '../lib/money';

const RANGES = [
  { value: '7', label: '7 days' },
  { value: '30', label: '30 days' },
  { value: '90', label: '90 days' },
  { value: '365', label: '1 year' },
];

export function UsagePage({ balance }: { balance: BalanceResponse | undefined }) {
  const [range, setRange] = useState('30');
  const days = Number(range);
  const { totals, daily, dailyLoading, truncated } = useUsage(days);
  const t = totals.data;

  return (
    <>
      <PageHeader
        title="Usage"
        description="Successful calls and spend, from the usage ledger."
        actions={<SegmentedControl label="Time range" segments={RANGES} value={range} onChange={setRange} />}
      />
      <Reveal index={0} className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard label={`Calls in ${days} days`} loading={totals.loading} value={<AnimatedNumber value={t?.total_requests ?? 0} />} />
        <StatCard
          label={`Spend in ${days} days`}
          loading={totals.loading}
          value={<AnimatedNumber value={dollarsToNumber(t?.total_charge_usd)} format={(n) => `$${n.toFixed(4)}`} />}
          hint={t ? `${usd(t.total_charge_usd)} exactly` : undefined}
        />
        <StatCard
          label="Balance"
          loading={!balance}
          value={<AnimatedNumber value={dollarsToNumber(balance?.balance_usd)} format={(n) => `$${n.toFixed(2)}`} />}
          hint={balance ? `${balance.free_calls_remaining} free calls left` : undefined}
        />
      </Reveal>
      <Reveal index={1}>
        <Card title="Calls per day" subtitle="Built from your request history (UTC days).">
          {dailyLoading ? <Skeleton className="h-44" /> : <UsageChart data={daily} />}
          {truncated && <p className="mt-3 text-xs text-muted">Showing your latest 1,000 requests in this range.</p>}
        </Card>
      </Reveal>
      <Reveal index={2}>
        <Card title="By model">{t ? <ModelBreakdown usage={t} /> : <Skeleton className="h-24" />}</Card>
      </Reveal>
    </>
  );
}
