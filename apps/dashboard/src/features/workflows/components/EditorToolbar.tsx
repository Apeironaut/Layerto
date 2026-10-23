import { useState } from 'react';
import { Button, Icon, cn } from '@layerto/ui';

export interface EditorToolbarProps {
  name: string;
  onName: (v: string) => void;
  dirty: boolean;
  saving: boolean;
  saved: boolean;
  issueCount: number;
  costLabel: string;
  canRun: boolean;
  onBack: () => void;
  onShowIssues: () => void;
  onSave: () => void;
  onRun: () => void;
  onApi: () => void;
  onDelete?: () => void;
}

/** Top bar: back, name, save state, checks, cost and the main actions. */
export function EditorToolbar(p: EditorToolbarProps) {
  const [editing, setEditing] = useState(false);
  const status = p.saving ? 'Saving…' : p.dirty ? 'Unsaved changes' : p.saved ? 'All changes saved' : 'Not saved yet';
  return (
    <header className="flex items-center gap-3 px-4 h-14 border-b border-line bg-card shrink-0">
      <button type="button" onClick={p.onBack} aria-label="Back to workflows" className="grid place-items-center h-9 w-9 rounded-control text-ink-secondary hover:bg-page cursor-pointer">
        <Icon name="arrowLeft" size={18} />
      </button>
      <div className="min-w-0 flex-1 flex items-center gap-3">
        {editing ? (
          <input
            autoFocus
            value={p.name}
            maxLength={100}
            onChange={(e) => p.onName(e.target.value)}
            onBlur={() => setEditing(false)}
            onKeyDown={(e) => (e.key === 'Enter' || e.key === 'Escape') && setEditing(false)}
            aria-label="Workflow name"
            className="min-w-0 max-w-md flex-1 px-2 py-1 rounded-control border border-crimson bg-card text-base font-bold outline-none"
          />
        ) : (
          <button type="button" onClick={() => setEditing(true)} title="Rename" className="min-w-0 max-w-md truncate px-2 py-1 rounded-control text-base font-bold hover:bg-page cursor-text">
            {p.name || 'Untitled workflow'}
          </button>
        )}
        <span className={cn('hidden xl:inline-flex items-center gap-1.5 text-xs', p.dirty ? 'text-amber-600 dark:text-amber-400' : 'text-muted')}>
          <span className={cn('h-1.5 w-1.5 rounded-full', p.dirty ? 'bg-amber-500' : 'bg-emerald-500')} aria-hidden="true" />
          {status}
        </span>
      </div>
      <button
        type="button"
        onClick={p.onShowIssues}
        className={cn(
          'inline-flex items-center gap-1.5 h-8 px-3 rounded-pill text-xs font-semibold border cursor-pointer',
          p.issueCount ? 'border-crimson-border bg-crimson-tint text-crimson' : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
        )}
      >
        <Icon name={p.issueCount ? 'alert' : 'check'} size={14} />
        {p.issueCount ? `${p.issueCount} to fix` : 'Ready'}
      </button>
      <span className="hidden lg:inline-flex items-center h-8 px-3 rounded-pill border border-line text-xs font-semibold tabular-nums" title="Cost per image at live prices">
        {p.costLabel} / image
      </span>
      {p.onDelete && (
        <button type="button" onClick={p.onDelete} aria-label="Delete workflow" title="Delete workflow" className="grid place-items-center h-9 w-9 rounded-control text-muted hover:text-crimson hover:bg-crimson-tint cursor-pointer">
          <Icon name="trash" size={17} />
        </button>
      )}
      <Button variant="secondary" size="sm" icon="external" onClick={p.onApi} disabled={!p.canRun}>
        API
      </Button>
      <Button variant="secondary" size="sm" icon="play" onClick={p.onRun} disabled={!p.canRun} title={p.canRun ? 'Test on real images' : 'Save without problems first'}>
        Test run
      </Button>
      <Button size="sm" icon="check" loading={p.saving} onClick={p.onSave} disabled={!p.dirty && p.saved}>
        Save
      </Button>
    </header>
  );
}
