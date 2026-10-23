import { useEffect, useMemo, useState } from 'react';
import { errorMessage } from '@layerto/api-client';
import type { Project } from '@layerto/types';
import {
  Alert,
  Button,
  Card,
  Chip,
  ConfirmModal,
  EmptyState,
  Icon,
  Input,
  LineChart,
  Markdown,
  MetricsPanel,
  ProgressBar,
  Reveal,
  Select,
  Skeleton,
  Switch,
  Tabs,
  useNotify,
  useResource,
} from '@layerto/ui';
import { api } from '../../lib/api';
import { SITE_URL } from '../../config';
import { useHub } from '../../hub/HubContext';
import { CreateDatasetModal } from '../studio/pages/CreateDatasetModal';
import { TrainingPage } from '../studio/pages/TrainingPage';
import { MyModelsPage } from '../studio/pages/MyModelsPage';
import { bytes, pct, shortDate } from '../studio/lib/format';
import { timeAgo } from '../home/util';

export type ProjectTab = 'overview' | 'data' | 'train' | 'models' | 'settings';
export const PROJECT_TABS: ProjectTab[] = ['overview', 'data', 'train', 'models', 'settings'];

/** One project: overview, datasets (with labeling and purchased data), training runs, models and settings. */
export function ProjectWorkspace({ id, tab }: { id: string; tab: ProjectTab }) {
  const { navigate, reloadBalance } = useHub();
  const project = useResource(() => api.studioProject(id), `studio-project-${id}`);
  const p = project.data;
  if (project.error) {
    return (
      <Card>
        <EmptyState icon="folder" title="Project not found" description="It may have been deleted or is no longer shared with you." action={<Button onClick={() => navigate('/projects')}>All projects</Button>} />
      </Card>
    );
  }
  const go = (t: ProjectTab, qs = '') => navigate(`/projects/${id}${t === 'overview' ? '' : `/${t}`}${qs}`);
  const canWrite = p?.role !== 'viewer';
  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <button type="button" className="inline-flex items-center gap-1 text-sm text-muted hover:text-crimson cursor-pointer" onClick={() => navigate('/projects')}>
            <Icon name="chevronRight" size={14} className="rotate-180" /> Projects
          </button>
          {p ? (
            <h1 className="mt-1 flex flex-wrap items-center gap-2 text-2xl font-bold tracking-tight">
              {p.name}
              {p.team_name && <Chip variant="brand">{p.team_name}</Chip>}
              {p.role && p.role !== 'owner' && <Chip variant="neutral">{p.role}</Chip>}
              {p.is_public && <Chip variant="active">Public</Chip>}
            </h1>
          ) : (
            <Skeleton className="mt-2 h-8 w-64" />
          )}
          {p?.description && <p className="mt-1 text-muted">{p.description}</p>}
        </div>
        {canWrite && (
          <div className="flex gap-2">
            <Button variant="secondary" icon="database" onClick={() => go('data', '?new=1')}>
              New dataset
            </Button>
            <Button icon="cpu" onClick={() => go('train')}>
              Train
            </Button>
          </div>
        )}
      </div>
      <Tabs<ProjectTab>
        value={tab}
        onChange={(t) => go(t)}
        items={[
          { value: 'overview', label: 'Overview', icon: 'overview' },
          { value: 'data', label: 'Data', icon: 'database', count: p?.datasets },
          { value: 'train', label: 'Training', icon: 'cpu', count: p?.jobs },
          { value: 'models', label: 'Models', icon: 'box', count: p?.models },
          { value: 'settings', label: 'Settings', icon: 'settings' },
        ]}
      />
      {!p ? (
        <Skeleton className="h-72" />
      ) : tab === 'overview' ? (
        <OverviewTab p={p} go={go} />
      ) : tab === 'data' ? (
        <DataTab p={p} />
      ) : tab === 'train' ? (
        <TrainingPage navigate={navigate} onCharged={reloadBalance} projectId={id} embedded />
      ) : tab === 'models' ? (
        <MyModelsPage navigate={navigate} onCharged={reloadBalance} projectId={id} embedded />
      ) : (
        <SettingsTab p={p} onSaved={() => void project.reload()} />
      )}
    </>
  );
}

function OverviewTab({ p, go }: { p: Project; go: (t: ProjectTab, qs?: string) => void }) {
  const { navigate } = useHub();
  const datasets = useResource(() => api.studioDatasets(p.id), `studio-project-ds-${p.id}`);
  const jobs = useResource(() => api.studioJobs(p.id), `studio-jobs-${p.id}`);
  const models = useResource(() => api.studioModels(p.id), `studio-models-${p.id}`);
  const best = useMemo(
    () => [...(models.data ?? [])].sort((a, b) => (b.metrics.map50_95 ?? 0) - (a.metrics.map50_95 ?? 0))[0],
    [models.data],
  );
  const ds = (datasets.data ?? []).filter((d) => !d.purged_at);
  const totalImages = ds.reduce((s, d) => s + d.images, 0);
  const labeled = ds.reduce((s, d) => s + d.labeled, 0);
  const runs = jobs.data ?? [];
  const runSeries = runs
    .filter((j) => j.status === 'succeeded' && j.progress.map50_95 != null)
    .slice()
    .reverse()
    .map((j, i) => ({ x: i + 1, y: j.progress.map50_95 ?? 0 }));

  const steps = [
    { done: ds.length > 0, label: 'Create a dataset', action: () => go('data', '?new=1') },
    { done: totalImages > 0, label: 'Upload images', action: () => ds[0] && navigate(`/datasets/${ds[0].id}`) },
    { done: labeled >= 10, label: 'Label at least 10 images', action: () => ds[0] && navigate(`/datasets/${ds[0].id}/annotate`) },
    { done: runs.length > 0, label: 'Start a training run', action: () => go('train') },
    { done: (models.data ?? []).length > 0, label: 'Get a model with an API', action: () => go('models') },
  ];
  const doneCount = steps.filter((s) => s.done).length;

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="space-y-4 lg:col-span-2">
        <Reveal index={0}>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { k: 'Images', v: totalImages.toLocaleString(), icon: 'image' as const },
              { k: 'Labeled', v: totalImages ? `${Math.round((labeled / totalImages) * 100)}%` : '—', icon: 'target' as const },
              { k: 'Training runs', v: runs.length, icon: 'cpu' as const },
              { k: 'Best mAP50-95', v: best ? pct(best.metrics.map50_95) : '—', icon: 'trophy' as const },
            ].map((s) => (
              <div key={s.k} className="rounded-l2 border border-line bg-card p-4 shadow-l1">
                <div className="flex items-center gap-2 text-xs text-muted">
                  <Icon name={s.icon} size={14} /> {s.k}
                </div>
                <div className="mt-1.5 text-2xl font-bold tabular-nums">{s.v}</div>
              </div>
            ))}
          </div>
        </Reveal>
        {best ? (
          <Reveal index={1}>
            <Card
              title={`Best model · ${best.name}`}
              subtitle={[best.size && `LTVision-${best.size.toUpperCase()}`, `${best.classes.length} classes`, shortDate(best.created_at)].filter(Boolean).join(' · ')}
              actions={
                <Button size="sm" variant="secondary" onClick={() => navigate(`/projects/${p.id}/models?m=${best.slug}`)}>
                  Open
                </Button>
              }
            >
              <MetricsPanel metrics={best.metrics} history={best.history} source={best.source} compact />
            </Card>
          </Reveal>
        ) : null}
        <Reveal index={2}>
          <Card title="Run history" subtitle="mAP50-95 of each finished run, oldest first">
            {runSeries.length >= 2 ? (
              <LineChart series={[{ name: 'mAP50-95', points: runSeries }]} xLabel="run" height={200} />
            ) : (
              <p className="py-6 text-center text-sm text-muted">{runSeries.length === 1 ? 'One finished run so far. Train again to see how accuracy moves between runs.' : 'Finished runs will be plotted here.'}</p>
            )}
          </Card>
        </Reveal>
        <Reveal index={3}>
          <Card title="Recent runs" padded={false}>
            {runs.length === 0 ? (
              <p className="p-5 text-sm text-muted">No training runs yet.</p>
            ) : (
              <ul className="divide-y divide-line">
                {runs.slice(0, 6).map((j) => (
                  <li key={j.id}>
                    <button type="button" className="flex w-full items-center gap-3 px-5 py-3 text-left text-sm hover:bg-page cursor-pointer" onClick={() => go('train')}>
                      <span
                        className={`size-2 rounded-full ${j.status === 'succeeded' ? 'bg-emerald-500' : j.status === 'running' ? 'bg-amber-500 animate-pulse' : j.status === 'queued' ? 'bg-sky-500' : 'bg-line-strong'}`}
                      />
                      <span className="min-w-0 flex-1 truncate font-medium">{j.name}</span>
                      <span className="hidden text-muted sm:inline">{j.dataset_name}</span>
                      <span className="w-20 text-right tabular-nums">{j.progress.map50_95 != null ? pct(j.progress.map50_95) : j.status}</span>
                      <span className="w-20 text-right text-xs text-muted">{timeAgo(j.created_at)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </Reveal>
      </div>
      <div className="space-y-4">
        <Reveal index={1}>
          <Card title="Getting this project going" subtitle={`${doneCount} of ${steps.length} done`}>
            <ProgressBar current={doneCount} max={steps.length} label="Setup progress" />
            <ul className="mt-4 space-y-1">
              {steps.map((s) => (
                <li key={s.label}>
                  <button
                    type="button"
                    disabled={s.done}
                    onClick={s.action}
                    className="flex w-full items-center gap-2.5 rounded-control px-2 py-1.5 text-left text-sm hover:bg-page disabled:cursor-default cursor-pointer"
                  >
                    <span className={`grid size-5 place-items-center rounded-full ${s.done ? 'bg-emerald-500 text-white' : 'border border-line-strong'}`}>{s.done && <Icon name="check" size={12} />}</span>
                    <span className={s.done ? 'text-muted line-through' : ''}>{s.label}</span>
                  </button>
                </li>
              ))}
            </ul>
          </Card>
        </Reveal>
        <Reveal index={2}>
          <Card title="Datasets" actions={<Button size="sm" variant="ghost" onClick={() => go('data')}>All</Button>}>
            {datasets.loading ? (
              <Skeleton className="h-20" />
            ) : ds.length === 0 ? (
              <p className="text-sm text-muted">No datasets yet.</p>
            ) : (
              <ul className="space-y-3">
                {ds.slice(0, 5).map((d) => (
                  <li key={d.id}>
                    <button type="button" className="w-full text-left cursor-pointer group" onClick={() => navigate(`/datasets/${d.id}`)}>
                      <div className="flex justify-between text-sm">
                        <span className="font-medium group-hover:text-crimson">{d.name}</span>
                        <span className="text-xs text-muted">
                          {d.labeled}/{d.images}
                        </span>
                      </div>
                      <ProgressBar current={d.labeled} max={d.images} label={`${d.name} labeled`} className="mt-1.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </Reveal>
        {p.notes && (
          <Reveal index={3}>
            <Card title="Notes" actions={<Button size="sm" variant="ghost" onClick={() => go('settings')}>Edit</Button>}>
              <Markdown text={p.notes} compact className="max-h-72 overflow-y-auto" />
            </Card>
          </Reveal>
        )}
      </div>
    </div>
  );
}

function DataTab({ p }: { p: Project }) {
  const { navigate, has } = useHub();
  const notify = useNotify();
  const datasets = useResource(() => api.studioDatasets(p.id), `studio-project-ds-${p.id}`);
  const purchases = useResource(() => (has('marketplace_buy') ? api.purchases() : Promise.resolve([])), `market-purchases-${has('marketplace_buy')}`);
  const [creating, setCreating] = useState(() => new URLSearchParams(window.location.search).get('new') === '1');
  const [importing, setImporting] = useState<string | null>(null);
  const canWrite = p.role !== 'viewer';
  const notImported = (purchases.data ?? []).filter((x) => !(datasets.data ?? []).some((d) => d.source_listing_id === x.listing_id));

  const doImport = async (purchaseId: string) => {
    setImporting(purchaseId);
    try {
      const r = await api.importPurchase(purchaseId, p.id);
      notify(`Imported ${r.copied} images into “${r.dataset.name}”`, 'success');
      void datasets.reload();
    } catch (err) {
      notify(errorMessage(err, "Couldn't import the dataset."), 'error');
    } finally {
      setImporting(null);
    }
  };

  const list = datasets.data ?? [];
  return (
    <div className="space-y-4">
      <Reveal index={0}>
        {datasets.loading ? (
          <Skeleton className="h-40" />
        ) : list.length === 0 ? (
          <Card>
            <EmptyState
              icon="database"
              title="No datasets in this project"
              description="Create a dataset, upload images and label the objects to detect. Datasets you bought on the marketplace can be imported here too."
              action={canWrite && <Button icon="plus" onClick={() => setCreating(true)}>New dataset</Button>}
            />
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {list.map((d) => (
              <div key={d.id} className="flex flex-col rounded-l2 border border-line bg-card p-5 shadow-l1 transition-shadow hover:shadow-l2">
                <div className="flex items-start justify-between gap-2">
                  <button type="button" className="text-left font-semibold hover:text-crimson cursor-pointer" onClick={() => navigate(`/datasets/${d.id}`)}>
                    {d.name}
                  </button>
                  <div className="flex gap-1">
                    {d.source_listing_id && <Chip variant="brand">Purchased</Chip>}
                    {d.purged_at && <Chip variant="neutral">Deleted</Chip>}
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap gap-1">
                  {d.classes.slice(0, 6).map((c) => (
                    <span key={c} className="rounded-pill bg-page px-2 py-0.5 text-[11px] text-ink-secondary">
                      {c}
                    </span>
                  ))}
                  {d.classes.length > 6 && <span className="text-[11px] text-muted">+{d.classes.length - 6}</span>}
                </div>
                <div className="mt-4 flex justify-between text-xs text-muted">
                  <span>
                    {d.labeled}/{d.images} labeled · {d.boxes} boxes
                  </span>
                  <span>{bytes(d.bytes)}</span>
                </div>
                <ProgressBar current={d.labeled} max={d.images} label={`${d.name} labeled`} className="mt-1.5" />
                {d.license && <p className="mt-2 text-[11px] text-muted">License: {d.license.replace(/_/g, ' ')}</p>}
                <div className="mt-4 flex gap-2">
                  <Button size="sm" variant="secondary" onClick={() => navigate(`/datasets/${d.id}`)}>
                    Images
                  </Button>
                  {canWrite && !d.purged_at && (
                    <Button size="sm" variant="secondary" icon="target" onClick={() => navigate(`/datasets/${d.id}/annotate`)}>
                      Label
                    </Button>
                  )}
                  {!d.purged_at && d.labeled > 0 && (
                    <Button size="sm" variant="ghost" icon="cpu" onClick={() => navigate(`/projects/${p.id}/train?dataset=${d.id}`)}>
                      Train
                    </Button>
                  )}
                </div>
              </div>
            ))}
            {canWrite && (
              <button
                type="button"
                onClick={() => setCreating(true)}
                className="grid min-h-44 place-items-center rounded-l2 border-2 border-dashed border-line text-muted hover:border-crimson hover:text-crimson cursor-pointer transition-colors"
              >
                <span className="flex flex-col items-center gap-2 text-sm font-medium">
                  <Icon name="plus" size={22} /> New dataset
                </span>
              </button>
            )}
          </div>
        )}
      </Reveal>
      {canWrite && notImported.length > 0 && (
        <Reveal index={1}>
          <Card title="Bought on the marketplace" subtitle="Copy a purchased dataset into this project to train on it. Its license travels with the data.">
            <ul className="divide-y divide-line">
              {notImported.map((x) => (
                <li key={x.id} className="flex flex-wrap items-center gap-3 py-3">
                  <Icon name="store" size={18} className="text-muted" />
                  <div className="min-w-0 flex-1">
                    <div className="font-medium">{x.title}</div>
                    <div className="text-xs text-muted">
                      by @{x.seller} · {x.images} images · {x.license.replace(/_/g, ' ')}
                    </div>
                  </div>
                  <Button size="sm" loading={importing === x.id} onClick={() => void doImport(x.id)}>
                    Import here
                  </Button>
                </li>
              ))}
            </ul>
          </Card>
        </Reveal>
      )}
      {has('marketplace_buy') && (
        <Alert tone="info">
          Need more data? <button type="button" className="font-semibold text-crimson cursor-pointer" onClick={() => navigate('/marketplace/datasets')}>Browse image datasets</button> from photographers and researchers, with clear licenses.
        </Alert>
      )}
      <CreateDatasetModal
        isOpen={creating}
        initialProject={p.id}
        projects={[{ value: p.id, label: p.name }]}
        onClose={() => setCreating(false)}
        onCreated={(dsId) => {
          setCreating(false);
          navigate(`/datasets/${dsId}`);
        }}
      />
    </div>
  );
}

function SettingsTab({ p, onSaved }: { p: Project; onSaved: () => void }) {
  const { navigate, user, has } = useHub();
  const notify = useNotify();
  const teams = useResource(() => api.teams(), 'teams');
  const areas = useResource(() => (has('research') ? api.areas() : Promise.resolve([])), `research-areas-${has('research')}`);
  const [form, setForm] = useState(p);
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [preview, setPreview] = useState(false);
  useEffect(() => setForm(p), [p]);
  const owner = p.role === 'owner' || !p.role;
  const canWrite = p.role !== 'viewer';
  const save = async (patch: Partial<Project> = {}) => {
    const next = { ...form, ...patch };
    setBusy(true);
    try {
      const body: Parameters<typeof api.studioUpdateProject>[1] = {
        name: next.name,
        description: next.description,
        notes: next.notes,
        is_public: next.is_public,
      };
      if (owner) body.team_id = next.team_id ?? '';
      body.area_id = next.area_id ?? '';
      const r = await api.studioUpdateProject(p.id, body);
      setForm(r);
      onSaved();
      notify('Project saved', 'success');
    } catch (err) {
      notify(errorMessage(err, "Couldn't save the project."), 'error');
    } finally {
      setBusy(false);
    }
  };
  const remove = async () => {
    try {
      await api.studioDeleteProject(p.id);
      notify('Project deleted', 'success');
      navigate('/projects');
    } catch (err) {
      notify(errorMessage(err, "Couldn't delete the project."), 'error');
    }
  };
  const publicUrl = user.username ? `${SITE_URL}/@${user.username}/${p.slug}` : null;
  const myTeams = (teams.data ?? []).filter((t) => t.my_status === 'active' && t.my_role !== 'viewer');
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card title="Details" className="lg:col-span-2">
        <div className="space-y-4">
          <Input label="Name" value={form.name} maxLength={80} disabled={!canWrite} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <Input label="Description" value={form.description} maxLength={300} disabled={!canWrite} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-sm font-medium">Notes and results</span>
              <button type="button" className="text-xs text-crimson cursor-pointer" onClick={() => setPreview((v) => !v)}>
                {preview ? 'Edit' : 'Preview'}
              </button>
            </div>
            {preview ? (
              <div className="min-h-40 rounded-control border border-line bg-page p-3">
                <Markdown text={form.notes || '_Nothing yet_'} />
              </div>
            ) : (
              <textarea
                className="w-full min-h-48 rounded-control border border-line-strong bg-card px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-focus"
                placeholder="What you tried, what worked, links to papers… Markdown works."
                value={form.notes}
                maxLength={20000}
                disabled={!canWrite}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            )}
          </div>
          {canWrite && (
            <div className="flex justify-end">
              <Button onClick={() => void save()} loading={busy}>
                Save
              </Button>
            </div>
          )}
        </div>
      </Card>
      <div className="space-y-4">
        <Card title="Sharing">
          <div className="space-y-4">
            {owner ? (
              <Select
                label="Team"
                value={form.team_id ?? ''}
                onChange={(e) => void save({ team_id: e.target.value || null })}
                options={[{ value: '', label: 'Only me' }, ...myTeams.map((t) => ({ value: t.id, label: t.name }))]}
              />
            ) : (
              <p className="text-sm text-muted">
                Owned by @{p.owner}
                {p.team_name ? `, shared with ${p.team_name}` : ''}. You are a{p.role === 'editor' ? 'n editor' : ' viewer'}.
              </p>
            )}
            {owner && myTeams.length === 0 && (
              <p className="text-xs text-muted">
                <button type="button" className="text-crimson cursor-pointer" onClick={() => navigate('/teams')}>
                  Create a team
                </button>{' '}
                to work on this project with others.
              </p>
            )}
            {(areas.data ?? []).length > 0 && canWrite && (
              <Select
                label="Research area"
                value={form.area_id ?? ''}
                onChange={(e) => void save({ area_id: e.target.value || null })}
                options={[{ value: '', label: 'None' }, ...(areas.data ?? []).map((a) => ({ value: a.id, label: a.name }))]}
              />
            )}
            {owner && (
              <Switch
                checked={form.is_public}
                onChange={(v) => void save({ is_public: v })}
                label="Show on my public profile"
                description={publicUrl ?? 'Pick a username in Settings first'}
              />
            )}
          </div>
        </Card>
        {owner && (
          <Card title="Danger zone">
            <p className="text-sm text-muted">Datasets and models stay in your account; they are just no longer grouped under this project.</p>
            <Button className="mt-3" variant="danger" icon="trash" onClick={() => setDeleting(true)}>
              Delete project
            </Button>
          </Card>
        )}
      </div>
      <ConfirmModal
        isOpen={deleting}
        title="Delete this project?"
        description="Datasets and models stay in your account; they are just no longer grouped under this project."
        confirmLabel="Delete project"
        danger
        onConfirm={remove}
        onCancel={() => setDeleting(false)}
      />
    </div>
  );
}
