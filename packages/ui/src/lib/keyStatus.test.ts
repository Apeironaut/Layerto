import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatExpiryDisplay, getKeyStatus, isKeyExpired, isKeyExpiringSoon, timeLeft } from './keyStatus.ts';

const now = new Date('2026-10-21T12:00:00Z');
const at = (ms: number) => new Date(now.getTime() + ms).toISOString();
const H = 3_600_000;
const D = 24 * H;

test('isKeyExpired', () => {
  assert.equal(isKeyExpired(null, now), false);
  assert.equal(isKeyExpired(at(-1000), now), true);
  assert.equal(isKeyExpired(at(D), now), false);
});

test('isKeyExpiringSoon', () => {
  assert.equal(isKeyExpiringSoon(null, now), false);
  assert.equal(isKeyExpiringSoon(at(3 * D), now), true);
  assert.equal(isKeyExpiringSoon(at(10 * D), now), false);
  assert.equal(isKeyExpiringSoon(at(-D), now), false);
});

test('getKeyStatus follows time', () => {
  assert.deepEqual(getKeyStatus({ revoked_at: at(-D), expires_at: null }, now), { label: 'Revoked', variant: 'danger' });
  assert.deepEqual(getKeyStatus({ expires_at: at(-D) }, now), { label: 'Expired', variant: 'danger' });
  assert.deepEqual(getKeyStatus({ expires_at: at(2 * D) }, now), { label: 'Expires soon', variant: 'pending' });
  assert.deepEqual(getKeyStatus({ expires_at: at(30 * D) }, now), { label: 'Active', variant: 'active' });
  assert.deepEqual(getKeyStatus({ expires_at: null }, now), { label: 'Active', variant: 'active' });
  // The same key flips to Expired once its time passes.
  const key = { expires_at: at(H) };
  assert.equal(getKeyStatus(key, now).label, 'Expires soon');
  assert.equal(getKeyStatus(key, new Date(now.getTime() + 2 * H)).label, 'Expired');
});

test('formatExpiryDisplay', () => {
  assert.equal(formatExpiryDisplay(null), 'Never');
  assert.equal(formatExpiryDisplay('bad'), 'Never');
  assert.match(formatExpiryDisplay('2026-12-31T12:00:00Z'), /2026/);
});

test('timeLeft counts down', () => {
  assert.equal(timeLeft(null, now), 'No expiry');
  assert.equal(timeLeft(at(10 * D), now), '10d left');
  assert.equal(timeLeft(at(6 * D + 23 * H), now), '6d 23h left');
  assert.equal(timeLeft(at(3 * H + 12 * 60_000), now), '3h 12m left');
  assert.equal(timeLeft(at(30_000), now), '1m left');
  assert.equal(timeLeft(at(-2 * H), now), 'Expired 2h ago');
});
