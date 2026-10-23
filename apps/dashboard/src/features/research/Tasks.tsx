import { useMemo, useState } from 'react';
import { errorMessage } from '@layerto/api-client';
import type { ResearchTask } from '@layerto/types';
import { Button, Card, EmptyState, Icon, Skeleton, cn, useNotify, useResource } from '@layerto/ui';
import { api } from '../../lib/api';
import { AreaTag, daysUntil, useResearch } from './shared';

const KIND: Record<ResearchTask['kind'], { label: string; icon: 'check' | 'calendar' | 'trophy'; cls: string }> = {
  task: { label: 'Task', icon: 'check', cls: 'text-muted' },
  deadline: { label: 'Deadline', icon: 'calendar', cls: 'text-crimson' },
  milestone: { label: 'Milestone', icon: 'trophy', cls: 'text-amber-500' },
};

/** Tasks, submission deadlines and milestones, grouped by when they're due. */
export function TasksView() {
  const { area, canWrite } = useResearch();
  const notify = useNotify();
  const tasks = useResource(() => api.tasks({ area }), `tasks-${area}`);
  const [title, setTitle] = useState('');
  const [kind, setKind] = useState<ResearchTask['kind']>('task');
  const [due, setDue] = useState('');
  const [showDone, setShowDone] = useState(false);
  const [busy, setBusy] = useState(false);

  const groups = useMemo(() => {
    const open = (tasks.data ?? []).filter((t) => !t.done);
    const by = (f: (d: number | null) => boolean) => open.filter((t) => f(t.due_date ? daysUntil(t.due_date) : null)).sort((a, b) => (a.due_date ?? '9').localeCompare(b.due_date ?? '9'));
    return [
      { id: 'overdue', label: 'Overdue', items: by((d) => d !== null && d < 0) },
      { id: 'week', label: 'Next 7 days', items: by((d) => d !== null && d >= 0 && d <= 7) },
      { id: 'later', label: 'Later', items: by((d) => d !== null && d > 7) },
      { id: 'none', label: 'No date', items: by((d) => d === null) },
    ].filter((g) => g.items.length);
  }, [tasks.data]);
  const done = (tasks.data ?? []).filter((t) => t.done);

  const add = async () => {
    if (!title.trim()) return;
    setBusy(true);
    try {
      await api.researchCreate('tasks', { title: title.trim(), kind, due_date: due, area_id: area });
      setTitle('');
      setDue('');
      void tasks.reload();
    } catch (err) {
      notify(errorMessage(err, "Couldn't add."), 'error');
    } finally {
      setBusy(false);
    }
  };
  const toggle = async (t: ResearchTask) => {
    try {
      await api.researchUpdate('tasks', t.id, { done: !t.done });
      void tasks.reload();
    } catch (err) {
      notify(errorMessage(err, "Couldn't update."), 'error');
    }
  };
  const remove = async (t: ResearchTask) => {
    try {
      await api.researchDelete('tasks', t.id);
      void tasks.reload();
    } catch (err) {
      notify(errorMessage(err, "Couldn't delete."), 'error');
    }
  };

  const Row = ({ t }: { t: ResearchTask }) => {
    const d = t.due_date ? daysUntil(t.due_date) : null;
    const k = KIND[t.kind];
    return (
      <li className="group flex items-center gap-3 px-5 py-3">
        <button
          type="button"
          aria-label={t.done ? 'Mark not done' : 'Mark done'}
          disabled={!canWrite(t.area_id)}
          onClick={() => void toggle(t)}
          className={cn('grid size-5 shrink-0 place-items-center rounded-full border-2 transition-colors cursor-pointer', t.done ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-line-strong hover:border-emerald-500')}
        >
          {t.done && <Icon name="check" size={11} />}
        </button>
        <Icon name={k.icon} size={15} className={k.cls} />
        <span className={cn('min-w-0 flex-1 truncate text-sm', t.done && 'text-muted line-through')}>{t.title}</span>
        <AreaTag id={t.area_id} />
        {t.due_date && (
          <span className={cn('w-28 text-right text-xs tabular-nums', !t.done && d !== null && d < 0 ? 'font-semibold text-crimson' : !t.done && d !== null && d <= 3 ? 'font-semibold text-amber-600' : 'text-muted')}>
            {t.done ? t.due_date : d === 0 ? 'Today' : d === 1 ? 'Tomorrow' : d !== null && d < 0 ? `${-d}d late` : `in ${d}d · ${t.due_date.slice(5)}`}
          </span>
        )}
        {canWrite(t.area_id) && (
          <button type="button" aria-label="Delete" onClick={() => void remove(t)} className="text-muted opacity-0 transition-opacity hover:text-crimson group-hover:opacity-100 cursor-pointer">
            <Icon name="trash" size={14} />
          </button>
        )}
      </li>
    );
  };

  return (
    <div className="space-y-4">
      {canWrite() && (
        <form
          className="flex flex-wrap gap-2 rounded-l2 border border-line bg-card p-3 shadow-l1"
          onSubmit={(e) => {
            e.preventDefault();
            void add();
          }}
        >
          <select value={kind} onChange={(e) => setKind(e.target.value as ResearchTask['kind'])} aria-label="Kind" className="h-10 rounded-control border border-line-strong bg-card px-2 text-sm">
            <option value="task">Task</option>
            <option value="deadline">Deadline</option>
            <option value="milestone">Milestone</option>
          </select>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={200}
            autoFocus={!!new URLSearchParams(window.location.search).get('new')}
            placeholder={kind === 'deadline' ? 'CVPR 2027 abstract submission' : kind === 'milestone' ? 'Baseline reproduced' : 'Run ablation without mosaic'}
            className="h-10 min-w-56 flex-1 rounded-control border border-line-strong bg-card px-3 text-sm focus:outline-none focus:ring-2 focus:ring-focus"
            aria-label="Title"
          />
          <input type="date" value={due} onChange={(e) => setDue(e.target.value)} aria-label="Due date" className="h-10 rounded-control border border-line-strong bg-card px-2 text-sm" />
          <Button type="submit" icon="plus" loading={busy} disabled={!title.trim()}>
            Add
          </Button>
        </form>
      )}
      {tasks.loading ? (
        <Skeleton className="h-48" />
      ) : (tasks.data ?? []).length === 0 ? (
        <Card>
          <EmptyState icon="calendar" title="Nothing scheduled" description="Track conference deadlines, milestones and to-dos. Upcoming ones show on the research overview." />
        </Card>
      ) : (
        <>
          {groups.map((g) => (
            <Card key={g.id} padded={false} title={undefined}>
              <div className={cn('flex items-center gap-2 border-b border-line px-5 py-2.5 text-xs font-semibold uppercase tracking-wide', g.id === 'overdue' ? 'text-crimson' : 'text-muted')}>
                {g.label} <span className="font-mono">{g.items.length}</span>
              </div>
              <ul className="divide-y divide-line">
                {g.items.map((t) => (
                  <Row key={t.id} t={t} />
                ))}
              </ul>
            </Card>
          ))}
          {done.length > 0 && (
            <div>
              <button type="button" onClick={() => setShowDone((v) => !v)} className="inline-flex items-center gap-1 text-sm text-muted hover:text-ink cursor-pointer">
                <Icon name="chevronRight" size={14} className={cn('transition-transform', showDone && 'rotate-90')} />
                {done.length} done
              </button>
              {showDone && (
                <Card padded={false} className="mt-2">
                  <ul className="divide-y divide-line">
                    {done.map((t) => (
                      <Row key={t.id} t={t} />
                    ))}
                  </ul>
                </Card>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
