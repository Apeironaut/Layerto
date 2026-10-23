import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { WorkflowDefinition, WorkflowNode } from '@layerto/types';
import { autoLayout, callBounds, connectionProblem, fromFlow, localIssues, nextNodeId, toFlow } from './graph.ts';
import { defaultConditionConfig, defaultForEachConfig, defaultModelConfig, newDefinition, upgradeDefinition } from './definition.ts';
import { costPerImage, formatRange } from './cost.ts';
import { buildPreview } from './outputPreview.ts';
import { defaultOutputConfig } from './definition.ts';

const pos = { x: 0, y: 0 };
const model = (id: string, slug = 'turtle-id'): WorkflowNode => ({ id, type: 'model', position: pos, config: defaultModelConfig(slug) });

function branching(): WorkflowDefinition {
  const def = newDefinition('turtle-id');
  def.nodes.push(
    { id: 'c_1', type: 'condition', position: pos, config: defaultConditionConfig() },
    model('m_2', 'bioclip'),
    { id: 'f_1', type: 'for_each', position: pos, config: { ...defaultForEachConfig(), max_items: 4 } },
    model('m_3', 'bioclip'),
  );
  def.edges.push(
    { id: 'a', source: 'm_1', target: 'c_1' },
    { id: 'b', source: 'c_1', target: 'm_2', source_handle: 'yes' },
    { id: 'c', source: 'm_2', target: 'output' },
    { id: 'd', source: 'm_1', target: 'f_1' },
    { id: 'e', source: 'f_1', target: 'm_3' },
    { id: 'f', source: 'm_3', target: 'output' },
  );
  return def;
}

test('new definition is valid and round-trips through the canvas format', () => {
  const def = newDefinition('turtle-id');
  assert.deepEqual(localIssues(def), { byNode: {}, general: [] });
  const { nodes, edges } = toFlow(def);
  assert.deepEqual(fromFlow(nodes, edges), def);
});

test('call bounds and cost match the server rules', () => {
  const def = branching();
  assert.deepEqual(callBounds(def), { min: 1, max: 1 + 1 + 4 });
  const prices = [
    { slug: 'turtle-id', price_usd: '0.002000' },
    { slug: 'bioclip', price_usd: '0.001000' },
  ] as Parameters<typeof costPerImage>[1];
  const cost = costPerImage(def, prices);
  assert.deepEqual(cost, { min: 2000, max: 2000 + 1000 + 4000 });
  assert.equal(formatRange(cost), '$0.002000–$0.007000');
});

test('connection rules', () => {
  const def = branching();
  const nodes = def.nodes;
  const edges = def.edges.map((e) => ({ ...e, sourceHandle: e.source_handle }));
  assert.match(connectionProblem(nodes, edges, { source: 'input', target: 'output' })!, /can't connect/);
  assert.match(connectionProblem(nodes, edges, { source: 'c_1', target: 'm_3' })!, /Yes or No|one incoming/);
  assert.match(connectionProblem(nodes, edges, { source: 'm_2', target: 'm_1' })!, /one incoming|loop/);
  assert.equal(connectionProblem([...nodes, model('m_9')], edges, { source: 'c_1', sourceHandle: 'no', target: 'm_9' }), null);
});

test('local issues point at the right step', () => {
  const def = newDefinition('turtle-id');
  def.edges = def.edges.filter((e) => e.target !== 'output');
  const issues = localIssues(def);
  assert.ok(issues.byNode.m_1?.some((m) => m.includes('Output')));
  assert.ok(issues.byNode.output?.length);
});

test('ids, layout and v1 upgrade', () => {
  assert.equal(nextNodeId('model', [{ id: 'm_1' }, { id: 'm_2' }]), 'm_3');
  const { nodes, edges } = toFlow(branching());
  const laid = autoLayout(nodes, edges);
  const x = Object.fromEntries(laid.map((n) => [n.id, n.position.x]));
  assert.ok(x.input < x.m_1 && x.m_1 < x.c_1 && x.c_1 < x.m_2 && x.m_2 <= x.output);

  const v2 = upgradeDefinition({
    version: 1,
    nodes: [
      { id: 'input', type: 'input', position: pos, config: { mode: 'batch', max_images: 2 } },
      { id: 'm_1', type: 'model', position: pos, config: { model_slug: 'bioclip', min_confidence: 0.3 } },
      { id: 'output', type: 'output', position: pos, config: { fields: ['label', 'model'], merge_models: false, format: 'csv' } },
    ],
    edges: [],
  });
  const out = v2.nodes.find((n) => n.type === 'output')!;
  assert.equal(out.type === 'output' && out.config.layout, 'by_step');
  assert.deepEqual(out.type === 'output' && out.config.fields, ['label', 'step']);
});

test('preview follows fields, renames and formats', () => {
  const cfg = { ...defaultOutputConfig(), fields: ['confidence', 'label'] as const, rename: { label: 'species' }, confidence_format: 'percent' as const, decimals: 1 };
  const json = JSON.parse(buildPreview({ ...cfg, fields: [...cfg.fields] }, [{ name: 'Classify', inLoop: false }]));
  assert.deepEqual(Object.keys(json.images[0].results[0]), ['species', 'confidence']);
  assert.equal(json.images[0].results[0].confidence, 92.3);
  const csv = buildPreview({ ...defaultOutputConfig(), format: 'csv', fields: ['label', 'bbox'], bbox_format: 'xyxy' }, [{ name: 'A', inLoop: false }]);
  assert.equal(csv.split('\n')[0], 'image_index,label,bbox_x1,bbox_y1,bbox_x2,bbox_y2');
});
