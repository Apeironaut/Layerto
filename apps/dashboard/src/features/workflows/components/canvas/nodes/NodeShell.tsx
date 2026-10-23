import type { ReactNode } from 'react';
import { Handle, Position, useNodeConnections } from '@xyflow/react';
import type { WorkflowNodeType } from '@layerto/types';
import { Icon, cn } from '@layerto/ui';
import { STEP_META } from '../../../lib/definition';
import { useEditorActions } from '../EditorContext';

export interface SourceHandle {
  id?: string;
  label?: string;
  tone?: 'yes' | 'no';
  /** Vertical position as a % of the card height. */
  top?: number;
}

export interface NodeShellProps {
  id: string;
  type: WorkflowNodeType;
  title: ReactNode;
  subtitle?: ReactNode;
  selected?: boolean;
  issues: string[];
  hasTarget: boolean;
  sources: SourceHandle[];
  children?: ReactNode;
  footer?: ReactNode;
}

const ACCENT: Record<WorkflowNodeType, string> = {
  input: 'bg-ink text-page',
  model: 'bg-crimson text-white dark:bg-crimson-fill',
  condition: 'bg-amber-500 text-white',
  for_each: 'bg-emerald-600 text-white',
  output: 'bg-ink text-page',
};

const HANDLE = 'w-3.5! h-3.5! bg-card! border-2! border-line-strong! transition-colors hover:border-crimson!';

/** The card every step is drawn with: icon, title, summary, issues and connection handles. */
export function NodeShell({ id, type, title, subtitle, selected, issues, hasTarget, sources, children, footer }: NodeShellProps) {
  const meta = STEP_META[type];
  const hasIssues = issues.length > 0;
  return (
    <div
      className={cn(
        'group relative w-[248px] rounded-l2 border bg-card text-ink shadow-l1 transition-[box-shadow,border-color] duration-150',
        selected ? 'border-crimson shadow-l2 ring-4 ring-crimson/15' : 'border-line hover:border-line-strong hover:shadow-l2',
        hasIssues && !selected && 'border-crimson/60',
      )}
    >
      {hasTarget && <Handle type="target" position={Position.Left} className={HANDLE} />}

      <div className="flex items-center gap-3 px-3.5 pt-3">
        <span className={cn('grid place-items-center h-8 w-8 shrink-0 rounded-control', ACCENT[type])}>
          <Icon name={meta.icon} size={17} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-muted">{meta.label}</div>
          <div className="text-sm font-bold truncate" title={typeof title === 'string' ? title : undefined}>
            {title}
          </div>
        </div>
        {hasIssues && (
          <span className="grid place-items-center h-6 min-w-6 px-1.5 rounded-pill bg-crimson text-white text-xs font-bold" title={issues.join('\n')}>
            <span className="sr-only">Problems: </span>
            {issues.length}
          </span>
        )}
      </div>
      {subtitle && <div className="px-3.5 mt-1 text-xs text-muted truncate">{subtitle}</div>}
      {children && <div className="px-3.5 mt-2.5 space-y-1.5 text-xs">{children}</div>}
      {hasIssues && <p className="mx-3.5 mt-2.5 text-xs text-crimson line-clamp-2">{issues[0]}</p>}
      <div className="px-3.5 pb-3 pt-2.5">{footer}</div>

      {sources.map((s) => (
        <SourcePort key={s.id ?? 'out'} nodeId={id} port={s} nodeLabel={typeof title === 'string' ? title : meta.label} />
      ))}
    </div>
  );
}

/**
 * One output dot. While nothing is connected to it, a "+" button beside it opens the
 * add-step menu (connected outputs keep the line clear so its × is easy to reach).
 */
function SourcePort({ nodeId, port, nodeLabel }: { nodeId: string; port: SourceHandle; nodeLabel: string }) {
  const { openAddMenu } = useEditorActions();
  const connections = useNodeConnections({ handleType: 'source', handleId: port.id });
  const free = connections.length === 0;
  return (
    <div className="absolute right-0 -translate-y-1/2" style={{ top: `${port.top ?? 50}%` }}>
      {port.label && (
        <span
          className={cn(
            'absolute right-5 -translate-y-1/2 top-1/2 text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-pill',
            port.tone === 'yes' ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300' : 'bg-crimson-tint text-crimson',
          )}
        >
          {port.label}
        </span>
      )}
      <Handle type="source" id={port.id} position={Position.Right} className={HANDLE} style={{ top: 0, transform: 'translate(50%, -50%)' }} />
      {free && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            openAddMenu({ from: { nodeId, handle: port.id ?? null }, clientX: e.clientX, clientY: e.clientY });
          }}
          aria-label={`Add a step after ${nodeLabel}${port.label ? ` (${port.label})` : ''}`}
          className="nodrag absolute left-5 -translate-y-1/2 grid place-items-center h-6 w-6 rounded-full border border-dashed border-line-strong bg-card text-muted shadow-l1 hover:text-white hover:bg-crimson hover:border-crimson hover:border-solid transition-all cursor-pointer"
        >
          <Icon name="plus" size={14} />
        </button>
      )}
    </div>
  );
}
