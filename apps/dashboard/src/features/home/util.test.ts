import { test } from 'node:test';
import assert from 'node:assert/strict';
import { timeAgo } from './util.ts';

test('timeAgo', () => {
  const now = Date.parse('2026-10-22T12:00:00Z');
  assert.equal(timeAgo('2026-10-22T11:59:30Z', now), 'just now');
  assert.equal(timeAgo('2026-10-22T11:50:00Z', now), '10m');
  assert.equal(timeAgo('2026-10-22T09:00:00Z', now), '3h');
  assert.equal(timeAgo('2026-10-20T12:00:00Z', now), '2d');
});
