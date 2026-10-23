import { useEffect, useMemo, useState } from 'react';
import { errorMessage } from '@layerto/api-client';
import type { Augment, CreateJobParams, TrainEstimate, TrainParams, TrainPreset, TrainRunner, TrainingJob } from '@layerto/types';
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
  Modal,
  PageHeader,
  ProgressBar,
  Reveal,
  SegmentedControl,
  Select,
  Skeleton,
  Switch,
  cn,
  useNotify,
  useResource,
  usd,
} from '@layerto/ui';
import type { ChipVariant } from '@layerto/ui';
import { api } from '../../../lib/api';
import { dateTime, pct } from '../lib/format';

const PRESETS: { value: TrainPreset; label: string; hint: string }[] = [
  { value: 'fast', label: 'Fast', hint: 'Size S · 60 epochs · 640 px. Good first try.' },
  { value: 'balanced', label: 'Balanced', hint: 'Size M · 120 epochs · 640 px. Best value for most datasets.' },
  { value: 'best', label: 'Best', hint: 'Size L · 200 epochs · 800 px. Slower, for when accuracy matters most.' },
  { value: 'custom', label: 'Custom', hint: 'Choose every setting yourself.' },
];

const DEFAULT_CUSTOM: TrainParams = { size: 'm', epochs: 100, img: 640, p2: false, patience: 30, eval_every: 5, close_mosaic: 10 };
const AUG_DEFAULTS: Required<Omit<Augment, 'multiscale'>> & { multiscale: boolean } = {
  flip: 0.5,
  mosaic: 1,
  mixup: 0,
  degrees: 0,
  scale: 0.5,
  translate: 0.1,
  hsv: 1,
  multiscale: false,
};

const STATUS: Record<TrainingJob['status'], { label: string; variant: ChipVariant }> = {
  queued: { label: 'Waiting', variant: 'pending' },
  running: { label: 'Training', variant: 'brand' },
  succeeded: { label: 'Done', variant: 'active' },
  failed: { label: 'Failed', variant: 'danger' },
  cancelled: { label: 'Cancelled', variant: 'muted' },
};

async function downloadNotebook(job: TrainingJob) {
  const blob = await api.studioNotebook(job.id);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `layerto-train-${job.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40)}.ipynb`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/** Train LTVision on a project's labeled datasets (Layerto GPUs or your own notebook) and follow the runs. */
export function TrainingPage({ navigate, onCharged, projectId, embedded = false }: { navigate: (to: string) => void; onCharged: () => void; projectId?: string; embedded?: boolean }) {
  const notify = useNotify();
  const jobs = useResource(() => api.studioJobs(projectId), `studio-jobs-${projectId ?? 'all'}`);
  const [notebookFor, setNotebookFor] = useState<TrainingJob | null>(null);
  const [cancelling, setCancelling] = useState<TrainingJob | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const active = (jobs.data ?? []).some((j) => j.status === 'queued' || j.status === 'running');
  const reload = jobs.reload;
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => void reload(), 5000);
    return () => clearInterval(t);
  }, [active, reload]);

  const cancel = async () => {
    if (!cancelling) return;
    try {
      await api.studioCancelJob(cancelling.id);
      notify(cancelling.runner === 'layerto' ? 'Training cancelled and refunded' : 'Training cancelled', 'success');
      onCharged();
      await jobs.reload();
    } catch (err) {
      notify(errorMessage(err, "Couldn't cancel."), 'error');
    } finally {
      setCancelling(null);
    }
  };

  return (
    <>
      {!embedded && (
        <PageHeader
          title="Training"
          description="Train an LTVision detector on your labeled data, on Layerto GPUs or free in your own Colab or Kaggle notebook. The result is a private model with its own API."
        />
      )}
      <Reveal index={0}>
        <NewTraining
          projectId={projectId}
          onCreated={(job) => {
            void jobs.reload();
            onCharged();
            if (job.runner === 'notebook') setNotebookFor(job);
            else notify('Training queued. You can leave this page; it keeps going.', 'success');
          }}
        />
      </Reveal>
      <Reveal index={1}>
        <Card title="Runs" padded={false} className={embedded ? 'mt-6' : undefined}>
          {jobs.loading ? (
            <Skeleton className="h-32 m-5" />
          ) : (jobs.data ?? []).length === 0 ? (
            <EmptyState icon="cpu" title="No training runs yet" description="Your runs, their progress and learning curves show up here." />
          ) : (
            <ul className="divide-y divide-line">
              {(jobs.data ?? []).map((j) => (
                <JobRow
                  key={j.id}
                  job={j}
                  expanded={expanded === j.id}
                  onToggle={() => setExpanded(expanded === j.id ? null : j.id)}
                  onNotebook={() => setNotebookFor(j)}
                  onCancel={() => setCancelling(j)}
                  onModel={() => navigate(`/models?m=${j.model_slug}`)}
                />
              ))}
            </ul>
          )}
        </Card>
      </Reveal>
      <NotebookModal job={notebookFor} onClose={() => setNotebookFor(null)} />
      <ConfirmModal
        isOpen={cancelling !== null}
        title="Cancel this training?"
        description={cancelling?.runner === 'layerto' ? 'The GPU charge (or prepaid GPU hours) is returned to you.' : 'The notebook link stops working.'}
        confirmLabel="Cancel training"
        danger
        onConfirm={cancel}
        onCancel={() => setCancelling(null)}
      />
    </>
  );
}

function JobRow({
  job,
  expanded,
  onToggle,
  onNotebook,
  onCancel,
  onModel,
}: {
  job: TrainingJob;
  expanded: boolean;
  onToggle: () => void;
  onNotebook: () => void;
  onCancel: () => void;
  onModel: () => void;
}) {
  const s = STATUS[job.status];
  const ep = job.progress.epoch ?? 0;
  const eps = job.progress.epochs ?? job.params.epochs;
  const live = job.status === 'queued' || job.status === 'running';
  const curve = (job.history ?? []).filter((p) => typeof p.map50_95 === 'number');
  const aug = job.params.augment;
  return (
    <li className="px-5 py-4 space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={onToggle} className="min-w-0 flex-1 text-left cursor-pointer" aria-expanded={expanded}>
          <p className="font-medium text-ink truncate flex items-center gap-2">
            <Icon name="chevronRight" size={14} className={cn('text-muted transition-transform', expanded && 'rotate-90')} />
            {job.name}
            {job.params.base_model && <Chip variant="neutral">fine-tune</Chip>}
          </p>
          <p className="text-xs text-muted pl-5">
            {job.dataset_name} · {job.preset} · LTVision-{job.params.size.toUpperCase()} · {job.params.img} px ·{' '}
            {job.runner === 'layerto' ? (job.gpu_hours_used > 0 ? `Layerto GPU · ${job.gpu_hours_used.toFixed(2)} prepaid h` : `Layerto GPU · ${usd(job.charged_usd)}`) : 'Your notebook · free'} ·{' '}
            {dateTime(job.created_at)}
            {job.owner ? ` · @${job.owner}` : ''}
          </p>
        </button>
        <Chip variant={s.variant}>{s.label}</Chip>
        {typeof job.progress.map50_95 === 'number' && <Chip variant="neutral">mAP {pct(job.progress.map50_95)}</Chip>}
        <div className="flex gap-2">
          {live && job.runner === 'notebook' && (
            <Button size="sm" variant="secondary" icon="download" onClick={onNotebook}>
              Notebook
            </Button>
          )}
          {live && (
            <Button size="sm" variant="ghost" onClick={onCancel}>
              Cancel
            </Button>
          )}
          {job.status === 'succeeded' && job.model_slug && (
            <Button size="sm" icon="box" onClick={onModel}>
              Open model
            </Button>
          )}
        </div>
      </div>
      {job.status === 'running' && (
        <div className="space-y-1.5">
          <p className="text-xs text-muted">
            Epoch {ep} of {eps}
            {job.progress.message ? ` · ${job.progress.message}` : ''}
          </p>
          <ProgressBar label={`Epoch ${ep} of ${eps}`} current={ep} max={eps || 1} />
        </div>
      )}
      {job.status === 'queued' && (
        <p className="text-xs text-muted">{job.runner === 'notebook' ? 'Waiting for your notebook to start. Download it and run all cells.' : 'Waiting for a free GPU.'}</p>
      )}
      {job.status === 'failed' && job.error && <Alert tone="error">{job.error}</Alert>}
      {(expanded || (job.status === 'running' && curve.length > 1)) && (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <LineChart
            series={[{ name: 'mAP 50–95', points: curve.map((p) => ({ x: p.epoch, y: p.map50_95 as number })) }]}
            height={180}
            emptyText="The learning curve appears after the first evaluation"
          />
          {expanded && (
            <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs content-start">
              {[
                ['Epochs', job.params.epochs],
                ['Image size', `${job.params.img} px`],
                ['Patience', job.params.patience || 'off'],
                ['Evaluate every', job.params.eval_every],
                ['Small-object head', job.params.p2 ? 'on' : 'off'],
                ['Base model', job.params.base_model || '—'],
                ...(aug
                  ? Object.entries(aug).map(([k, v]) => [`aug: ${k}`, typeof v === 'boolean' ? (v ? 'on' : 'off') : String(v)])
                  : [['Augmentations', 'LTVision defaults']]),
              ].map(([k, v]) => (
                <div key={String(k)} className="contents">
                  <dt className="text-muted">{k}</dt>
                  <dd className="font-mono text-ink truncate">{String(v)}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>
      )}
    </li>
  );
}

function Slider({ label, value, min, max, step, onChange, format, help }: { label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void; format: (v: number) => string; help: string }) {
  return (
    <label className="block" title={help}>
      <span className="flex justify-between text-xs">
        <span className="font-medium text-ink">{label}</span>
        <span className="font-mono text-muted">{format(value)}</span>
      </span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="mt-1.5 w-full accent-[var(--color-crimson)]" />
    </label>
  );
}

function NewTraining({ onCreated, projectId }: { onCreated: (job: TrainingJob) => void; projectId?: string }) {
  const notify = useNotify();
  const datasets = useResource(() => api.studioDatasets(projectId), `studio-datasets-${projectId ?? 'all'}`);
  const myModels = useResource(() => api.studioModels(), 'studio-models');
  const market = useResource(() => api.studioMarketplace(), 'studio-market-');
  const plan = useResource(() => api.studioPlan(), 'studio-plan');
  const params = new URLSearchParams(window.location.search);
  const [datasetId, setDatasetId] = useState(params.get('dataset') ?? '');
  const [name, setName] = useState('');
  const [preset, setPreset] = useState<TrainPreset>('balanced');
  const [custom, setCustom] = useState<TrainParams>(DEFAULT_CUSTOM);
  const [runner, setRunner] = useState<TrainRunner>('layerto');
  const [useAug, setUseAug] = useState(false);
  const [aug, setAug] = useState(AUG_DEFAULTS);
  const [base, setBase] = useState(params.get('base') ?? '');
  const [estimate, setEstimate] = useState<TrainEstimate | null>(null);
  const [estError, setEstError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const usable = useMemo(() => (datasets.data ?? []).filter((d) => !d.purged_at && d.kind !== 'bundle'), [datasets.data]);
  useEffect(() => {
    if (!datasetId && usable.length) setDatasetId(usable[0].id);
  }, [datasetId, usable]);

  const ds = usable.find((d) => d.id === datasetId);
  const req: CreateJobParams = useMemo(
    () => ({
      dataset_id: datasetId,
      name: name.trim() || `${ds?.name ?? 'Model'} ${base ? 'fine-tune' : preset}`,
      preset,
      params: preset === 'custom' ? custom : undefined,
      runner,
      augment: useAug ? aug : undefined,
      base_model: base || undefined,
    }),
    [datasetId, name, ds?.name, preset, custom, runner, useAug, aug, base],
  );

  useEffect(() => {
    if (!datasetId) return;
    let alive = true;
    const t = setTimeout(() => {
      api
        .studioEstimate(req)
        .then((e) => {
          if (!alive) return;
          setEstimate(e);
          setEstError(null);
        })
        .catch((err) => alive && (setEstimate(null), setEstError(errorMessage(err, "Couldn't estimate."))));
    }, 300);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [req, datasetId]);

  const start = async () => {
    setBusy(true);
    try {
      const res = await api.studioCreateJob(req);
      setName('');
      onCreated(res.job);
    } catch (err) {
      notify(errorMessage(err, "Couldn't start training."), 'error');
    } finally {
      setBusy(false);
    }
  };

  if (datasets.loading) return <Skeleton className="h-64" />;
  if (usable.length === 0) {
    return (
      <Card>
        <EmptyState icon="database" title="Nothing to train on yet" description="Add a dataset to this project and label at least 10 images first." />
      </Card>
    );
  }

  const set = (k: keyof TrainParams, v: string | number | boolean) => setCustom({ ...custom, [k]: v });
  const baseOptions = [
    { value: '', label: 'Start from LTVision defaults' },
    ...(myModels.data ?? []).map((m) => ({ value: m.slug, label: `Mine: ${m.name}${m.size ? ` (${m.size.toUpperCase()})` : ''}` })),
    ...(market.data ?? [])
      .filter((m) => !(myModels.data ?? []).some((x) => x.slug === m.slug))
      .map((m) => ({ value: m.slug, label: `Community: ${m.name} by @${m.owner} (Layerto GPU only)` })),
  ];
  const gpuHours = plan.data?.gpu_hours ?? 0;
  const coveredByHours = estimate ? gpuHours >= estimate.gpu_hours : false;

  return (
    <Card title="New training run">
      <div className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <Select
            label="Dataset"
            value={datasetId}
            onChange={(e) => setDatasetId(e.target.value)}
            options={usable.map((d) => ({ value: d.id, label: `${d.name} · ${d.labeled} labeled${d.source_listing_id ? ' · bought' : ''}` }))}
          />
          <Input label="Model name" placeholder={`${ds?.name ?? 'Model'} ${preset}`} value={name} maxLength={80} onChange={(e) => setName(e.target.value)} />
        </div>
        {ds?.license && (
          <Alert>
            This dataset was bought under the <strong>{ds.license.replace(/_/g, ' ')}</strong> license.
            {ds.license === 'research_only' ? ' Models trained on it stay private: they can’t be sold or get public websites.' : ' The license travels with the model.'}
          </Alert>
        )}
        <div className="space-y-2">
          <SegmentedControl label="Preset" value={preset} onChange={setPreset} segments={PRESETS.map((p) => ({ value: p.value, label: p.label }))} />
          <p className="text-xs text-muted">{PRESETS.find((p) => p.value === preset)?.hint}</p>
        </div>

        {preset === 'custom' && (
          <div className="grid gap-4 grid-cols-2 lg:grid-cols-4 rounded-l2 border border-line p-4">
            <Select label="Model size" value={custom.size} onChange={(e) => set('size', e.target.value)} options={['n', 's', 'm', 'l', 'x', 'xl', 'xxl'].map((s) => ({ value: s, label: s.toUpperCase() }))} />
            <Input label="Epochs" type="number" min={5} max={500} value={custom.epochs} onChange={(e) => set('epochs', Number(e.target.value))} />
            <Select label="Image size" value={String(custom.img)} onChange={(e) => set('img', Number(e.target.value))} options={[320, 480, 640, 800, 960, 1280].map((s) => ({ value: String(s), label: `${s} px` }))} />
            <Input label="Early stop (patience)" type="number" min={0} max={500} value={custom.patience} onChange={(e) => set('patience', Number(e.target.value))} helperText="0 = never stop early" />
            <Input label="Evaluate every" type="number" min={1} max={50} value={custom.eval_every} onChange={(e) => set('eval_every', Number(e.target.value))} />
            <Input label="Stop mosaic (last epochs)" type="number" min={1} value={custom.close_mosaic} onChange={(e) => set('close_mosaic', Number(e.target.value))} />
            <div className="col-span-2 flex items-end">
              <Switch checked={custom.p2} onChange={(v) => set('p2', v)} label="Small-object head (P2)" description="Better for tiny objects; ~30% slower." />
            </div>
          </div>
        )}

        <div className="rounded-l2 border border-line">
          <div className="flex flex-wrap items-center justify-between gap-3 p-4">
            <Switch checked={useAug} onChange={setUseAug} label="Custom augmentations" description="Tune how images are varied during training. Off = LTVision defaults." />
            {useAug && (
              <Button size="sm" variant="ghost" onClick={() => setAug(AUG_DEFAULTS)}>
                Reset
              </Button>
            )}
          </div>
          {useAug && (
            <div className="grid gap-x-6 gap-y-4 border-t border-line p-4 sm:grid-cols-2 lg:grid-cols-4">
              <Slider label="Horizontal flip" value={aug.flip} min={0} max={1} step={0.05} onChange={(v) => setAug({ ...aug, flip: v })} format={(v) => `${Math.round(v * 100)}%`} help="Chance an image is mirrored. Turn off for text or left/right-specific objects." />
              <Slider label="Mosaic" value={aug.mosaic} min={0} max={1} step={0.05} onChange={(v) => setAug({ ...aug, mosaic: v })} format={(v) => `${Math.round(v * 100)}%`} help="Chance of combining 4 images into one. Helps small objects and context." />
              <Slider label="Mixup" value={aug.mixup} min={0} max={0.5} step={0.05} onChange={(v) => setAug({ ...aug, mixup: v })} format={(v) => `${Math.round(v * 100)}%`} help="Chance of blending two images. Useful for large models." />
              <Slider label="Rotation" value={aug.degrees} min={0} max={45} step={1} onChange={(v) => setAug({ ...aug, degrees: v })} format={(v) => `±${v}°`} help="Random rotation. Good for aerial, microscope and top-down photos." />
              <Slider label="Scale" value={aug.scale} min={0} max={0.9} step={0.05} onChange={(v) => setAug({ ...aug, scale: v })} format={(v) => `${(1 - v).toFixed(2)}–${(1 + v).toFixed(2)}×`} help="Random zoom in/out." />
              <Slider label="Shift" value={aug.translate} min={0} max={0.5} step={0.01} onChange={(v) => setAug({ ...aug, translate: v })} format={(v) => `${Math.round(v * 100)}%`} help="Random move as a share of the image size." />
              <Slider label="Colour jitter" value={aug.hsv} min={0} max={2} step={0.1} onChange={(v) => setAug({ ...aug, hsv: v })} format={(v) => `${v.toFixed(1)}×`} help="Strength of hue, saturation and brightness changes. 0 turns it off." />
              <div className="flex items-end">
                <Switch checked={aug.multiscale} onChange={(v) => setAug({ ...aug, multiscale: v })} label="Multi-scale" description="Vary image size per batch" />
              </div>
            </div>
          )}
        </div>

        <Select label="Start from" value={base} onChange={(e) => setBase(e.target.value)} options={baseOptions} />
        {base && <p className="-mt-3 text-xs text-muted">Fine-tuning keeps the base model’s size and learns your classes. Community models can only be fine-tuned on Layerto GPUs, so their weights stay private.</p>}

        <div className="grid gap-3 sm:grid-cols-2">
          <RunnerOption
            selected={runner === 'layerto'}
            onSelect={() => setRunner('layerto')}
            icon="cpu"
            title="Layerto GPU"
            detail={
              estimate
                ? coveredByHours
                  ? `About ${estimate.gpu_hours} GPU hours, taken from your ${gpuHours.toFixed(1)} prepaid hours`
                  : `About ${estimate.gpu_hours} GPU hours · ${usd(estimate.layerto_cost_usd)} from your balance, refunded if it fails`
                : 'Paid from prepaid GPU hours or your balance'
            }
          />
          <RunnerOption selected={runner === 'notebook'} onSelect={() => setRunner('notebook')} icon="download" title="Your Colab or Kaggle" detail="Free. Download a notebook, run it on your own GPU; results upload back here." />
        </div>

        {estError && <Alert tone="error">{estError}</Alert>}
        {estimate && !estimate.ready && <Alert>{estimate.problem}</Alert>}

        <div className="flex flex-wrap items-center justify-end gap-3">
          {estimate?.ready && runner === 'layerto' && (
            <span className="text-sm text-muted">
              {coveredByHours ? (
                <>Uses <strong className="text-ink">{estimate.gpu_hours} prepaid hours</strong></>
              ) : (
                <>Charged now: <strong className="text-ink">{usd(estimate.layerto_cost_usd)}</strong></>
              )}
            </span>
          )}
          <Button icon="play" loading={busy} disabled={!estimate?.ready} onClick={start}>
            {runner === 'layerto' ? 'Start training' : 'Create notebook'}
          </Button>
        </div>
      </div>
    </Card>
  );
}

function RunnerOption({ selected, onSelect, icon, title, detail }: { selected: boolean; onSelect: () => void; icon: 'cpu' | 'download'; title: string; detail: string }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn('flex gap-3 rounded-l2 border p-4 text-left cursor-pointer transition-colors', selected ? 'border-crimson bg-crimson-tint' : 'border-line hover:border-line-strong')}
    >
      <Icon name={icon} size={20} className={selected ? 'text-crimson' : 'text-muted'} />
      <span>
        <span className="block font-medium text-ink">{title}</span>
        <span className="block text-xs text-muted mt-0.5">{detail}</span>
      </span>
    </button>
  );
}

function NotebookModal({ job, onClose }: { job: TrainingJob | null; onClose: () => void }) {
  const notify = useNotify();
  const [busy, setBusy] = useState(false);
  if (!job) return null;
  const get = async () => {
    setBusy(true);
    try {
      await downloadNotebook(job);
    } catch (err) {
      notify(errorMessage(err, "Couldn't get the notebook."), 'error');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal isOpen onClose={onClose} title="Train in your own notebook" size="lg">
      <ol className="space-y-3 text-sm text-ink-secondary list-decimal pl-5">
        <li>Download the notebook. It holds a private link to this one training run, valid for 7 days.</li>
        <li>
          Open it in <strong className="text-ink">Google Colab</strong> (File → Upload notebook) or <strong className="text-ink">Kaggle</strong> (New notebook → Import).
        </li>
        <li>Turn on a GPU: Colab: Runtime → Change runtime type → GPU. Kaggle: Settings → Accelerator → GPU.</li>
        <li>Run all cells. Progress and the learning curve show up here; the model appears in Models when it finishes.</li>
      </ol>
      <Alert className="mt-4">Downloading again creates a new link and stops the old one. Don't share the notebook: anyone with it can upload results to this run.</Alert>
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>
          Close
        </Button>
        <Button icon="download" loading={busy} onClick={get}>
          Download notebook
        </Button>
      </div>
    </Modal>
  );
}
