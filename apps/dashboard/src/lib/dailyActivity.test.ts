import test from 'node:test';
import assert from 'node:assert';
import { dailyActivity } from './dailyActivity.ts';
import { formatMicroUsd } from './money.ts';
import type { RequestLogItem } from '@layerto/types';

const now = new Date('2026-10-21T12:00:00Z');
const req = (created_at: string, status: RequestLogItem['status'], charge = 2000): RequestLogItem => ({
  seq: 1, request_id: created_at, created_at, model_slug: 'turtle-id', routed: 'direct',
  status, latency_ms: 10, charge_micro_usd: charge, charge_usd: formatMicroUsd(charge),
});

test('one bucket per day, oldest first, empty days included', () => {
  const days = dailyActivity([], 7, now);
  assert.strictEqual(days.length, 7);
  assert.strictEqual(days[0].date, '2026-10-15');
  assert.strictEqual(days[6].date, '2026-10-21');
  assert.ok(days.every((d) => d.requests === 0 && d.charge === '$0.000000'));
});

test('counts only executed requests and sums their charges exactly', () => {
  const days = dailyActivity(
    [
      req('2026-10-21T01:00:00Z', 'executed', 2000),
      req('2026-10-21T02:00:00Z', 'executed', 1000),
      req('2026-10-21T03:00:00Z', 'failed', 0),
      req('2026-10-20T23:59:59Z', 'executed', 2000),
      req('2026-09-01T00:00:00Z', 'executed', 2000), // outside the range
    ],
    7,
    now,
  );
  assert.deepStrictEqual(days[6], { date: '2026-10-21', requests: 2, chargeMicro: 3000, charge: '$0.003000' });
  assert.strictEqual(days[5].requests, 1);
  assert.strictEqual(days.reduce((s, d) => s + d.requests, 0), 3);
});

test('formatMicroUsd is exact', () => {
  assert.strictEqual(formatMicroUsd(1), '$0.000001');
  assert.strictEqual(formatMicroUsd(4_200_000), '$4.200000');
  assert.strictEqual(formatMicroUsd(1_234_567_890), '$1,234.567890');
});
