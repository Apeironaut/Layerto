import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { WorkflowRunResponse } from '@layerto/types';
import { boxesForImages, toPixelBox } from './runView.ts';
import { defaultOutputConfig } from './definition.ts';

test('box formats convert back to pixels', () => {
  const size = { width: 200, height: 100 };
  assert.deepEqual(toPixelBox([10, 20, 30, 40], 'xywh', size), [10, 20, 30, 40]);
  assert.deepEqual(toPixelBox([10, 20, 40, 60], 'xyxy', size), [10, 20, 30, 40]);
  assert.deepEqual(toPixelBox([25, 40, 30, 40], 'center_xywh', size), [10, 20, 30, 40]);
  assert.deepEqual(toPixelBox([0.05, 0.2, 0.15, 0.4], 'normalized_xywh', size), [10, 20, 30, 40]);
  assert.equal(toPixelBox('nope', 'xywh', size), null);
});

test('reads renamed fields and percent confidence from any layout', () => {
  const cfg = { ...defaultOutputConfig(), rename: { label: 'species', bbox: 'box' }, confidence_format: 'percent' as const, layout: 'by_step' as const };
  const res: WorkflowRunResponse = {
    workflow_id: 'w',
    run_id: 'r',
    total_charge_usd: '0',
    images: [{ index: 0, steps: { Detect: [{ species: 'turtle', confidence: 91, box: [1, 2, 3, 4] }] } }],
  };
  const boxes = boxesForImages(res, cfg, [{ width: 10, height: 10 }]);
  assert.deepEqual(boxes.get(0), [{ label: 'turtle', confidence: 0.91, bbox: [1, 2, 3, 4] }]);
  const flat = boxesForImages({ ...res, images: undefined, results: [{ image_index: 1, label: 'x', confidence: 0.5, bbox: [0, 0, 1, 1] }] }, defaultOutputConfig(), [{ width: 1, height: 1 }, { width: 1, height: 1 }]);
  assert.equal(flat.get(1)?.length, 1);
});
