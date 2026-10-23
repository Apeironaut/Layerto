import { test } from 'node:test';
import assert from 'node:assert/strict';
import { usd } from './format.ts';

test('usd trims trailing zeros but keeps cents', () => {
  assert.equal(usd('0.002000'), '$0.002');
  assert.equal(usd('1.000000'), '$1.00');
  assert.equal(usd('15.5'), '$15.50');
  assert.equal(usd('0.000150'), '$0.00015');
  assert.equal(usd('12'), '$12');
  assert.equal(usd('-0.500000'), '-$0.50');
  assert.equal(usd('$3.00'), '$3.00');
  assert.equal(usd(''), '$0.00');
});
