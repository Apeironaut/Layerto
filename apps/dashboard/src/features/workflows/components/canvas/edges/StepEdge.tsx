import { useRef, useState } from 'react';
import { BaseEdge, EdgeLabelRenderer, getBezierPath } from '@xyflow/react';
import type { EdgeProps } from '@xyflow/react';
import { Icon, cn } from '@layerto/ui';
import type { FlowEdge } from '../../../lib/graph';
import { useEditorActions } from '../EditorContext';

/**
 * A connection drawn as a curve. Hovering (or selecting) it shows a × button in the
 * middle to remove it; problems from the server show in crimson.
 */
export function StepEdge({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, markerEnd, selected, data, sourceHandleId }: EdgeProps<FlowEdge>) {
  const { removeEdge, running } = useEditorActions();
  const [hover, setHover] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  const [path, labelX, labelY] = getBezierPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition });
  const issue = data?.issue;
  const active = hover || selected;

  const enter = () => {
    window.clearTimeout(timer.current);
    setHover(true);
  };
  const leave = () => {
    timer.current = window.setTimeout(() => setHover(false), 120);
  };

  const stroke = issue ? 'var(--color-crimson)' : active ? 'var(--color-crimson)' : sourceHandleId === 'yes' ? '#10b981' : sourceHandleId === 'no' ? 'var(--color-muted)' : 'var(--color-line-strong)';

  return (
    <>
      <BaseEdge
        id={id}
        path={path}
        markerEnd={markerEnd}
        style={{ stroke, strokeWidth: active ? 2.5 : 2, strokeDasharray: running ? '6 6' : undefined }}
        className={running ? 'workflow-edge-running' : undefined}
      />
      {/* Wide invisible path makes the line easy to hover. */}
      <path d={path} fill="none" stroke="transparent" strokeWidth={22} onMouseEnter={enter} onMouseLeave={leave} className="cursor-pointer" />
      <EdgeLabelRenderer>
        <div
          className="nodrag nopan absolute pointer-events-auto"
          style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)` }}
          onMouseEnter={enter}
          onMouseLeave={leave}
        >
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              removeEdge(id);
            }}
            aria-label="Remove this connection"
            title={issue ?? 'Remove connection'}
            className={cn(
              'grid place-items-center h-6 w-6 rounded-full border shadow-l1 transition-all duration-150 cursor-pointer',
              issue ? 'bg-crimson text-white border-crimson' : 'bg-card text-muted border-line-strong hover:bg-crimson hover:text-white hover:border-crimson',
              active || issue ? 'opacity-100 scale-100' : 'opacity-0 scale-75 pointer-events-none',
            )}
          >
            <Icon name="close" size={13} strokeWidth={2.5} />
          </button>
        </div>
      </EdgeLabelRenderer>
    </>
  );
}

export const EDGE_TYPES = { step: StepEdge };
