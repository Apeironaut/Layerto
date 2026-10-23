import { test } from 'node:test';
import assert from 'node:assert/strict';
import { estimateMicro, formatMicro, toMicro } from './money.ts';

test('parses API prices exactly', () => {
  assert.equal(toMicro('0.001500'), 1500);
  assert.equal(toMicro('$2.5'), 2_500_000);
  assert.equal(toMicro('junk'), 0);
});

test('estimates after free calls, never negative', () => {
  assert.deepEqual(estimateMicro(1000, 1500, 50), { paidCalls: 950, micro: 1_425_000 });
  assert.deepEqual(estimateMicro(30, 1500, 50), { paidCalls: 0, micro: 0 });
});

test('formats exactly', () => {
  assert.equal(formatMicro(1_425_000), '$1.425000');
  assert.equal(formatMicro(150_000_000_000), '$150,000.000000');
});
