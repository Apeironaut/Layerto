import { useState } from 'react';
import type { WorkflowSummary } from '@layerto/types';
import { errorMessage } from '@layerto/api-client';
import { Button, Card, ConfirmModal, EmptyState, Icon, PageHeader, Reveal, Skeleton, TiltCard, useNotify } from '@layerto/ui';
import { api } from '../../../lib/api';
import { formatRelativeTime } from '../../../lib/time';
import { useWorkflows } from '../hooks/useWorkflows';
import { TEMPLATES } from '../lib/templates';

export interface WorkflowsPageProps {
  navigate: (path: string) => void;
}

function StepCounts({ w }: { w: WorkflowSummary }) {
  const parts = [
    `${w.node_counts.model} model${w.node_counts.model === 1 ? '' : 's'}`,
    w.node_counts.condition ? `${w.node_counts.condition} condition${w.node_counts.condition === 1 ? '' : 's'}` : null,
    w.node_counts.for_each ? `${w.node_counts.for_each} loop${w.node_counts.for_each === 1 ? '' : 's'}` : null,
  ].filter(Boolean);
  return <span>{parts.join(' · ')}</span>;
}

export function WorkflowsPage({ navigate }: WorkflowsPageProps) {
  const list = useWorkflows();
  const notify = useNotify();
  const [query, setQuery] = useState('');
  const [deleting, setDeleting] = useState<WorkflowSummary | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const items = (list.data ?? []).filter((w) => `${w.name} ${w.description} ${w.models.join(' ')}`.toLowerCase().includes(query.toLowerCase()));

  const duplicate = async (w: WorkflowSummary) => {
    setBusy(w.id);
    try {
      const full = await api.getWorkflow(w.id);
      const copy = await api.createWorkflow({ name: `${w.name} (copy)`.slice(0, 100), description: w.description, definition: full.definition as never });
      notify('Workflow duplicated', 'success');
      navigate(`/workflows/${copy.id}`);
    } catch (err) {
      notify(errorMessage(err, "Couldn't duplicate the workflow."), 'error');
    } finally {
      setBusy(null);
    }
  };

  const remove = async () => {
    if (!deleting) return;
    setBusy(deleting.id);
    try {
      await api.deleteWorkflow(deleting.id);
      notify(`“${deleting.name}” deleted`, 'success');
      setDeleting(null);
      await list.reload();
    } catch (err) {
      notify(errorMessage(err, "Couldn't delete the workflow."), 'error');
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <PageHeader
        title="Workflows"
        description="Chain models with conditions and loops, choose exactly what comes back, and call it with one request."
        actions={
          <Button icon="plus" onClick={() => navigate('/workflows/new')}>
            New workflow
          </Button>
        }
      />

      <Reveal index={0}>
        <section aria-labelledby="templates-title" className="space-y-3">
          <h2 id="templates-title" className="text-sm font-bold text-ink-secondary">
            Start from a template
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
            {TEMPLATES.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => navigate(`/workflows/new/${t.id}`)}
                className="group flex flex-col items-start text-left rounded-l1 border border-line bg-card p-4 hover:border-crimson-border hover:shadow-l2 transition-all cursor-pointer"
              >
                <span className="grid place-items-center h-10 w-10 rounded-control bg-crimson-tint text-crimson group-hover:bg-crimson group-hover:text-white transition-colors">
                  <Icon name={t.icon} size={20} />
                </span>
                <span className="mt-3 block font-bold">{t.name}</span>
                <span className="mt-1 block text-sm text-muted">{t.description}</span>
              </button>
            ))}
          </div>
        </section>
      </Reveal>

      <Reveal index={1}>
        <Card
          title="Your workflows"
          actions={
            (list.data?.length ?? 0) > 3 && (
              <div className="relative">
                <Icon name="search" size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search"
                  aria-label="Search workflows"
                  className="w-48 pl-8 pr-3 py-1.5 text-sm rounded-control border border-line bg-page outline-none focus:border-crimson"
                />
              </div>
            )
          }
        >
          {list.loading ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-4">
              <Skeleton className="h-40" />
              <Skeleton className="h-40" />
            </div>
          ) : (list.data ?? []).length === 0 ? (
            <EmptyState
              icon="layers"
              title="No workflows yet"
              description="Pick a template above or start from scratch."
              action={
                <Button icon="plus" onClick={() => navigate('/workflows/new')}>
                  New workflow
                </Button>
              }
            />
          ) : items.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted">No workflows match “{query}”.</p>
          ) : (
            <ul className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-4">
              {items.map((w) => (
                <li key={w.id}>
                  <TiltCard tilt={3} className="h-full flex flex-col gap-3 p-5">
                    <button type="button" onClick={() => navigate(`/workflows/${w.id}`)} className="text-left cursor-pointer">
                      <span className="block text-lg font-bold hover:text-crimson transition-colors">{w.name}</span>
                      <span className="mt-1 block text-sm text-muted line-clamp-2">{w.description || 'No description'}</span>
                    </button>
                    <div className="flex flex-wrap gap-1.5">
                      {w.models.slice(0, 4).map((m) => (
                        <span key={m} className="px-2 py-0.5 rounded-pill bg-page border border-line font-mono text-xs">
                          {m}
                        </span>
                      ))}
                      {w.models.length > 4 && <span className="text-xs text-muted">+{w.models.length - 4}</span>}
                    </div>
                    <div className="mt-auto flex items-center justify-between gap-2 pt-2 border-t border-line text-xs text-muted">
                      <span>
                        <StepCounts w={w} /> · edited {formatRelativeTime(w.updated_at)}
                      </span>
                      <span className="flex gap-1">
                        <button type="button" onClick={() => void duplicate(w)} disabled={busy === w.id} aria-label={`Duplicate ${w.name}`} title="Duplicate" className="p-1.5 rounded-control hover:bg-page hover:text-ink cursor-pointer">
                          <Icon name="duplicate" size={16} />
                        </button>
                        <button type="button" onClick={() => setDeleting(w)} aria-label={`Delete ${w.name}`} title="Delete" className="p-1.5 rounded-control hover:bg-crimson-tint hover:text-crimson cursor-pointer">
                          <Icon name="trash" size={16} />
                        </button>
                      </span>
                    </div>
                  </TiltCard>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </Reveal>

      <ConfirmModal
        isOpen={deleting !== null}
        title="Delete this workflow?"
        description={`Apps calling “${deleting?.name}” will get “workflow not found”. This can't be undone.`}
        confirmLabel="Delete workflow"
        danger
        busy={busy !== null}
        onConfirm={remove}
        onCancel={() => setDeleting(null)}
      />
    </>
  );
}
