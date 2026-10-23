import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  calculatePieSlices,
  describeDonutArc,
  formatEndpointName,
  CHART_PALETTE,
} from './chartCalculations.ts';

test('formatEndpointName maps known raw codes to friendly names', () => {
  const auto = formatEndpointName('vision_auto');
  assert.equal(auto.name, 'Auto-Routing Vision API');
  assert.equal(auto.path, '/v1/vision/auto');

  const model = formatEndpointName('vision_model');
  assert.equal(model.name, 'Direct Model Vision API');
  assert.equal(model.path, '/v1/vision/{model}');

  const wf = formatEndpointName('workflow_run');
  assert.equal(wf.name, 'Workflow Execution API');
  assert.equal(wf.path, '/v1/workflows/{id}/run');

  const fallback = formatEndpointName('unknown_custom');
  assert.equal(fallback.name, 'unknown_custom');
});

test('calculatePieSlices returns empty array when empty or total is zero', () => {
  assert.deepEqual(calculatePieSlices([]), []);
  assert.deepEqual(calculatePieSlices([{ label: 'empty', value: 0 }]), []);
});

test('calculatePieSlices computes exact 100% single slice', () => {
  const slices = calculatePieSlices([{ label: 'turtle-id', value: 100 }]);
  assert.equal(slices.length, 1);
  assert.equal(slices[0].percentage, 100);
  assert.equal(slices[0].color, CHART_PALETTE[0]);
  assert.ok(slices[0].path.startsWith('M'));
});

test('calculatePieSlices computes proportional angles and percentages for multiple items', () => {
  const items = [
    { label: 'turtle-id', value: 50 },
    { label: 'bioclip', value: 50 },
  ];
  const slices = calculatePieSlices(items);
  assert.equal(slices.length, 2);
  assert.equal(slices[0].percentage, 50);
  assert.equal(slices[1].percentage, 50);

  // First starts at 0, ends at PI (180deg)
  assert.ok(Math.abs(slices[0].startAngle - 0) < 0.001);
  assert.ok(Math.abs(slices[0].endAngle - Math.PI) < 0.001);

  // Second starts at PI, ends at 2*PI (360deg)
  assert.ok(Math.abs(slices[1].startAngle - Math.PI) < 0.001);
  assert.ok(Math.abs(slices[1].endAngle - 2 * Math.PI) < 0.001);
});

test('describeDonutArc generates valid SVG path with Move and Arc commands', () => {
  const path = describeDonutArc(100, 100, 80, 40, 0, Math.PI / 2);
  assert.ok(path.includes('M'));
  assert.ok(path.includes('A'));
  assert.ok(path.includes('Z'));
});
