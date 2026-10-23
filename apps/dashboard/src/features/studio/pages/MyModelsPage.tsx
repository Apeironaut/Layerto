import { useEffect, useState } from 'react';
import { errorMessage } from '@layerto/api-client';
import type { CustomModel, VisionResponse } from '@layerto/types';
import {
  Alert,
  BoundingBoxCanvas,
  Button,
  Card,
  Chip,
  ConfirmModal,
  CopyButton,
  Drawer,
  EmptyState,
  Input,
  MetricsPanel,
  Modal,
  PageHeader,
  Select,
  Reveal,
  SegmentedControl,
  Skeleton,
  StatCard,
  UploadZone,
  useNotify,
  useResource,
  usd,
} from '@layerto/ui';
import type { ChipVariant } from '@layerto/ui';
import { api } from '../../../lib/api';
import { PUBLIC_API_URL } from '../../../config';
import { pct, shortDate } from '../lib/format';

export const VISIBILITY: Record<CustomModel['visibility'], { label: string; variant: ChipVariant }> = {
  private: { label: 'Private', variant: 'muted' },
  pending: { label: 'In review', variant: 'pending' },
  public: { label: 'Published', variant: 'active' },
  rejected: { label: 'Changes needed', variant: 'danger' },
};

export function MyModelsPage({
  navigate,
  onCharged,
  projectId,
  embedded = false,
}: {
  navigate: (to: string) => void;
  onCharged: () => void;
  projectId?: string;
  embedded?: boolean;
}) {
  const models = useResource(() => api.studioModels(projectId), `studio-models-${projectId ?? 'mine'}`);
  const earnings = useResource(() => api.studioEarnings(), 'studio-earnings');
  const [open, setOpen] = useState<string | null>(() => new URLSearchParams(window.location.search).get('m'));
  const [importing, setImporting] = useState(false);
  const current = (models.data ?? []).find((m) => m.slug === open) ?? null;

  return (
    <>
      {!embedded && (
        <PageHeader
          title="Models"
          description="Every model you trained or imported, each with its own API. Publish to the marketplace and earn every time someone else calls it."
          actions={
            <div className="flex gap-2">
              <Button variant="secondary" icon="upload" onClick={() => setImporting(true)}>Import weights</Button>
              <Button icon="globe" variant="ghost" onClick={() => navigate('/models/sites')}>Model sites</Button>
            </div>
          }
        />
      )}
      {embedded && (
        <div className="flex justify-end">
          <Button size="sm" variant="secondary" icon="upload" onClick={() => setImporting(true)}>Import weights</Button>
        </div>
      )}
      {!embedded && (
        <Reveal index={0}>
          <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
            <StatCard label="Model earnings, all time" value={earnings.data ? usd(earnings.data.total_usd) : '—'} loading={earnings.loading} hint={earnings.data ? `${earnings.data.share_percent}% of each paid call by others` : undefined} />
            <StatCard label="This month" value={earnings.data ? usd(earnings.data.this_month_usd) : '—'} loading={earnings.loading} />
            <StatCard label="Paid calls by others" value={earnings.data?.paid_calls ?? '—'} loading={earnings.loading} />
            <StatCard label="Dataset sales" value={earnings.data ? usd(earnings.data.datasets_total_usd) : '—'} loading={earnings.loading} hint={earnings.data ? `${earnings.data.dataset_sales} sold` : undefined} />
          </div>
        </Reveal>
      )}
      <Reveal index={1}>
        {models.loading ? (
          <Skeleton className="h-40" />
        ) : (models.data ?? []).length === 0 ? (
          <Card>
            <EmptyState
              icon="box"
              title="No models yet"
              description="Train on one of your datasets and the result shows up here with its own API."
              action={<Button icon="folder" onClick={() => navigate(projectId ? `/projects/${projectId}/train` : '/projects')}>Train in a project</Button>}
            />
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {(models.data ?? []).map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setOpen(m.slug)}
                className="text-left rounded-l2 border border-line bg-card p-5 shadow-l1 hover:border-crimson transition-colors cursor-pointer"
              >
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold text-ink">{m.name}</h3>
                  <Chip variant={VISIBILITY[m.visibility].variant}>{VISIBILITY[m.visibility].label}</Chip>
                </div>
                <p className="mt-1 font-mono text-xs text-muted truncate">{m.slug}</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {m.size && <Chip variant="neutral">LTVision-{m.size.toUpperCase()}</Chip>}
                  {m.source === 'imported' && <Chip variant="pending">Imported</Chip>}
                  {m.data_license === 'research_only' && <Chip variant="muted">Research-only data</Chip>}
                  {m.owner && embedded && <Chip variant="neutral">@{m.owner}</Chip>}
                </div>
                <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                  <Metric label="mAP" value={pct(m.metrics.map50_95)} />
                  <Metric label="mAP50" value={pct(m.metrics.map50)} />
                  <Metric label="Calls 30d" value={String(m.calls_30d)} />
                </div>
                <p className="mt-3 text-xs text-muted">{m.classes.length} classes · {usd(m.price_usd)} per call · earned {usd(m.earned_usd)}</p>
              </button>
            ))}
          </div>
        )}
      </Reveal>
      {current && (
        <ModelDrawer
          model={current}
          onClose={() => setOpen(null)}
          onChanged={() => void models.reload()}
          onCharged={onCharged}
          onSite={() => navigate(`/models/sites?model=${current.slug}`)}
          onFineTune={() => navigate(`/projects/${current.project_id ?? ''}${current.project_id ? '/train' : ''}?base=${current.slug}`)}
        />
      )}
      <ImportModal
        open={importing}
        projectId={projectId}
        onClose={() => setImporting(false)}
        onDone={(slug) => {
          setImporting(false);
          void models.reload();
          setOpen(slug);
        }}
      />
    </>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-control bg-page py-2">
      <p className="text-sm font-semibold text-ink">{value}</p>
      <p className="text-[11px] text-muted">{label}</p>
    </div>
  );
}

type Tab = 'overview' | 'test' | 'api' | 'listing';

function ModelDrawer({
  model,
  onClose,
  onChanged,
  onCharged,
  onSite,
  onFineTune,
}: {
  model: CustomModel;
  onClose: () => void;
  onChanged: () => void;
  onCharged: () => void;
  onSite: () => void;
  onFineTune: () => void;
}) {
  const [tab, setTab] = useState<Tab>('overview');
  const v = VISIBILITY[model.visibility];
  return (
    <Drawer
      isOpen
      onClose={onClose}
      title={model.name}
      description={<span className="font-mono">{model.slug}</span>}
      className="max-w-2xl"
    >
      <div className="space-y-5">
        <div className="flex flex-wrap items-center gap-2">
          <Chip variant={v.variant}>{v.label}</Chip>
          <Chip variant="neutral">{usd(model.price_usd)} per call</Chip>
          <Chip variant="neutral">trained {shortDate(model.created_at)}</Chip>
        </div>
        <SegmentedControl
          label="Section"
          value={tab}
          onChange={setTab}
          segments={[
            { value: 'overview', label: 'Overview' },
            { value: 'test', label: 'Test' },
            { value: 'api', label: 'API' },
            { value: 'listing', label: 'Publish' },
          ]}
        />
        {tab === 'overview' && <Overview model={model} onSite={onSite} onFineTune={onFineTune} onDeleted={() => (onChanged(), onClose())} />}
        {tab === 'test' && <TestModel model={model} onCharged={onCharged} />}
        {tab === 'api' && <ApiTab model={model} />}
        {tab === 'listing' && <Listing model={model} onChanged={onChanged} />}
      </div>
    </Drawer>
  );
}

function Overview({ model, onSite, onFineTune, onDeleted }: { model: CustomModel; onSite: () => void; onFineTune: () => void; onDeleted: () => void }) {
  const notify = useNotify();
  const [deleting, setDeleting] = useState(false);
  const remove = async () => {
    try {
      await api.studioDeleteModel(model.slug);
      notify('Model deleted', 'success');
      onDeleted();
    } catch (err) {
      notify(errorMessage(err, "Couldn't delete the model."), 'error');
    } finally {
      setDeleting(false);
    }
  };
  return (
    <div className="space-y-5">
      <MetricsPanel metrics={model.metrics} history={model.history} source={model.source} />
      <div>
        <p className="text-sm font-medium text-ink mb-2">Classes</p>
        <div className="flex flex-wrap gap-1.5">{model.classes.map((c) => <Chip key={c} variant="neutral">{c}</Chip>)}</div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <StatCard label="Calls, 30 days" value={model.calls_30d} />
        <StatCard label="Earned from others" value={usd(model.earned_usd)} />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" icon="cpu" onClick={onFineTune}>Fine-tune on more data</Button>
        <Button variant="secondary" icon="globe" onClick={onSite}>Make a website</Button>
        <Button variant="ghost" icon="trash" onClick={() => setDeleting(true)}>Delete model</Button>
      </div>
      <ConfirmModal
        isOpen={deleting}
        title="Delete this model?"
        description="Its API stops working right away for you and anyone using it. Sites using it go offline."
        confirmLabel="Delete model"
        danger
        onConfirm={remove}
        onCancel={() => setDeleting(false)}
      />
    </div>
  );
}

function TestModel({ model, onCharged }: { model: CustomModel; onCharged: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [result, setResult] = useState<VisionResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => () => {
    if (url) URL.revokeObjectURL(url);
  }, [url]);
  const run = async () => {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      setResult(await api.runPlayground(model.slug, file));
      onCharged();
    } catch (err) {
      setError(errorMessage(err, "Couldn't run the model."));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="space-y-4">
      <UploadZone
        onFile={(f) => {
          setFile(f);
          setResult(null);
          setUrl(URL.createObjectURL(f));
        }}
        onInvalid={setError}
        disabled={busy}
      />
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm text-muted truncate">{file?.name ?? 'No image yet'}</span>
        <Button icon="spark" disabled={!file} loading={busy} onClick={run}>Run · {usd(model.price_usd)}</Button>
      </div>
      {error && <Alert tone="error">{error}</Alert>}
      {url && <BoundingBoxCanvas imageSrc={url} predictions={result?.predictions ?? []} confidenceThreshold={0.25} />}
      {result && (
        <pre className="max-h-64 overflow-auto rounded-control border border-line bg-page p-3 font-mono text-xs" tabIndex={0}>
          {JSON.stringify(result.predictions, null, 2)}
        </pre>
      )}
    </div>
  );
}

function ApiTab({ model }: { model: CustomModel }) {
  const curl = `curl -X POST "${PUBLIC_API_URL}/v1/vision/${model.slug}" \\\n  -H "Authorization: Bearer $LAYERTO_KEY" \\\n  -F "image=@photo.jpg"`;
  const py = `import requests\n\nr = requests.post(\n    "${PUBLIC_API_URL}/v1/vision/${model.slug}",\n    headers={"Authorization": "Bearer " + LAYERTO_KEY},\n    files={"image": open("photo.jpg", "rb")},\n)\nprint(r.json()["predictions"])`;
  return (
    <div className="space-y-4">
      <p className="text-sm text-ink-secondary">
        {model.visibility === 'public'
          ? 'Anyone with a Layerto key can call this model. You get your share of every call made by others.'
          : 'Only your own API keys can call this model until it is published.'}
      </p>
      {[['cURL', curl], ['Python', py]].map(([label, code]) => (
        <Card key={label} level="l2" title={label} actions={<CopyButton text={code} />}>
          <pre className="overflow-x-auto font-mono text-xs" tabIndex={0}>{code}</pre>
        </Card>
      ))}
      <p className="text-xs text-muted">Images you send are processed in memory and never stored.</p>
    </div>
  );
}

function Listing({ model, onChanged }: { model: CustomModel; onChanged: () => void }) {
  const notify = useNotify();
  const [name, setName] = useState(model.name);
  const [description, setDescription] = useState(model.description);
  const [license, setLicense] = useState(model.license);
  const [price, setPrice] = useState(model.price_usd);
  const [busy, setBusy] = useState<string | null>(null);

  const act = async (what: string, fn: () => Promise<unknown>, ok: string) => {
    setBusy(what);
    try {
      await fn();
      notify(ok, 'success');
      onChanged();
    } catch (err) {
      notify(errorMessage(err, 'Something went wrong.'), 'error');
    } finally {
      setBusy(null);
    }
  };

  const dirty = name !== model.name || description !== model.description || license !== model.license || price !== model.price_usd;
  return (
    <div className="space-y-4">
      {model.visibility === 'rejected' && model.review_note && <Alert tone="error">Reviewer: {model.review_note}</Alert>}
      {model.visibility === 'pending' && <Alert>{model.review_note || 'Waiting for a Layerto reviewer. This usually takes a day or two.'}</Alert>}
      <Input label="Name" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} />
      <label className="block">
        <span className="block text-sm font-medium text-ink mb-1.5">Description</span>
        <textarea
          className="w-full min-h-28 rounded-control border border-line-strong bg-card px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-focus"
          placeholder="What it detects, what images it works best on, known limits."
          value={description}
          maxLength={2000}
          onChange={(e) => setDescription(e.target.value)}
        />
        <span className="text-xs text-muted">{description.trim().length} / 20 characters minimum to publish</span>
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <Input label="License for your weights" placeholder="e.g. CC BY 4.0" value={license} maxLength={80} onChange={(e) => setLicense(e.target.value)} />
        <Input label="Price per call (USD)" value={price} onChange={(e) => setPrice(e.target.value)} helperText="You earn your share of this on others' calls." />
      </div>
      {model.visibility === 'public' && dirty && <Alert>Saving changes sends the model back for a quick review.</Alert>}
      <div className="flex flex-wrap justify-end gap-2">
        <Button
          variant="secondary"
          disabled={!dirty}
          loading={busy === 'save'}
          onClick={() => act('save', () => api.studioUpdateModel(model.slug, { name, description, license, price_usd: price }), 'Saved')}
        >
          Save
        </Button>
        {model.visibility === 'private' || model.visibility === 'rejected' ? (
          <Button
            icon="store"
            disabled={dirty}
            loading={busy === 'pub'}
            onClick={() => act('pub', () => api.studioPublishModel(model.slug), 'Sent for review')}
          >
            Publish to marketplace
          </Button>
        ) : (
          <Button variant="outline" loading={busy === 'unpub'} onClick={() => act('unpub', () => api.studioUnpublishModel(model.slug), 'Unpublished')}>
            Unpublish
          </Button>
        )}
      </div>
      <p className="text-xs text-muted">
        Rewards are added to your Layerto balance as credit, which you can spend on API calls, training and plans. Cash payouts are planned for later.
      </p>
    </div>
  );
}

function ImportModal({ open, projectId, onClose, onDone }: { open: boolean; projectId?: string; onClose: () => void; onDone: (slug: string) => void }) {
  const notify = useNotify();
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState('');
  const [classes, setClasses] = useState('');
  const [size, setSize] = useState('m');
  const [map, setMap] = useState('');
  const [map50, setMap50] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    if (!file) return;
    setBusy(true);
    try {
      const metrics: Record<string, number> = {};
      if (map) metrics.map50_95 = Number(map) / 100;
      if (map50) metrics.map50 = Number(map50) / 100;
      const m = await api.importModel({
        weights: file,
        name: name.trim(),
        classes: classes.split(/[,\n]/).map((c) => c.trim()).filter(Boolean),
        size,
        metrics,
        project_id: projectId,
      });
      notify('Model imported', 'success');
      onDone(m.slug);
    } catch (err) {
      notify(errorMessage(err, "Couldn't import the weights."), 'error');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal isOpen={open} onClose={onClose} title="Import LTVision weights" description="Bring a best.pt you trained elsewhere. It gets an API like any Layerto model; its metrics are marked self-reported." size="lg">
      <div className="space-y-4">
        <label className="block rounded-l2 border-2 border-dashed border-line-strong p-5 text-center cursor-pointer hover:border-crimson">
          <input type="file" accept=".pt,.pth" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          <span className="text-sm font-medium">{file ? file.name : 'Choose best.pt (up to 1 GB)'}</span>
          <span className="block text-xs text-muted mt-1">Only LTVision weights are supported for now.</span>
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Name" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} />
          <Select label="LTVision size" value={size} onChange={(e) => setSize(e.target.value)} options={['n', 's', 'm', 'l', 'x', 'xl', 'xxl'].map((x) => ({ value: x, label: x.toUpperCase() }))} />
        </div>
        <label className="block">
          <span className="block text-sm font-medium mb-1.5">Classes, in training order</span>
          <textarea value={classes} onChange={(e) => setClasses(e.target.value)} placeholder="car, bus, truck" className="w-full min-h-16 rounded-control border border-line-strong bg-card px-3 py-2 text-sm" />
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="mAP 50–95 (%), optional" type="number" min={0} max={100} value={map} onChange={(e) => setMap(e.target.value)} />
          <Input label="mAP 50 (%), optional" type="number" min={0} max={100} value={map50} onChange={(e) => setMap50(e.target.value)} />
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button icon="upload" loading={busy} disabled={!file || !name.trim() || !classes.trim()} onClick={submit}>Import</Button>
        </div>
      </div>
    </Modal>
  );
}
