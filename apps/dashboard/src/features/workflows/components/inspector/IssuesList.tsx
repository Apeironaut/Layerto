import { Icon } from '@layerto/ui';
import type { EditorIssues } from '../../hooks/useWorkflowEditor';

export interface IssuesListProps {
  issues: EditorIssues;
  nameOf: (nodeId: string) => string;
  onFocus: (nodeId: string) => void;
}

/** Every problem in the workflow; clicking one jumps to its step. */
export function IssuesList({ issues, nameOf, onFocus }: IssuesListProps) {
  if (issues.count === 0) {
    return (
      <div className="flex items-center gap-2 rounded-l2 border border-emerald-500/30 bg-emerald-500/10 px-3 py-2.5 text-sm text-emerald-800 dark:text-emerald-300">
        <Icon name="check" size={16} /> Ready to save and run.
      </div>
    );
  }
  return (
    <ul className="space-y-1.5">
      {issues.general.map((m) => (
        <li key={m} className="flex gap-2 rounded-control bg-crimson-tint px-3 py-2 text-sm text-crimson">
          <Icon name="alert" size={16} className="shrink-0 mt-0.5" /> {m}
        </li>
      ))}
      {Object.entries(issues.byNode).flatMap(([id, msgs]) =>
        msgs.map((m) => (
          <li key={id + m}>
            <button type="button" onClick={() => onFocus(id)} className="w-full flex gap-2 rounded-control border border-crimson-border px-3 py-2 text-left text-sm hover:bg-crimson-tint cursor-pointer">
              <Icon name="alert" size={16} className="shrink-0 mt-0.5 text-crimson" />
              <span>
                <span className="font-semibold">{nameOf(id)}:</span> {m}
              </span>
            </button>
          </li>
        )),
      )}
      {Object.values(issues.byEdge).map((m) => (
        <li key={m} className="flex gap-2 rounded-control bg-crimson-tint px-3 py-2 text-sm text-crimson">
          <Icon name="alert" size={16} className="shrink-0 mt-0.5" /> {m}
        </li>
      ))}
    </ul>
  );
}
