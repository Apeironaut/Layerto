import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeExpiryDate, formatLocalDateInput, getMaxCustomDate, getMinCustomDate } from './keyExpiry.ts';

test('formatLocalDateInput formats YYYY-MM-DD correctly', () => {
  const d = new Date(2026, 9, 21, 15, 30); // Oct 21, 2026
  assert.equal(formatLocalDateInput(d), '2026-10-21');
});

test('getMinCustomDate returns tomorrow', () => {
  const now = new Date(2026, 9, 21, 12, 0);
  assert.equal(getMinCustomDate(now), '2026-10-22');
});

test('getMaxCustomDate returns today + 365 days', () => {
  const now = new Date(2026, 9, 21, 12, 0);
  const expected = new Date(2026, 9, 21 + 365);
  assert.equal(getMaxCustomDate(now), formatLocalDateInput(expected));
});

test('computeExpiryDate handles presets correctly', () => {
  const now = new Date(2026, 9, 21, 12, 0);

  // Never returns null
  assert.equal(computeExpiryDate('never', undefined, now), null);

  // 7 days preset
  const exp7d = computeExpiryDate('7d', undefined, now);
  assert.ok(exp7d);
  const d7d = new Date(exp7d);
  assert.ok(d7d.getTime() > now.getTime());
  assert.ok(d7d.getTime() <= now.getTime() + 8 * 86400000);

  // 30 days preset
  const exp30d = computeExpiryDate('30d', undefined, now);
  assert.ok(exp30d);
  const d30d = new Date(exp30d);
  assert.ok(d30d.getTime() > now.getTime() + 29 * 86400000);

  // 90 days preset
  const exp90d = computeExpiryDate('90d', undefined, now);
  assert.ok(exp90d);
  const d90d = new Date(exp90d);
  assert.ok(d90d.getTime() > now.getTime() + 89 * 86400000);

  // 1 year preset: clamped to at most now + 365 days
  const exp1y = computeExpiryDate('1y', undefined, now);
  assert.ok(exp1y);
  const d1y = new Date(exp1y);
  assert.ok(d1y.getTime() <= now.getTime() + 365 * 86400000);

  // Custom date
  const expCustom = computeExpiryDate('custom', '2026-11-15', now);
  assert.ok(expCustom);
  const dCustom = new Date(expCustom);
  assert.equal(dCustom.getFullYear(), 2026);
  assert.equal(dCustom.getMonth(), 10); // Nov
  assert.equal(dCustom.getDate(), 15);
  assert.equal(dCustom.getHours(), 23);
  assert.equal(dCustom.getMinutes(), 59);

  // Custom date beyond 365 days is clamped
  const farCustom = computeExpiryDate('custom', '2030-01-01', now);
  assert.ok(farCustom);
  const dFar = new Date(farCustom);
  assert.ok(dFar.getTime() <= now.getTime() + 365 * 86400000);
});
