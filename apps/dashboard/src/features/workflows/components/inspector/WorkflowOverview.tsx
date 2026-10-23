import type { PublicModelItem, WorkflowDefinition } from '@layerto/types';
import { Input } from '@layerto/ui';
import type { EditorIssues } from '../../hooks/useWorkflowEditor';
import { callBounds } from '../../lib/graph';
import { costPerImage, formatRange } from '../../lib/cost';
import { IssuesList } from './IssuesList';

export interface WorkflowOverviewProps {
  name: string;
  description: string;
  onName: (v: string) => void;
  onDescription: (v: string) => void;
  definition: WorkflowDefinition;
  models: PublicModelItem[];
  issues: EditorIssues;
  nameOf: (id: string) => string;
  onFocus: (id: string) => void;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-l2 border border-line bg-page px-3 py-2.5">
      <div className="text-xs text-muted">{label}</div>
      <div className="mt-0.5 font-bold tabular-nums">{value}</div>
    </div>
  );
}

/** Shown when no step is selected: name, description, cost and problems. */
export function WorkflowOverview({ name, description, onName, onDescription, definition, models, issues, nameOf, onFocus }: WorkflowOverviewProps) {
  const calls = callBounds(definition);
  const cost = costPerImage(definition, models);
  const steps = definition.nodes.length - 2;
  return (
    <div className="space-y-5">
      <Input label="Name" maxLength={100} value={name} onChange={(e) => onName(e.target.value)} />
      <div>
        <label htmlFor="wf-desc" className="block text-xs font-semibold text-ink-secondary mb-1.5">
          Description
        </label>
        <textarea
          id="wf-desc"
          rows={3}
          maxLength={500}
          value={description}
          onChange={(e) => onDescription(e.target.value)}
          placeholder="What this workflow is for"
          className="w-full px-3.5 py-2.5 text-sm rounded-control border border-line bg-card resize-y outline-none focus:border-crimson"
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Stat label="Steps" value={String(steps)} />
        <Stat label="Model calls / image" value={calls.min === calls.max ? String(calls.max) : `${calls.min}–${calls.max}`} />
        <div className="col-span-2">
          <Stat label="Cost per image" value={formatRange(cost)} />
        </div>
      </div>
      {cost.min !== cost.max && <p className="text-xs text-muted -mt-3">Conditions and loops decide how many calls happen, so the cost is a range. Failed calls are never charged.</p>}
      <div>
        <h3 className="text-sm font-bold mb-2">Checks</h3>
        <IssuesList issues={issues} nameOf={nameOf} onFocus={onFocus} />
      </div>
      <div className="rounded-l2 border border-line p-3 text-xs text-ink-secondary space-y-1.5">
        <p className="font-semibold text-ink">Tips</p>
        <p>• Drag from a step’s right-hand dot and let go on empty space to pick the next step.</p>
        <p>• Hover a connection and click × to remove it.</p>
        <p>• Star models to keep them at the top of every list.</p>
        <p>• Right-click a step for more actions. Press ? for shortcuts.</p>
      </div>
    </div>
  );
}
