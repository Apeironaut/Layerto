import type { NodeProps } from '@xyflow/react';
import type { OutputConfig, WorkflowConditionConfig, WorkflowForEachConfig, WorkflowInputConfig, WorkflowModelConfig } from '@layerto/types';
import { Chip, usd } from '@layerto/ui';
import type { FlowNode } from '../../../lib/graph';
import { FIELD_META, LAYOUTS } from '../../../lib/definition';
import { useEditorActions } from '../EditorContext';
import { NodeShell } from './NodeShell';

type P = NodeProps<FlowNode>;

const pct = (n: number) => `${Math.round(n * 100)}%`;

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-muted">{k}</span>
      <span className="font-medium truncate">{v}</span>
    </div>
  );
}

export function InputNode({ id, data, selected }: P) {
  const c = data.config as WorkflowInputConfig;
  return (
    <NodeShell id={id} type="input" title={c.mode === 'single' ? 'One image' : 'Batch of images'} selected={selected} issues={data.issues} hasTarget={false} sources={[{}]}>
      <Row k="Images per run" v={c.mode === 'single' ? '1' : `up to ${c.max_images}`} />
      <Row k="Formats" v="JPG, PNG, WebP" />
    </NodeShell>
  );
}

export function ModelNode({ id, data, selected }: P) {
  const c = data.config as WorkflowModelConfig;
  const { modelBySlug } = useEditorActions();
  const model = modelBySlug.get(c.model_slug);
  const title = c.label || model?.name || c.model_slug || 'Choose a model';
  return (
    <NodeShell
      id={id}
      type="model"
      title={title}
      subtitle={c.model_slug ? <span className="font-mono">{c.model_slug}</span> : 'No model selected'}
      selected={selected}
      issues={data.issues}
      hasTarget
      sources={[{}]}
      footer={
        <div className="flex flex-wrap gap-1.5">
          {model && <Chip variant="brand">{usd(model.price_usd)} / call</Chip>}
          {c.min_confidence > 0 && <Chip variant="neutral">≥ {pct(c.min_confidence)}</Chip>}
        </div>
      }
    />
  );
}

const RULE_TEXT: Record<WorkflowConditionConfig['rule'], (c: WorkflowConditionConfig) => string> = {
  has_label: (c) => `Found ${c.labels.length ? c.labels.join(', ') : 'anything'}`,
  count_at_least: (c) => `${c.count}+ × ${c.labels.length ? c.labels.join(', ') : 'any label'}`,
  no_predictions: (c) => `Nothing ${c.labels.length ? `labelled ${c.labels.join(', ')}` : 'found'}`,
};

export function ConditionNode({ id, data, selected }: P) {
  const c = data.config as WorkflowConditionConfig;
  return (
    <NodeShell
      id={id}
      type="condition"
      title={RULE_TEXT[c.rule](c)}
      subtitle={c.min_confidence > 0 ? `Counting predictions ≥ ${pct(c.min_confidence)}` : 'Counting every prediction'}
      selected={selected}
      issues={data.issues}
      hasTarget
      sources={[
        { id: 'yes', label: 'Yes', tone: 'yes', top: 38 },
        { id: 'no', label: 'No', tone: 'no', top: 72 },
      ]}
    />
  );
}

export function ForEachNode({ id, data, selected }: P) {
  const c = data.config as WorkflowForEachConfig;
  return (
    <NodeShell
      id={id}
      type="for_each"
      title={c.labels.length ? `Each ${c.labels.join(', ')}` : 'Each detected object'}
      subtitle="Crops each object and runs the next step on it"
      selected={selected}
      issues={data.issues}
      hasTarget
      sources={[{}]}
    >
      <Row k="Max objects" v={String(c.max_items)} />
      <Row k="Min confidence" v={pct(c.min_confidence)} />
    </NodeShell>
  );
}

export function OutputNode({ id, data, selected }: P) {
  const c = data.config as OutputConfig;
  const layout = LAYOUTS.find((l) => l.value === c.layout)?.label ?? c.layout;
  return (
    <NodeShell
      id={id}
      type="output"
      title={c.format === 'csv' ? 'CSV file' : `JSON · ${layout}`}
      selected={selected}
      issues={data.issues}
      hasTarget
      sources={[]}
      footer={
        <div className="flex flex-wrap gap-1">
          {c.fields.slice(0, 5).map((f) => (
            <span key={f} className="px-1.5 py-0.5 rounded-control bg-page border border-line text-[11px]">
              {c.rename[f] || FIELD_META[f].label}
            </span>
          ))}
          {c.fields.length > 5 && <span className="px-1.5 py-0.5 text-[11px] text-muted">+{c.fields.length - 5}</span>}
        </div>
      }
    />
  );
}

export const NODE_TYPES = {
  input: InputNode,
  model: ModelNode,
  condition: ConditionNode,
  for_each: ForEachNode,
  output: OutputNode,
};
