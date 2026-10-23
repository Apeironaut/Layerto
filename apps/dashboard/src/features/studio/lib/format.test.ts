import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bytes, fromNow, parseClasses, pct } from './format.ts';

test('formats sizes', () => {
  assert.equal(bytes(500), '500 B');
  assert.equal(bytes(2048), '2 KB');
  assert.equal(bytes(5 * 1024 * 1024), '5.0 MB');
});

test('formats mAP', () => {
  assert.equal(pct(0.4955), '49.5%');
  assert.equal(pct(undefined), '—');
});

test('parses class lists', () => {
  assert.deepEqual(parseClasses('cat, dog\n bird ,cat,,'), ['cat', 'dog', 'bird']);
});

test('describes time left', () => {
  const now = Date.parse('2026-01-01T00:00:00Z');
  assert.equal(fromNow('2026-01-04T00:00:00Z', now), 'in 3 days');
  assert.equal(fromNow('2026-01-01T05:00:00Z', now), 'in 5 h');
  assert.equal(fromNow('2025-12-31T00:00:00Z', now), 'now');
});
