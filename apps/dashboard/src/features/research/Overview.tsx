import { Avatar, Button, Card, Chip, Icon, ProgressBar, Reveal, Skeleton, useResource } from '@layerto/ui';
import type { IconName } from '@layerto/ui';
import { api } from '../../lib/api';
import { useHub } from '../../hub/HubContext';
import { bytes, pct } from '../studio/lib/format';
import { timeAgo } from '../home/util';
import { AreaTag, daysUntil, num, useResearch } from './shared';

/** Research home: headline numbers, storage and GPU, deadlines, latest experiments and the activity log. */
export function ResearchOverview() {
  const { openPlan } = useHub();
  const { area, go } = useResearch();
  const o = useResource(() => api.researchOverview(), 'research-overview');
  const activity = useResource(() => api.activity(area ? { area } : {}), `activity-${area}`);
  const d = o.data;

  const stats: { label: string; value: number | undefined; sub?: string; icon: IconName; tab: string }[] = [
    { label: 'Papers', value: d?.papers, sub: d ? `${d.papers_published} published · ${d.papers_in_review} in review` : '', icon: 'file', tab: 'papers' },
    { label: 'Experiments', value: d?.experiments, sub: d ? `${d.experiments_running} running` : '', icon: 'flask', tab: 'experiments' },
    { label: 'Findings', value: d?.findings, sub: d ? `${d.notes} notes` : '', icon: 'sparkles', tab: 'findings' },
    { label: 'To read', value: d?.to_read, sub: d ? `${d.open_tasks} open tasks` : '', icon: 'book', tab: 'library' },
  ];

  return (
    <div className="grid gap-4 xl:grid-cols-3">
      <div className="space-y-4 xl:col-span-2">
        <Reveal index={0}>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {stats.map((s) => (
              <button
                key={s.label}
                type="button"
                onClick={() => go(s.tab)}
                className="group rounded-l2 border border-line bg-card p-4 text-left shadow-l1 transition-all hover:-translate-y-0.5 hover:border-crimson-border hover:shadow-l2 cursor-pointer"
              >
                <div className="flex items-center justify-between text-xs text-muted">
                  {s.label}
                  <Icon name={s.icon} size={15} className="group-hover:text-crimson" />
                </div>
                <div className="mt-1.5 text-3xl font-bold tabular-nums">{s.value ?? <Skeleton className="h-8 w-12" />}</div>
                <div className="mt-0.5 truncate text-[11px] text-muted">{s.sub}</div>
              </button>
            ))}
          </div>
        </Reveal>
        <Reveal index={1}>
          <Card title="Latest experiments" subtitle="Training runs are logged here automatically with their metrics" actions={<Button size="sm" variant="ghost" onClick={() => go('experiments')}>All</Button>} padded={false}>
            {!d ? (
              <Skeleton className="m-5 h-24" />
            ) : d.recent_experiments.length === 0 ? (
              <div className="p-5 text-sm text-muted">
                No experiments yet. Train a model in a project, or{' '}
                <button type="button" className="text-crimson cursor-pointer" onClick={() => go('experiments')}>
                  log one by hand
                </button>
                .
              </div>
            ) : (
              <ul className="divide-y divide-line">
                {d.recent_experiments.map((e) => (
                  <li key={e.id} className="flex items-center gap-3 px-5 py-3 text-sm">
                    <span className={`size-2 rounded-full ${e.status === 'done' ? 'bg-emerald-500' : e.status === 'running' ? 'bg-amber-500 animate-pulse' : e.status === 'failed' ? 'bg-crimson' : 'bg-line-strong'}`} />
                    <span className="min-w-0 flex-1 truncate font-medium">{e.name}</span>
                    <AreaTag id={e.area_id} />
                    {e.job_id && <Chip variant="neutral">auto</Chip>}
                    <span className="w-24 text-right tabular-nums">{num(e.metrics.map50_95) !== undefined ? `mAP ${pct(num(e.metrics.map50_95))}` : e.status}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </Reveal>
        <Reveal index={2}>
          <Card title="Activity" subtitle={area ? 'In this area' : 'Across your areas and teams'}>
            {activity.loading ? (
              <Skeleton className="h-32" />
            ) : (activity.data ?? []).length === 0 ? (
              <p className="text-sm text-muted">Nothing yet. Changes by you and your collaborators show up here.</p>
            ) : (
              <ol className="relative space-y-4 border-l border-line pl-5">
                {(activity.data ?? []).slice(0, 15).map((a) => (
                  <li key={a.id} className="relative">
                    <span className="absolute -left-[29px] top-0.5">
                      <Avatar name={a.actor} size={18} />
                    </span>
                    <p className="text-sm">
                      <span className="font-semibold">@{a.actor}</span> <span className="text-ink-secondary">{a.summary}</span>
                    </p>
                    <p className="text-[11px] text-muted">
                      {a.area_name && `${a.area_name} · `}
                      {timeAgo(a.created_at)}
                    </p>
                  </li>
                ))}
              </ol>
            )}
          </Card>
        </Reveal>
      </div>
      <div className="space-y-4">
        <Reveal index={1}>
          <Card title="Resources" subtitle={d ? `Plan: ${d.plan}` : undefined}>
            {!d ? (
              <Skeleton className="h-28" />
            ) : (
              <div className="space-y-5">
                <div>
                  <div className="mb-1.5 flex justify-between text-sm">
                    <span className="font-medium">Research storage</span>
                    <span className="text-muted">
                      {bytes(d.storage_bytes)} / {bytes(d.storage_limit_bytes)}
                    </span>
                  </div>
                  <ProgressBar current={d.storage_bytes} max={d.storage_limit_bytes} label="Research storage used" />
                  <button type="button" className="mt-1.5 text-xs text-crimson cursor-pointer" onClick={() => openPlan('storage')}>
                    Add 10 GB storage
                  </button>
                </div>
                <div className="flex items-center justify-between rounded-control bg-page p-3">
                  <div>
                    <div className="text-xs text-muted">Prepaid GPU Credits</div>
                    <div className="text-xl font-bold tabular-nums">
                      {(d.gpu_credits_limit ?? Math.round((d.gpu_hours ?? 0) * 100)).toLocaleString()} cr
                    </div>
                  </div>
                  <Button size="sm" variant="secondary" icon="zap" onClick={() => openPlan('gpu')}>
                    Buy GPU Credits
                  </Button>
                </div>
              </div>
            )}
          </Card>
        </Reveal>
        <Reveal index={2}>
          <Card title="Coming up" actions={<Button size="sm" variant="ghost" onClick={() => go('tasks')}>All</Button>}>
            {!d ? (
              <Skeleton className="h-24" />
            ) : d.upcoming.length === 0 ? (
              <p className="text-sm text-muted">No deadlines. Add submission dates and milestones to keep them in view.</p>
            ) : (
              <ul className="space-y-2.5">
                {d.upcoming.map((t) => {
                  const days = t.due_date ? daysUntil(t.due_date) : null;
                  return (
                    <li key={t.id} className="flex items-center gap-3">
                      <div className={`grid size-11 shrink-0 place-items-center rounded-control text-center leading-none ${days !== null && days <= 3 ? 'bg-crimson-tint text-crimson' : 'bg-page'}`}>
                        <span className="text-sm font-bold">{days === null ? '–' : days < 0 ? '!' : days}</span>
                        <span className="text-[9px] uppercase">{days === null ? '' : days < 0 ? 'late' : days === 1 ? 'day' : 'days'}</span>
                      </div>
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium">{t.title}</div>
                        <div className="text-[11px] capitalize text-muted">
                          {t.kind} · {t.due_date}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </Reveal>
        <Reveal index={3}>
          <Card title="Quick add">
            <div className="grid grid-cols-2 gap-2">
              {[
                { t: 'papers', l: 'Paper', i: 'file' as const },
                { t: 'experiments', l: 'Experiment', i: 'flask' as const },
                { t: 'findings', l: 'Finding', i: 'sparkles' as const },
                { t: 'notes', l: 'Note', i: 'pen' as const },
                { t: 'library', l: 'Reference', i: 'book' as const },
                { t: 'tasks', l: 'Deadline', i: 'calendar' as const },
              ].map((q) => (
                <button
                  key={q.t}
                  type="button"
                  onClick={() => go(`${q.t}?new=1`)}
                  className="flex items-center gap-2 rounded-control border border-line px-3 py-2 text-sm hover:border-crimson hover:text-crimson cursor-pointer transition-colors"
                >
                  <Icon name={q.i} size={15} /> {q.l}
                </button>
              ))}
            </div>
          </Card>
        </Reveal>
      </div>
    </div>
  );
}
