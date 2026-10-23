import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatMicro, parseUsdToMicro } from './usdAmount.ts';

test('parses whole and fractional dollars exactly', () => {
  assert.equal(parseUsdToMicro('5'), 5_000_000);
  assert.equal(parseUsdToMicro(' 0.25 '), 250_000);
  assert.equal(parseUsdToMicro('0.000150'), 150);
  assert.equal(parseUsdToMicro('0.1'), 100_000);
});

test('rejects zero, negatives, junk and more than 6 decimals', () => {
  for (const bad of ['', '0', '0.000000', '-1', '1.2.3', 'abc', '1.0000001', '$5', '1e3']) {
    assert.equal(parseUsdToMicro(bad), null, bad);
  }
});

test('formats micro-USD exactly', () => {
  assert.equal(formatMicro(150), '$0.000150');
  assert.equal(formatMicro(1_234_500_000), '$1,234.500000');
});
