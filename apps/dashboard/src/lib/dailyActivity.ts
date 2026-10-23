import type { RequestLogItem } from '@layerto/types';
import { formatMicroUsd } from './money.ts';

export interface DayActivity {
  date: string; // YYYY-MM-DD (UTC)
  requests: number;
  chargeMicro: number;
  charge: string;
}

function utcDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Groups real request history into one bucket per UTC day for the last `days` days
 * (oldest first, empty days included). Only executed requests count, matching /api/usage.
 */
export function dailyActivity(requests: RequestLogItem[], days: number, now: Date = new Date()): DayActivity[] {
  const buckets = new Map<string, { requests: number; chargeMicro: number }>();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 86_400_000);
    buckets.set(utcDay(d), { requests: 0, chargeMicro: 0 });
  }
  for (const r of requests) {
    if (r.status !== 'executed') continue;
    const bucket = buckets.get(utcDay(new Date(r.created_at)));
    if (!bucket) continue;
    bucket.requests += 1;
    bucket.chargeMicro += r.charge_micro_usd;
  }
  return [...buckets.entries()].map(([date, b]) => ({
    date,
    requests: b.requests,
    chargeMicro: b.chargeMicro,
    charge: formatMicroUsd(b.chargeMicro),
  }));
}
