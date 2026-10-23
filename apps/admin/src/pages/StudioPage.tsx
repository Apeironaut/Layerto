import { useRef, useState } from 'react';
import { errorMessage } from '@layerto/api-client';
import type { CustomModel, StudioOverview, TrainingJob } from '@layerto/types';
import {
  Alert,
  Button,
  Card,
  Chip,
  ConfirmModal,
  EmptyState,
  Modal,
  PageHeader,
  Reveal,
  SegmentedControl,
  Skeleton,
  StatCard,
  Table,
  THead,
  Th,
  Tr,
  Td,
  useNotify,
  useResource,
  usd,
} from '@layerto/ui';
import type { ChipVariant } from '@layerto/ui';
import { api } from '../lib/api';
import { PlatformSettings } from '../components/studio/PlatformSettings';
import { SITE_URL } from '../config';

type Tab = 'overview' | 'review' | 'training' | 'storage' | 'sites' | 'settings';

const fmtBytes = (n: number) => (n < 1024 ** 3 ? `${(n / 1024 ** 2).toFixed(1)} MB` : `${(n / 1024 ** 3).toFixed(2)} GB`);
const pct = (v?: number) => (typeof v === 'number' ? `${(v * 100).toFixed(1)}%` : '—');
const when = (s?: string | null) => (s ? new Date(s).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—');

const VIS: Record<CustomModel['visibility'], ChipVariant> = { private: 'muted', pending: 'pending', public: 'active', rejected: 'danger' };
const JOB: Record<TrainingJob['status'], ChipVariant> = { queued: 'pending', running: 'brand', succeeded: 'active', failed: 'danger', cancelled: 'muted' };

/** Everything users build in Studio: review, training, storage, sites and the rules. */
export function StudioPage() {
  const [tab, setTab] = useState<Tab>('overview');
  const overview = useResource(() => api.adminStudioOverview(), 'admin-studio-overview');
  const pending = overview.data?.models_pending_review ?? 0;
  return (
    <>
      <PageHeader title="Studio" description="Datasets, training, community models, model sites and plans." />
      <SegmentedControl
        label="Section"
        value={tab}
        onChange={setTab}
        segments={[
          { value: 'overview', label: 'Overview' },
          { value: 'review', label: pending ? `Review (${pending})` : 'Review' },
          { value: 'training', label: 'Training' },
          { value: 'storage', label: 'Storage' },
          { value: 'sites', label: 'Sites' },
          { value: 'settings', label: 'Settings' },
        ]}
      />
      {tab === 'overview' && <OverviewTab data={overview.data} loading={overview.loading} onGo={setTab} />}
      {tab === 'review' && <ReviewTab onChanged={() => void overview.reload()} />}
      {tab === 'training' && <TrainingTab packageReady={overview.data?.ltvision_package_ready ?? false} onChanged={() => void overview.reload()} />}
      {tab === 'storage' && <StorageTab />}
      {tab === 'sites' && <SitesTab />}
      {tab === 'settings' && <PlatformSettings />}
    </>
  );
}

function OverviewTab({ data, loading, onGo }: { data: StudioOverview | undefined; loading: boolean; onGo: (t: Tab) => void }) {
  if (loading || !data) return <Skeleton className="h-64" />;
  return (
    <Reveal index={0}>
      <div className="space-y-4">
        {!data.ltvision_package_ready && (
          <Alert tone="error">
            No LTVision training package uploaded yet, so trainings can't start. <button type="button" className="underline cursor-pointer" onClick={() => onGo('training')}>Upload it</button>.
          </Alert>
        )}
        {data.models_pending_review > 0 && (
          <Alert>
            {data.models_pending_review} model{data.models_pending_review === 1 ? '' : 's'} waiting for review.{' '}
            <button type="button" className="underline cursor-pointer" onClick={() => onGo('review')}>Review now</button>
          </Alert>
        )}
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
          <StatCard label="Datasets" value={data.datasets} hint={`${data.images.toLocaleString()} images · ${fmtBytes(data.storage_bytes)}`} />
          <StatCard label="Auto-delete scheduled" value={data.datasets_pending_delete} />
          <StatCard label="Trainings running / waiting" value={`${data.jobs_running} / ${data.jobs_queued}`} hint={`${data.jobs_succeeded_30d} finished in 30 days`} />
          <StatCard label="Custom models" value={data.custom_models} hint={`${data.public_models} published`} />
          <StatCard label="Model sites" value={data.sites} />
          <StatCard label="Paid plans" value={data.paid_plans} />
          <StatCard label="Creator rewards, 30d" value={usd(data.creator_rewards_30d_usd)} />
          <StatCard label="Training + plan revenue, 30d" value={usd(String(Number(data.training_revenue_30d_usd) + Number(data.plan_revenue_30d_usd)))} />
        </div>
      </div>
    </Reveal>
  );
}

function ReviewTab({ onChanged }: { onChanged: () => void }) {
  const notify = useNotify();
  const [status, setStatus] = useState('pending');
  const models = useResource(() => api.adminStudioModels(status), `admin-studio-models-${status}`);
  const [rejecting, setRejecting] = useState<CustomModel | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  const decide = async (m: CustomModel, decision: 'approve' | 'reject' | 'unpublish', n = '') => {
    setBusy(m.slug);
    try {
      await api.adminReviewModel(m.slug, decision, n);
      notify(decision === 'approve' ? `${m.name} is live` : decision === 'reject' ? 'Sent back to the creator' : 'Unpublished', 'success');
      setRejecting(null);
      setNote('');
      await models.reload();
      onChanged();
    } catch (err) {
      notify(errorMessage(err, 'Something went wrong.'), 'error');
    } finally {
      setBusy(null);
    }
  };

  return (
    <Reveal index={0}>
      <Card
        title="Community models"
        subtitle="Check the description is honest and the accuracy was measured, then approve. Approved models are callable by everyone and earn their creator a share."
        actions={
          <SegmentedControl
            label="Filter"
            value={status}
            onChange={setStatus}
            segments={[
              { value: 'pending', label: 'Waiting' },
              { value: 'public', label: 'Live' },
              { value: 'rejected', label: 'Rejected' },
              { value: 'all', label: 'All' },
            ]}
          />
        }
      >
        {models.loading ? (
          <Skeleton className="h-32" />
        ) : (models.data ?? []).length === 0 ? (
          <EmptyState icon="store" title="Nothing here" />
        ) : (
          <ul className="divide-y divide-line">
            {(models.data ?? []).map((m) => (
              <li key={m.id} className="py-4 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <strong className="text-ink">{m.name}</strong>
                  <span className="font-mono text-xs text-muted">{m.slug}</span>
                  <Chip variant={VIS[m.visibility]}>{m.visibility}</Chip>
                  <span className="text-xs text-muted">by {m.owner} · {usd(m.price_usd)}/call · {m.license || 'no license'}</span>
                </div>
                <p className="text-sm text-ink-secondary whitespace-pre-line">{m.description || <em>No description</em>}</p>
                <p className="text-xs text-muted">
                  mAP {pct(m.metrics.map50_95)} · mAP50 {pct(m.metrics.map50)} · size {m.metrics.size ?? '—'} · {m.classes.length} classes: {m.classes.slice(0, 12).join(', ')}
                  {m.classes.length > 12 ? '…' : ''} · {m.calls_30d} {m.calls_30d === 1 ? "call" : "calls"} in 30 days
                </p>
                {m.review_note && <p className="text-xs text-muted">Note: {m.review_note}</p>}
                <div className="flex gap-2">
                  {m.visibility === 'pending' && (
                    <>
                      <Button size="sm" icon="check" loading={busy === m.slug} onClick={() => decide(m, 'approve')}>Approve</Button>
                      <Button size="sm" variant="outline" onClick={() => setRejecting(m)}>Reject</Button>
                    </>
                  )}
                  {m.visibility === 'public' && (
                    <Button size="sm" variant="outline" loading={busy === m.slug} onClick={() => decide(m, 'unpublish')}>Unpublish</Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <Modal isOpen={rejecting !== null} onClose={() => setRejecting(null)} title={`Reject ${rejecting?.name ?? ''}`} description="The creator sees this note and can fix the listing and resubmit.">
        <div className="space-y-4">
          <textarea
            className="w-full min-h-24 rounded-control border border-line-strong bg-card px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-focus"
            value={note}
            maxLength={500}
            placeholder="e.g. The description claims medical diagnosis; please describe what it actually detects."
            onChange={(e) => setNote(e.target.value)}
          />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setRejecting(null)}>Cancel</Button>
            <Button variant="danger" disabled={!note.trim()} loading={busy === rejecting?.slug} onClick={() => rejecting && decide(rejecting, 'reject', note.trim())}>Reject</Button>
          </div>
        </div>
      </Modal>
    </Reveal>
  );
}

function TrainingTab({ packageReady, onChanged }: { packageReady: boolean; onChanged: () => void }) {
  const notify = useNotify();
  const [status, setStatus] = useState('all');
  const jobs = useResource(() => api.adminStudioJobs(status), `admin-studio-jobs-${status}`);
  const [cancelling, setCancelling] = useState<TrainingJob | null>(null);
  const [uploading, setUploading] = useState(false);
  const file = useRef<HTMLInputElement>(null);

  const upload = async (f: File) => {
    setUploading(true);
    try {
      const res = await api.adminUploadLTVision(f);
      notify(`LTVision package saved (${fmtBytes(res.bytes)})`, 'success');
      onChanged();
    } catch (err) {
      notify(errorMessage(err, "Couldn't upload the package."), 'error');
    } finally {
      setUploading(false);
    }
  };

  const cancel = async () => {
    if (!cancelling) return;
    try {
      await api.adminCancelJob(cancelling.id);
      notify('Training cancelled; any GPU charge was refunded', 'success');
      await jobs.reload();
      onChanged();
    } catch (err) {
      notify(errorMessage(err, "Couldn't cancel."), 'error');
    } finally {
      setCancelling(null);
    }
  };

  return (
    <Reveal index={0}>
      <div className="space-y-4">
        <Card
          title="LTVision training package"
          subtitle="The zip with train.py that every training run downloads (notebooks and GPU workers). Upload a new one to update the trainer for all future runs."
          actions={packageReady ? <Chip variant="active">Uploaded</Chip> : <Chip variant="danger">Missing</Chip>}
        >
          <div className="flex flex-wrap items-center gap-3">
            <Button icon="upload" loading={uploading} onClick={() => file.current?.click()}>Upload zip</Button>
            <span className="text-xs text-muted">Max 100 MB. Must contain train.py.</span>
            <input
              ref={file}
              type="file"
              accept=".zip,application/zip"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void upload(f);
                e.target.value = '';
              }}
            />
          </div>
        </Card>
        <Card
          title="Training runs"
          padded={false}
          actions={
            <SegmentedControl
              label="Status"
              value={status}
              onChange={setStatus}
              segments={[
                { value: 'all', label: 'All' },
                { value: 'running', label: 'Running' },
                { value: 'queued', label: 'Waiting' },
                { value: 'failed', label: 'Failed' },
              ]}
            />
          }
        >
          {jobs.loading ? (
            <Skeleton className="h-32 m-5" />
          ) : (jobs.data ?? []).length === 0 ? (
            <EmptyState icon="cpu" title="No runs" />
          ) : (
            <Table label="Training runs">
              <THead>
                <Th>Run</Th>
                <Th>Owner</Th>
                <Th>Runner</Th>
                <Th>Status</Th>
                <Th>Progress</Th>
                <Th>Charged</Th>
                <Th>Created</Th>
                <Th />
              </THead>
              <tbody>
                {(jobs.data ?? []).map((j) => (
                  <Tr key={j.id}>
                    <Td>
                      <span className="font-medium text-ink">{j.name}</span>
                      <span className="block text-xs text-muted">{j.preset} · {j.params.size.toUpperCase()} · {j.params.epochs} ep · {j.params.img}px</span>
                    </Td>
                    <Td>{j.owner}</Td>
                    <Td>{j.runner === 'layerto' ? 'Layerto GPU' : 'Notebook'}</Td>
                    <Td>
                      <Chip variant={JOB[j.status]}>{j.status}</Chip>
                      {j.error && <span className="block text-xs text-crimson max-w-56 truncate" title={j.error}>{j.error}</span>}
                    </Td>
                    <Td className="font-mono text-xs">
                      {j.progress.epoch ?? 0}/{j.progress.epochs ?? j.params.epochs} · mAP {pct(j.progress.map50_95)}
                    </Td>
                    <Td>{usd(j.charged_usd)}</Td>
                    <Td className="text-xs">{when(j.created_at)}</Td>
                    <Td>
                      {(j.status === 'queued' || j.status === 'running') && (
                        <Button size="sm" variant="ghost" onClick={() => setCancelling(j)}>Cancel</Button>
                      )}
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>
      </div>
      <ConfirmModal
        isOpen={cancelling !== null}
        title="Cancel this training?"
        description="The run stops and a Layerto GPU charge is refunded to the user."
        confirmLabel="Cancel training"
        danger
        onConfirm={cancel}
        onCancel={() => setCancelling(null)}
      />
    </Reveal>
  );
}

function StorageTab() {
  const notify = useNotify();
  const datasets = useResource(() => api.adminStudioDatasets(), 'admin-studio-datasets');
  const [purging, setPurging] = useState<{ id: string; name: string } | null>(null);
  const purge = async () => {
    if (!purging) return;
    try {
      await api.adminPurgeDataset(purging.id);
      notify('Images deleted', 'success');
      await datasets.reload();
    } catch (err) {
      notify(errorMessage(err, "Couldn't delete."), 'error');
    } finally {
      setPurging(null);
    }
  };
  return (
    <Reveal index={0}>
      <Card
        title="Datasets"
        subtitle="Images are encrypted at rest. Admins can't view them here; you can only delete them (for abuse reports or takedowns)."
        padded={false}
      >
        {datasets.loading ? (
          <Skeleton className="h-32 m-5" />
        ) : (datasets.data ?? []).length === 0 ? (
          <EmptyState icon="database" title="No datasets" />
        ) : (
          <Table label="Datasets">
            <THead>
              <Th>Dataset</Th>
              <Th>Owner</Th>
              <Th>Images</Th>
              <Th>Size</Th>
              <Th>Retention</Th>
              <Th />
            </THead>
            <tbody>
              {(datasets.data ?? []).map((d) => (
                <Tr key={d.id}>
                  <Td className="font-medium text-ink">{d.name}</Td>
                  <Td>{d.owner}</Td>
                  <Td>{d.labeled}/{d.images}</Td>
                  <Td>{fmtBytes(d.bytes)}</Td>
                  <Td className="text-xs">
                    {d.purged_at ? <Chip variant="muted">deleted</Chip> : d.keep ? <Chip variant="active">kept</Chip> : <>deletes {when(d.delete_after)}</>}
                  </Td>
                  <Td>{!d.purged_at && <Button size="sm" variant="ghost" icon="trash" onClick={() => setPurging(d)}>Delete images</Button>}</Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
      <ConfirmModal
        isOpen={purging !== null}
        title={`Delete the images of “${purging?.name}”?`}
        description="The images and boxes are deleted now. Models trained from them keep working."
        confirmLabel="Delete images"
        danger
        onConfirm={purge}
        onCancel={() => setPurging(null)}
      />
    </Reveal>
  );
}

function SitesTab() {
  const notify = useNotify();
  const sites = useResource(() => api.adminStudioSites(), 'admin-studio-sites');
  const toggle = async (id: string, disabled: boolean) => {
    try {
      await api.adminDisableSite(id, disabled);
      notify(disabled ? 'Site disabled' : 'Site enabled', 'success');
      await sites.reload();
    } catch (err) {
      notify(errorMessage(err, "Couldn't update the site."), 'error');
    }
  };
  return (
    <Reveal index={0}>
      <Card title="Model sites" padded={false}>
        {sites.loading ? (
          <Skeleton className="h-32 m-5" />
        ) : (sites.data ?? []).length === 0 ? (
          <EmptyState icon="globe" title="No sites" />
        ) : (
          <Table label="Model sites">
            <THead>
              <Th>Site</Th>
              <Th>Owner</Th>
              <Th>Model</Th>
              <Th>This month</Th>
              <Th>Status</Th>
              <Th />
            </THead>
            <tbody>
              {(sites.data ?? []).map((s) => (
                <Tr key={s.id}>
                  <Td>
                    <a href={`${SITE_URL}/s/${s.slug}`} target="_blank" rel="noopener noreferrer" className="font-medium text-crimson">{s.title}</a>
                    <span className="block font-mono text-xs text-muted">/s/{s.slug}</span>
                  </Td>
                  <Td>{s.owner}</Td>
                  <Td>{s.model_name}</Td>
                  <Td>{usd(s.spent_this_month_usd)} / {usd(s.monthly_cap_usd)}</Td>
                  <Td>{s.disabled_by_admin ? <Chip variant="danger">disabled</Chip> : s.published ? <Chip variant="active">live</Chip> : <Chip variant="muted">draft</Chip>}</Td>
                  <Td>
                    <Button size="sm" variant={s.disabled_by_admin ? 'secondary' : 'ghost'} onClick={() => toggle(s.id, !s.disabled_by_admin)}>
                      {s.disabled_by_admin ? 'Enable' : 'Disable'}
                    </Button>
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </Reveal>
  );
}

