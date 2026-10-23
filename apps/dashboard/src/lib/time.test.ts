import test from 'node:test';
import assert from 'node:assert/strict';
import { formatRelativeTime } from './time.ts';

test('formatRelativeTime returns Never when missing or invalid', () => {
  assert.equal(formatRelativeTime(null), 'Never');
  assert.equal(formatRelativeTime(undefined), 'Never');
  assert.equal(formatRelativeTime(''), 'Never');
  assert.equal(formatRelativeTime('invalid-date'), 'Never');
});

test('formatRelativeTime handles seconds, minutes, hours, days', () => {
  const base = new Date('2026-10-21T12:00:00Z');

  // 10s ago
  assert.equal(formatRelativeTime('2026-10-21T11:59:50Z', base), 'just now');

  // 3 minutes ago
  assert.equal(formatRelativeTime('2026-10-21T11:57:00Z', base), '3 minutes ago');

  // 1 hour ago
  assert.equal(formatRelativeTime('2026-10-21T11:00:00Z', base), '1 hour ago');

  // 3 hours ago
  assert.equal(formatRelativeTime('2026-10-21T09:00:00Z', base), '3 hours ago');

  // 1 day ago
  assert.equal(formatRelativeTime('2026-10-20T12:00:00Z', base), '1 day ago');

  // 5 days ago
  assert.equal(formatRelativeTime('2026-10-16T12:00:00Z', base), '5 days ago');

  // 2 months ago
  assert.equal(formatRelativeTime('2026-08-21T12:00:00Z', base), '2 months ago');
});
