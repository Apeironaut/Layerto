import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildPreview, formatBBox, formatConfidence } from './outputPreview.ts';
import { defaultOutputConfig } from './definition.ts';

test('bbox formats', () => {
  const b: [number, number, number, number] = [10, 20, 30, 40];
  assert.deepEqual(formatBBox(b, 'xywh'), [10, 20, 30, 40]);
  assert.deepEqual(formatBBox(b, 'xyxy'), [10, 20, 40, 60]);
  assert.deepEqual(formatBBox(b, 'center_xywh'), [25, 40, 30, 40]);
  assert.deepEqual(formatBBox(b, 'normalized_xywh', { width: 100, height: 200 }), [0.1, 0.1, 0.3, 0.2]);
});

test('confidence as percent with decimals', () => {
  const cfg = { ...defaultOutputConfig(), confidence_format: 'percent' as const, decimals: 1 };
  assert.equal(formatConfidence(0.92345, cfg), 92.3);
});

test('JSON preview applies renames and layout', () => {
  const cfg = { ...defaultOutputConfig(), rename: { label: 'species' }, layout: 'flat' as const };
  const out = JSON.parse(buildPreview(cfg, [{ name: 'Detect', inLoop: false }]));
  assert.ok(Array.isArray(out.results));
  assert.ok('species' in out.results[0]);
  assert.ok(!('label' in out.results[0]));
});

test('CSV preview has a header and one row per step', () => {
  const cfg = { ...defaultOutputConfig(), format: 'csv' as const };
  const lines = buildPreview(cfg, [{ name: 'a', inLoop: false }, { name: 'b', inLoop: true }]).split('\n');
  assert.equal(lines.length, 3);
  assert.ok(lines[0].startsWith('image_index'));
});
