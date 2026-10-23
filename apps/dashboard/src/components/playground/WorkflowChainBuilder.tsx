import { useState } from 'react';
import type { SelectOption } from '@layerto/ui';
import { Button, Card, Chip, Icon, Input, Select, useNotify } from '@layerto/ui';
import type { ChainStepConfig } from '../../lib/playgroundLogic';
import { serializeChainToWorkflow } from '../../lib/playgroundLogic';

export interface WorkflowChainBuilderProps {
  modelOptions: SelectOption[];
  steps: ChainStepConfig[];
  onStepsChange: (steps: ChainStepConfig[]) => void;
}

export function WorkflowChainBuilder({
  modelOptions,
  steps,
  onStepsChange,
}: WorkflowChainBuilderProps) {
  const notify = useNotify();
  const [showSerialized, setShowSerialized] = useState(false);

  // Filter out 'auto' for explicit workflow model nodes
  const concreteModelOptions = modelOptions.filter((opt) => opt.value !== 'auto');

  const addStep = () => {
    if (steps.length >= 6) {
      notify('Playground chain supports up to 6 models.', 'error');
      return;
    }
    const defaultModel = concreteModelOptions[0]?.value ?? 'turtle-id';
    const next: ChainStepConfig = {
      id: `step_${Date.now()}_${steps.length + 1}`,
      model_slug: defaultModel,
      min_confidence: 0.3,
      prompt: '',
    };
    onStepsChange([...steps, next]);
  };

  const removeStep = (index: number) => {
    if (steps.length <= 1) {
      notify('A workflow chain must have at least one model step.', 'error');
      return;
    }
    onStepsChange(steps.filter((_, i) => i !== index));
  };

  const moveStep = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= steps.length) return;
    const next = [...steps];
    const temp = next[index];
    next[index] = next[targetIndex];
    next[targetIndex] = temp;
    onStepsChange(next);
  };

  const updateStep = (index: number, updates: Partial<ChainStepConfig>) => {
    const next = steps.map((s, i) => (i === index ? { ...s, ...updates } : s));
    onStepsChange(next);
  };

  const serializedWorkflow = serializeChainToWorkflow(steps);
  const serializedJson = JSON.stringify(serializedWorkflow, null, 2);

  const copyJson = async () => {
    try {
      await navigator.clipboard.writeText(serializedJson);
      notify('Serialized Workflow JSON copied to clipboard', 'success');
    } catch {
      notify('Failed to copy to clipboard', 'error');
    }
  };

  return (
    <Card
      className="border-line/80 shadow-l2 space-y-4"
      title="Workflow Chain Pipeline"
      actions={
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="ghost"
            icon="copy"
            onClick={() => setShowSerialized((v) => !v)}
          >
            {showSerialized ? 'Hide Serialized DAG' : 'Serialize Workflow'}
          </Button>
          <Button size="sm" variant="secondary" icon="plus" onClick={addStep} disabled={steps.length >= 6}>
            Add Step
          </Button>
        </div>
      }
    >
      <p className="text-xs text-muted leading-relaxed">
        Chain multiple vision models in serial execution. When you run, each model analyses the image in order, letting you explore multi-model workflows before deploying them.
      </p>

      {/* Steps List */}
      <div className="space-y-3">
        {steps.map((step, idx) => (
          <div
            key={step.id}
            className="p-3.5 rounded-control border border-line bg-page space-y-3 transition-colors hover:border-crimson-border/60"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-crimson text-white text-xs font-bold flex items-center justify-center font-mono">
                  {idx + 1}
                </span>
                <span className="text-xs font-semibold uppercase tracking-wider text-ink">
                  Step {idx + 1} Node
                </span>
                <Chip variant="neutral">Model Node</Chip>
              </div>

              {/* Step Controls: Move Up/Down, Remove */}
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  title="Move step up"
                  disabled={idx === 0}
                  onClick={() => moveStep(idx, 'up')}
                  className="p-1 rounded text-muted hover:text-ink disabled:opacity-30 disabled:pointer-events-none"
                >
                  <Icon name="arrowDown" className="w-4 h-4 rotate-180" />
                </button>
                <button
                  type="button"
                  title="Move step down"
                  disabled={idx === steps.length - 1}
                  onClick={() => moveStep(idx, 'down')}
                  className="p-1 rounded text-muted hover:text-ink disabled:opacity-30 disabled:pointer-events-none"
                >
                  <Icon name="arrowDown" className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  title="Remove step"
                  disabled={steps.length <= 1}
                  onClick={() => removeStep(idx)}
                  className="p-1 rounded text-muted hover:text-crimson disabled:opacity-30 disabled:pointer-events-none"
                >
                  <Icon name="close" className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Select
                label="Model"
                options={concreteModelOptions}
                value={step.model_slug}
                onChange={(e) => updateStep(idx, { model_slug: e.target.value })}
              />
              <Input
                label="Step Prompt / Label (optional)"
                placeholder="e.g. identify carapace"
                value={step.prompt}
                onChange={(e) => updateStep(idx, { prompt: e.target.value })}
              />
            </div>

            <div>
              <div className="flex justify-between text-xs text-muted mb-1">
                <span>Minimum Confidence Filter</span>
                <span className="font-mono tabular-nums font-semibold text-ink">
                  {Math.round(step.min_confidence * 100)}%
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={step.min_confidence}
                onChange={(e) => updateStep(idx, { min_confidence: Number(e.target.value) })}
                className="w-full accent-crimson cursor-grab active:cursor-grabbing"
              />
            </div>
          </div>
        ))}
      </div>

      {/* Serialized Workflow JSON Inspector */}
      {showSerialized && (
        <div className="p-3.5 rounded-control border border-crimson-border/60 bg-surface-muted space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-ink font-mono">
              Serialized Workflow DAG ({serializedWorkflow.nodes.length} nodes, {serializedWorkflow.edges.length} edges)
            </span>
            <Button size="sm" variant="secondary" icon="copy" onClick={copyJson}>
              Copy JSON
            </Button>
          </div>
          <p className="text-[11px] text-muted">
            This pipeline is valid for Layerto&apos;s workflow execution engine. You can copy this definition directly into a production workflow.
          </p>
          <pre className="p-3 rounded bg-page border border-line text-[11px] font-mono text-ink overflow-x-auto max-h-56">
            {serializedJson}
          </pre>
        </div>
      )}
    </Card>
  );
}
