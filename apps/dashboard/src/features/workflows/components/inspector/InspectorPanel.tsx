import type { OutputConfig, PublicModelItem, WorkflowConditionConfig, WorkflowDefinition, WorkflowForEachConfig, WorkflowInputConfig, WorkflowModelConfig } from '@layerto/types';
import { Icon, cn } from '@layerto/ui';
import type { EditorIssues } from '../../hooks/useWorkflowEditor';
import type { FlowNode, StepConfig } from '../../lib/graph';
import { STEP_META } from '../../lib/definition';
import type { PreviewStep } from '../../lib/outputPreview';
import { InputSettings } from './InputSettings';
import { ModelSettings } from './ModelSettings';
import { ConditionSettings } from './ConditionSettings';
import { ForEachSettings } from './ForEachSettings';
import { OutputSettings } from './OutputSettings';
import { WorkflowOverview } from './WorkflowOverview';

export interface InspectorPanelProps {
  node: FlowNode | null;
  definition: WorkflowDefinition;
  models: PublicModelItem[];
  favorites: string[];
  recent: string[];
  onToggleFavorite: (slug: string) => void;
  onModelUsed: (slug: string) => void;
  issues: EditorIssues;
  name: string;
  description: string;
  onName: (v: string) => void;
  onDescription: (v: string) => void;
  onChange: (nodeId: string, patch: Partial<StepConfig>) => void;
  onDuplicate: (nodeId: string) => void;
  onDelete: (nodeId: string) => void;
  onClose: () => void;
  onFocus: (nodeId: string) => void;
}

/** Model steps wired into Output, with whether they run inside a loop (for the preview). */
function previewSteps(def: WorkflowDefinition, models: PublicModelItem[]): PreviewStep[] {
  const loopDescendants = new Set<string>();
  const visit = (id: string) => {
    for (const e of def.edges.filter((x) => x.source === id)) {
      if (!loopDescendants.has(e.target)) {
        loopDescendants.add(e.target);
        visit(e.target);
      }
    }
  };
  def.nodes.filter((n) => n.type === 'for_each').forEach((n) => visit(n.id));
  return def.edges
    .filter((e) => e.target === 'output')
    .map((e) => def.nodes.find((n) => n.id === e.source))
    .filter((n): n is Extract<WorkflowDefinition['nodes'][number], { type: 'model' }> => n?.type === 'model')
    .map((n) => ({ name: n.config.label || models.find((m) => m.slug === n.config.model_slug)?.name || n.id, inLoop: loopDescendants.has(n.id) }));
}

export function InspectorPanel(p: InspectorPanelProps) {
  const { node } = p;
  const nameOf = (id: string) => {
    const n = p.definition.nodes.find((x) => x.id === id);
    if (!n) return id;
    if (n.type === 'model') return n.config.label || p.models.find((m) => m.slug === n.config.model_slug)?.name || id;
    return STEP_META[n.type].label;
  };
  const meta = node ? STEP_META[node.type!] : null;
  const fixed = node?.type === 'input' || node?.type === 'output';
  const change = (patch: Partial<StepConfig>) => node && p.onChange(node.id, patch);

  return (
    <aside className="w-[360px] shrink-0 border-l border-line bg-card flex flex-col min-h-0" aria-label={node ? `${meta!.label} settings` : 'Workflow settings'}>
      <header className="flex items-center gap-3 px-4 py-3 border-b border-line">
        {node && meta ? (
          <>
            <span className={cn('grid place-items-center h-9 w-9 rounded-control text-white', node.type === 'model' ? 'bg-crimson dark:bg-crimson-fill' : node.type === 'condition' ? 'bg-amber-500' : node.type === 'for_each' ? 'bg-emerald-600' : 'bg-ink text-page')}>
              <Icon name={meta.icon} size={18} />
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="font-bold truncate">{nameOf(node.id)}</h2>
              <p className="text-xs text-muted truncate">{meta.description}</p>
            </div>
            {!fixed && (
              <>
                <button type="button" onClick={() => p.onDuplicate(node.id)} title="Duplicate (Ctrl+D)" aria-label="Duplicate step" className="p-2 rounded-control text-muted hover:text-ink hover:bg-page cursor-pointer">
                  <Icon name="duplicate" size={17} />
                </button>
                <button type="button" onClick={() => p.onDelete(node.id)} title="Delete (Del)" aria-label="Delete step" className="p-2 rounded-control text-muted hover:text-crimson hover:bg-crimson-tint cursor-pointer">
                  <Icon name="trash" size={17} />
                </button>
              </>
            )}
            <button type="button" onClick={p.onClose} aria-label="Close settings" className="p-2 rounded-control text-muted hover:text-ink hover:bg-page cursor-pointer">
              <Icon name="close" size={17} />
            </button>
          </>
        ) : (
          <>
            <span className="grid place-items-center h-9 w-9 rounded-control bg-page border border-line">
              <Icon name="settings" size={18} />
            </span>
            <div>
              <h2 className="font-bold">Workflow</h2>
              <p className="text-xs text-muted">Select a step to change its settings.</p>
            </div>
          </>
        )}
      </header>

      <div className="flex-1 overflow-y-auto p-4">
        {node && node.data.issues.length > 0 && (
          <ul className="mb-4 space-y-1.5" aria-label="Problems with this step">
            {node.data.issues.map((m) => (
              <li key={m} className="flex gap-2 rounded-control bg-crimson-tint px-3 py-2 text-sm text-crimson">
                <Icon name="alert" size={16} className="shrink-0 mt-0.5" /> {m}
              </li>
            ))}
          </ul>
        )}
        {!node && (
          <WorkflowOverview
            name={p.name}
            description={p.description}
            onName={p.onName}
            onDescription={p.onDescription}
            definition={p.definition}
            models={p.models}
            issues={p.issues}
            nameOf={nameOf}
            onFocus={p.onFocus}
          />
        )}
        {node?.type === 'input' && <InputSettings config={node.data.config as WorkflowInputConfig} onChange={change} />}
        {node?.type === 'model' && (
          <ModelSettings
            key={node.id}
            config={node.data.config as WorkflowModelConfig}
            models={p.models}
            favorites={p.favorites}
            recent={p.recent}
            onToggleFavorite={p.onToggleFavorite}
            onModelUsed={p.onModelUsed}
            onChange={change}
          />
        )}
        {node?.type === 'condition' && <ConditionSettings config={node.data.config as WorkflowConditionConfig} onChange={change} />}
        {node?.type === 'for_each' && <ForEachSettings config={node.data.config as WorkflowForEachConfig} onChange={change} />}
        {node?.type === 'output' && <OutputSettings config={node.data.config as OutputConfig} steps={previewSteps(p.definition, p.models)} onChange={change} />}
      </div>
    </aside>
  );
}
