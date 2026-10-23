import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { PublicModelItem } from '@layerto/types';
import { costPerImage, formatMicro, formatRange, toMicro } from './cost.ts';
import { findTemplate } from './templates.ts';

const models = [
  { slug: 'turtle-id', price_usd: '0.002000' },
  { slug: 'bioclip', price_usd: '0.001000' },
] as PublicModelItem[];

test('toMicro parses API money strings', () => {
  assert.equal(toMicro('0.001500'), 1500);
  assert.equal(toMicro('$1.5'), 1_500_000);
  assert.equal(toMicro('2'), 2_000_000);
  assert.equal(toMicro('abc'), 0);
});

test('formatMicro and formatRange', () => {
  assert.equal(formatMicro(1500), '$0.001500');
  assert.equal(formatMicro(1_234_000_000), '$1,234.000000');
  assert.equal(formatRange({ min: 10, max: 10 }), '$0.000010');
  assert.equal(formatRange({ min: 10, max: 20 }), '$0.000010–$0.000020');
});

test('a single model costs exactly its price', () => {
  const def = findTemplate('single')!.build(models);
  const r = costPerImage(def, models);
  assert.equal(r.min, r.max);
  assert.ok(r.min === 2000 || r.min === 1000);
});

test('for each makes the cost a range', () => {
  const def = findTemplate('detect-classify')!.build(models);
  const r = costPerImage(def, models);
  assert.ok(r.max > r.min, `${r.min} < ${r.max}`);
});
