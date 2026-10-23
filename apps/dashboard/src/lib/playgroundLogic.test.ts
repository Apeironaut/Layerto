import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateGraphCoordinates,
  formatMetricValue,
  parseVersionMetrics,
  serializeChainToWorkflow,
} from './playgroundLogic.ts';

test('serializeChainToWorkflow creates valid DAG for empty steps', () => {
  const def = serializeChainToWorkflow([]);
  assert.equal(def.version, 2);
  assert.equal(def.nodes.length, 2);
  assert.equal(def.nodes[0].type, 'input');
  assert.equal(def.nodes[1].type, 'output');
  assert.equal(def.edges.length, 1);
  assert.equal(def.edges[0].source, 'node_input_0');
  assert.equal(def.edges[0].target, 'node_output_1');
});

test('serializeChainToWorkflow serializes multi-step model chain', () => {
  const steps = [
    { id: '1', model_slug: 'turtle-id', min_confidence: 0.5, prompt: 'sea turtle' },
    { id: '2', model_slug: 'bioclip', min_confidence: 0.25, prompt: '' },
  ];

  const def = serializeChainToWorkflow(steps);
  assert.equal(def.nodes.length, 4); // Input + 2 Models + Output
  assert.equal(def.nodes[0].type, 'input');
  assert.equal(def.nodes[1].type, 'model');
  assert.equal(def.nodes[2].type, 'model');
  assert.equal(def.nodes[3].type, 'output');

  // Verify sequential edges
  assert.equal(def.edges.length, 3);
  assert.equal(def.edges[0].source, 'node_input_0');
  assert.equal(def.edges[0].target, 'node_model_1');
  assert.equal(def.edges[1].source, 'node_model_1');
  assert.equal(def.edges[1].target, 'node_model_2');
  assert.equal(def.edges[2].source, 'node_model_2');
  assert.equal(def.edges[2].target, 'node_output_3');
});

test('formatMetricValue formats percentages and latencies', () => {
  assert.equal(formatMetricValue('map50', 0.942), '94.2%');
  assert.equal(formatMetricValue('top1_acc', 0.887), '88.7%');
  assert.equal(formatMetricValue('latency_ms', 182), '182 ms');
  assert.equal(formatMetricValue('parameters', '48.2M'), '48.2M');
});

test('parseVersionMetrics sorts versions chronologically', () => {
  const versions = [
    {
      version: 'v2',
      released_at: '2026-06-15',
      status: 'stable',
      metrics: { map50: 0.915 },
    },
    {
      version: 'v1',
      released_at: '2026-01-20',
      status: 'legacy',
      metrics: { map50: 0.872 },
    },
    {
      version: 'v3',
      released_at: '2026-10-01',
      status: 'latest',
      metrics: { map50: 0.942 },
    },
  ];

  const points = parseVersionMetrics(versions);
  assert.equal(points.length, 3);
  assert.equal(points[0].version, 'v1');
  assert.equal(points[1].version, 'v2');
  assert.equal(points[2].version, 'v3');
  assert.equal(points[2].formattedValue, '94.2%');
});

test('calculateGraphCoordinates produces valid SVG path and coords', () => {
  const points = [
    { version: 'v1', date: '2026-01-20', value: 0.872, formattedValue: '87.2%', status: 'legacy' },
    { version: 'v2', date: '2026-06-15', value: 0.915, formattedValue: '91.5%', status: 'stable' },
    { version: 'v3', date: '2026-10-01', value: 0.942, formattedValue: '94.2%', status: 'latest' },
  ];

  const layout = calculateGraphCoordinates(points, 300, 100, 20);
  assert.ok(layout.pathD.startsWith('M '));
  assert.ok(layout.areaD.includes(' Z'));
  assert.equal(layout.coords.length, 3);
  // Verify chronological x increase
  assert.ok(layout.coords[0].x < layout.coords[1].x);
  assert.ok(layout.coords[1].x < layout.coords[2].x);
});
