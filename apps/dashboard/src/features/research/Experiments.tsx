import { useEffect, useMemo, useState } from 'react';
import { errorMessage } from '@layerto/api-client';
import type { Experiment, Finding } from '@layerto/types';
import { Alert, Button, Card, Chip, ConfirmModal, Drawer, EmptyState, Icon, Input, LineChart, METRIC_INFO, Select, Skeleton, cn, formatMetric, useNotify, useResource } from '@layerto/ui';
import { api } from '../../lib/api';
import { useHub } from '../../hub/HubContext';
import { timeAgo } from '../home/util';
import { AreaTag, Pills, SearchBox, TagInput, TextArea, areaOptions, num, useResearch } from './shared';

const STATUS: Record<Experiment['status'], string> = {
  planned: 'bg-slate-400',
  running: 'bg-amber-500 animate-pulse',
  done: 'bg-emerald-500',
  failed: 'bg-crimson',
  cancelled: 'bg-line-strong',
};

/** Columns shown in the table and the compare view, in order. Higher is better unless `lower`. */
const COLS: { key: string; label: string; lower?: boolean }[] = [
  { key: 'map50_95', label: 'mAP50-95' },
  { key: 'map50', label: 'mAP50' },
  { key: 'map75', label: 'mAP75' },
  { key: 'precision', label: 'Precision' },
  { key: 'recall', label: 'Recall' },
  { key: 'f1', label: 'F1' },
  { key: 'map_small', label: 'mAP small' },
  { key: 'ar100', label: 'AR@100' },
  { key: 'latency_ms', label: 'Latency', lower: true },
  { key: 'params_m', label: 'Params', lower: true },
];

/** Every training run and manual experiment, with metrics side by side, curves and a compare view. */
export function ExperimentsView() {
  const { area, canWrite } = useResearch();
  const exps = useResource(() => api.experiments({ area }), `experiments-${area}`);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<'all' | Experiment['status']>('all');
  const [sort, setSort] = useState<{ key: string; dir: 1 | -1 }>({ key: 'created_at', dir: -1 });
  const [picked, setPicked] = useState<string[]>([]);
  const [open, setOpen] = useState<Partial<Experiment> | null>(() => (new URLSearchParams(window.location.search).get('new') ? { status: 'planned' } : null));
  const [comparing, setComparing] = useState(false);

  useEffect(() => {
    const t = setInterval(() => {
      if ((exps.data ?? []).some((e) => e.status === 'running')) void exps.reload();
    }, 15000);
    return () => clearInterval(t);
  }, [exps]);

  const list = useMemo(() => {
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    const out = (exps.data ?? []).filter((e) => (status === 'all' || e.status === status) && words.every((w) => `${e.name} ${e.hypothesis} ${e.tags.join(' ')}`.toLowerCase().includes(w)));
    const val = (e: Experiment) => (sort.key === 'created_at' ? new Date(e.created_at).getTime() : sort.key === 'name' ? e.name.toLowerCase() : num(e.metrics[sort.key]) ?? -Infinity);
    return out.sort((a, b) => {
      const x = val(a);
      const y = val(b);
      return (x < y ? -1 : x > y ? 1 : 0) * sort.dir;
    });
  }, [exps.data, q, status, sort]);

  const best = useMemo(() => {
    const out: Record<string, number> = {};
    for (const c of COLS) {
      const vals = list.map((e) => num(e.metrics[c.key])).filter((v): v is number => v !== undefined);
      if (vals.length) out[c.key] = c.lower ? Math.min(...vals) : Math.max(...vals);
    }
    return out;
  }, [list]);

  const shown = COLS.filter((c) => list.some((e) => num(e.metrics[c.key]) !== undefined)).slice(0, 6);
  const counts = (s: Experiment['status']) => (exps.data ?? []).filter((e) => e.status === s).length;
  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id].slice(-6)));
  const head = (key: string, label: string) => (
    <button type="button" className="inline-flex items-center gap-1 cursor-pointer hover:text-ink" onClick={() => setSort((s) => ({ key, dir: s.key === key ? (-s.dir as 1 | -1) : -1 }))}>
      {label}
      {sort.key === key && <Icon name={sort.dir === 1 ? 'arrowUp' : 'arrowDownLong'} size={11} />}
    </button>
  );

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <SearchBox value={q} onChange={setQ} placeholder="Search experiments" />
          <Pills
            value={status}
            onChange={setStatus}
            items={[
              { value: 'all', label: 'All', count: exps.data?.length },
              { value: 'running', label: 'Running', count: counts('running') },
              { value: 'done', label: 'Done', count: counts('done') },
              { value: 'planned', label: 'Planned', count: counts('planned') },
              { value: 'failed', label: 'Failed', count: counts('failed') },
            ]}
          />
        </div>
        <div className="flex gap-2">
          {picked.length >= 2 && (
            <Button variant="secondary" icon="chart" onClick={() => setComparing(true)}>
              Compare {picked.length}
            </Button>
          )}
          {canWrite() && (
            <Button icon="plus" onClick={() => setOpen({ status: 'planned', area_id: area || null })}>
              Log experiment
            </Button>
          )}
        </div>
      </div>
      {exps.loading ? (
        <Skeleton className="h-72" />
      ) : (exps.data ?? []).length === 0 ? (
        <Card>
          <EmptyState
            icon="flask"
            title="No experiments yet"
            description="Each training run is recorded here automatically with its settings, metrics and learning curve. You can also log experiments run elsewhere."
            action={canWrite() && <Button icon="plus" onClick={() => setOpen({ status: 'planned', area_id: area || null })}>Log experiment</Button>}
          />
        </Card>
      ) : (
        <Card padded={false} className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-line bg-page text-left text-xs text-muted">
                <tr>
                  <th className="w-10 px-4 py-2.5" />
                  <th className="px-2 py-2.5 font-medium">{head('name', 'Experiment')}</th>
                  {shown.map((c) => (
                    <th key={c.key} className="px-3 py-2.5 text-right font-medium whitespace-nowrap">
                      {head(c.key, c.label)}
                    </th>
                  ))}
                  <th className="px-4 py-2.5 text-right font-medium">{head('created_at', 'When')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {list.map((e) => (
                  <tr key={e.id} className={cn('group hover:bg-page', picked.includes(e.id) && 'bg-crimson-tint/40')}>
                    <td className="px-4 py-2.5">
                      <input type="checkbox" aria-label={`Compare ${e.name}`} checked={picked.includes(e.id)} onChange={() => toggle(e.id)} className="size-4 accent-[var(--color-crimson)] cursor-pointer" />
                    </td>
                    <td className="max-w-80 px-2 py-2.5">
                      <button type="button" onClick={() => setOpen(e)} className="flex w-full items-center gap-2 text-left cursor-pointer">
                        <span className={`size-2 shrink-0 rounded-full ${STATUS[e.status]}`} />
                        <span className="truncate font-medium group-hover:text-crimson">{e.name}</span>
                        {e.job_id && <Chip variant="neutral">auto</Chip>}
                      </button>
                      <div className="ml-4 mt-0.5 flex flex-wrap gap-1">
                        <AreaTag id={e.area_id} />
                        {e.tags.slice(0, 3).map((t) => (
                          <span key={t} className="text-[11px] text-muted">
                            #{t}
                          </span>
                        ))}
                      </div>
                    </td>
                    {shown.map((c) => {
                      const v = num(e.metrics[c.key]);
                      const isBest = v !== undefined && best[c.key] === v && list.length > 1;
                      return (
                        <td key={c.key} className={cn('px-3 py-2.5 text-right tabular-nums whitespace-nowrap', isBest && 'font-bold text-emerald-600 dark:text-emerald-400')}>
                          {v === undefined ? <span className="text-muted">—</span> : formatMetric(c.key, v)}
                        </td>
                      );
                    })}
                    <td className="px-4 py-2.5 text-right text-xs text-muted whitespace-nowrap">{timeAgo(e.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {list.length > 1 && <p className="border-t border-line px-4 py-2 text-[11px] text-muted">Best value in each column is green. Tick experiments to compare their curves.</p>}
        </Card>
      )}
      {open && (
        <ExperimentEditor
          exp={open}
          onClose={() => setOpen(null)}
          onSaved={(e) => {
            setOpen(e);
            void exps.reload();
          }}
          onDeleted={() => {
            setOpen(null);
            void exps.reload();
          }}
        />
      )}
      <CompareDrawer open={comparing} onClose={() => setComparing(false)} exps={(exps.data ?? []).filter((e) => picked.includes(e.id))} />
    </>
  );
}

function CompareDrawer({ open, onClose, exps }: { open: boolean; onClose: () => void; exps: Experiment[] }) {
  const keys = Array.from(new Set(exps.flatMap((e) => Object.keys(e.metrics).filter((k) => num(e.metrics[k]) !== undefined))));
  keys.sort((a, b) => (COLS.findIndex((c) => c.key === a) + 1 || 99) - (COLS.findIndex((c) => c.key === b) + 1 || 99));
  const paramKeys = Array.from(new Set(exps.flatMap((e) => Object.keys(e.params ?? {})))).slice(0, 16);
  const [metric, setMetric] = useState<'map50_95' | 'map50' | 'loss'>('map50_95');
  return (
    <Drawer isOpen={open} onClose={onClose} title="Compare experiments" className="max-w-4xl">
      <div className="space-y-5">
        <Card title="Learning curves" actions={<Pills value={metric} onChange={setMetric} items={[{ value: 'map50_95', label: 'mAP50-95' }, { value: 'map50', label: 'mAP50' }, { value: 'loss', label: 'Loss' }]} />}>
          <LineChart
            series={exps.map((e) => ({ name: e.name, points: (e.history ?? []).filter((h) => typeof h[metric] === 'number').map((h) => ({ x: h.epoch, y: h[metric] as number })) }))}
            yFormat={metric === 'loss' ? (v) => v.toFixed(3) : undefined}
            height={260}
            emptyText="These experiments have no per-epoch history."
          />
        </Card>
        <div className="overflow-x-auto rounded-l2 border border-line">
          <table className="w-full text-sm">
            <thead className="bg-page text-xs text-muted">
              <tr>
                <th className="px-4 py-2 text-left font-medium">Metric</th>
                {exps.map((e) => (
                  <th key={e.id} className="px-4 py-2 text-right font-medium">
                    {e.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {keys.map((k) => {
                const vals = exps.map((e) => num(e.metrics[k]));
                const defined = vals.filter((v): v is number => v !== undefined);
                const lower = COLS.find((c) => c.key === k)?.lower || k === 'model_mb';
                const top = defined.length > 1 ? (lower ? Math.min(...defined) : Math.max(...defined)) : undefined;
                return (
                  <tr key={k}>
                    <td className="px-4 py-2 text-muted" title={METRIC_INFO[k]?.help}>
                      {METRIC_INFO[k]?.label ?? k}
                    </td>
                    {vals.map((v, i) => (
                      <td key={exps[i].id} className={cn('px-4 py-2 text-right tabular-nums', v !== undefined && v === top && 'font-bold text-emerald-600 dark:text-emerald-400')}>
                        {v === undefined ? '—' : formatMetric(k, v)}
                      </td>
                    ))}
                  </tr>
                );
              })}
              {paramKeys.map((k) => (
                <tr key={`p-${k}`} className="bg-page/50">
                  <td className="px-4 py-2 font-mono text-xs text-muted">{k}</td>
                  {exps.map((e) => (
                    <td key={e.id} className="px-4 py-2 text-right font-mono text-xs">
                      {fmtParam(e.params?.[k])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Drawer>
  );
}

function fmtParam(v: unknown): string {
  if (v === undefined || v === null) return '—';
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

function ExperimentEditor({ exp, onClose, onSaved, onDeleted }: { exp: Partial<Experiment>; onClose: () => void; onSaved: (e: Experiment) => void; onDeleted: () => void }) {
  const notify = useNotify();
  const { navigate, openComposer } = useHub();
  const { areas, canWrite, go } = useResearch();
  const [f, setF] = useState<Partial<Experiment>>(exp);
  const [paramsText, setParamsText] = useState('');
  const [rows, setRows] = useState<{ k: string; v: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState(false);
  useEffect(() => {
    setF(exp);
    setParamsText(JSON.stringify(exp.params ?? {}, null, 2));
    setRows(
      Object.entries(exp.metrics ?? {})
        .filter(([, v]) => typeof v === 'number')
        .map(([k, v]) => ({ k, v: String(v) })),
    );
  }, [exp]);
  const isNew = !exp.id;
  const auto = !!exp.job_id;
  const editable = canWrite(exp.area_id);
  const set = (p: Partial<Experiment>) => setF((x) => ({ ...x, ...p }));

  const save = async () => {
    const body: Record<string, unknown> = {
      name: f.name?.trim(),
      hypothesis: f.hypothesis ?? '',
      conclusion: f.conclusion ?? '',
      tags: f.tags ?? [],
      area_id: f.area_id ?? '',
    };
    if (!auto) {
      try {
        body.params = paramsText.trim() ? JSON.parse(paramsText) : {};
      } catch {
        notify('Settings must be valid JSON', 'error');
        return;
      }
      const metrics: Record<string, number> = {};
      for (const r of rows) {
        const n = Number(r.v);
        if (r.k.trim() && r.v.trim() && Number.isFinite(n)) metrics[r.k.trim()] = n;
      }
      body.metrics = metrics;
      body.status = f.status ?? 'planned';
    }
    setBusy(true);
    try {
      const e = isNew ? await api.researchCreate<Experiment>('experiments', body) : await api.researchUpdate<Experiment>('experiments', exp.id!, body);
      notify(isNew ? 'Experiment logged' : 'Saved', 'success');
      onSaved(e);
    } catch (err) {
      notify(errorMessage(err, "Couldn't save the experiment."), 'error');
    } finally {
      setBusy(false);
    }
  };

  const toFinding = async () => {
    try {
      await api.researchCreate<Finding>('findings', {
        title: f.conclusion ? f.conclusion.split('\n')[0].slice(0, 200) : `Result of ${f.name}`,
        body: [f.hypothesis && `**Hypothesis.** ${f.hypothesis}`, f.conclusion && `**Conclusion.** ${f.conclusion}`].filter(Boolean).join('\n\n'),
        evidence: [{ type: 'experiment', ref: exp.id, label: exp.name }],
        confidence: 'medium',
        status: 'open',
        area_id: exp.area_id ?? '',
      });
      notify('Finding created', 'success');
      go('findings');
    } catch (err) {
      notify(errorMessage(err, "Couldn't create the finding."), 'error');
    }
  };

  const remove = async () => {
    try {
      await api.researchDelete('experiments', exp.id!);
      onDeleted();
    } catch (err) {
      notify(errorMessage(err, "Couldn't delete."), 'error');
    }
  };

  const metricText = Object.entries(exp.metrics ?? {})
    .filter(([k, v]) => typeof v === 'number' && ['map50_95', 'map50', 'precision', 'recall'].includes(k))
    .map(([k, v]) => `${METRIC_INFO[k]?.label ?? k}: ${formatMetric(k, v)}`)
    .join(' · ');

  return (
    <Drawer
      isOpen
      onClose={onClose}
      title={isNew ? 'Log an experiment' : f.name || 'Experiment'}
      className="max-w-2xl"
      footer={
        editable && (
          <div className="flex items-center justify-between gap-2">
            {!isNew ? (
              <Button variant="ghost" icon="trash" onClick={() => setDeleting(true)}>
                Delete
              </Button>
            ) : (
              <span />
            )}
            <Button loading={busy} disabled={!f.name?.trim()} onClick={save}>
              {isNew ? 'Log experiment' : 'Save'}
            </Button>
          </div>
        )
      }
    >
      <div className="space-y-4">
        {auto && (
          <Alert tone="info">
            Logged automatically from a training run. Settings, metrics and status come from the run and can't be edited.{' '}
            {exp.project_id && (
              <button type="button" className="font-semibold text-crimson cursor-pointer" onClick={() => navigate(`/projects/${exp.project_id}/train`)}>
                Open the run
              </button>
            )}
          </Alert>
        )}
        <Input label="Name" value={f.name ?? ''} maxLength={120} onChange={(e) => set({ name: e.target.value })} autoFocus={isNew} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Select label="Research area" value={f.area_id ?? ''} onChange={(e) => set({ area_id: e.target.value || null })} options={areaOptions(areas)} />
          <Select
            label="Status"
            value={f.status ?? 'planned'}
            disabled={auto}
            onChange={(e) => set({ status: e.target.value as Experiment['status'] })}
            options={(['planned', 'running', 'done', 'failed', 'cancelled'] as const).map((s) => ({ value: s, label: s[0].toUpperCase() + s.slice(1) }))}
          />
        </div>
        <TextArea label="Hypothesis" value={f.hypothesis ?? ''} onChange={(hypothesis) => set({ hypothesis })} rows={3} placeholder="If we add mosaic augmentation, small-object mAP improves by ≥2 points" />
        {(exp.history ?? []).length > 1 && (
          <Card title="Learning curve" padded>
            <LineChart
              series={[
                { name: 'mAP50-95', points: (exp.history ?? []).filter((h) => h.map50_95 != null).map((h) => ({ x: h.epoch, y: h.map50_95! })) },
                { name: 'mAP50', points: (exp.history ?? []).filter((h) => h.map50 != null).map((h) => ({ x: h.epoch, y: h.map50! })) },
              ]}
              height={180}
            />
          </Card>
        )}
        <div>
          <span className="mb-1.5 block text-sm font-medium">Metrics</span>
          {auto ? (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {Object.entries(exp.metrics ?? {})
                .filter(([, v]) => typeof v === 'number')
                .map(([k, v]) => (
                  <div key={k} className="rounded-control bg-page px-3 py-2" title={METRIC_INFO[k]?.help}>
                    <div className="text-[11px] text-muted">{METRIC_INFO[k]?.label ?? k}</div>
                    <div className="font-semibold tabular-nums">{formatMetric(k, v)}</div>
                  </div>
                ))}
              {Object.keys(exp.metrics ?? {}).length === 0 && <span className="text-sm text-muted">Metrics appear when the run reports progress.</span>}
            </div>
          ) : (
            <div className="space-y-2">
              {rows.map((r, i) => (
                <div key={i} className="flex gap-2">
                  <input
                    list="metric-keys"
                    value={r.k}
                    placeholder="map50_95"
                    onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, k: e.target.value } : x)))}
                    className="h-9 flex-1 rounded-control border border-line-strong bg-card px-3 font-mono text-sm"
                  />
                  <input
                    value={r.v}
                    inputMode="decimal"
                    placeholder="0.512"
                    onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, v: e.target.value } : x)))}
                    className="h-9 w-32 rounded-control border border-line-strong bg-card px-3 text-right font-mono text-sm"
                  />
                  <button type="button" aria-label="Remove metric" className="px-2 text-muted hover:text-crimson cursor-pointer" onClick={() => setRows(rows.filter((_, j) => j !== i))}>
                    <Icon name="close" size={14} />
                  </button>
                </div>
              ))}
              <datalist id="metric-keys">
                {Object.keys(METRIC_INFO).map((k) => (
                  <option key={k} value={k} />
                ))}
              </datalist>
              <Button size="sm" variant="ghost" icon="plus" onClick={() => setRows([...rows, { k: '', v: '' }])}>
                Add metric
              </Button>
              <p className="text-[11px] text-muted">Fractions for percentages (0.512 = 51.2%). Use standard keys like map50_95, precision, recall so they line up with trained runs.</p>
            </div>
          )}
        </div>
        {auto ? (
          <details className="rounded-control border border-line bg-page p-3 text-sm">
            <summary className="cursor-pointer font-medium">Run settings</summary>
            <pre className="mt-2 overflow-x-auto text-[12px]">{JSON.stringify(exp.params ?? {}, null, 2)}</pre>
          </details>
        ) : (
          <TextArea label="Settings (JSON)" value={paramsText} onChange={setParamsText} rows={5} mono placeholder={'{ "epochs": 50, "img": 640, "lr": 0.001 }'} />
        )}
        <TextArea label="Conclusion" value={f.conclusion ?? ''} onChange={(conclusion) => set({ conclusion })} rows={4} placeholder="What did you learn? Markdown works." />
        <TagInput label="Tags" value={f.tags ?? []} onChange={(tags) => set({ tags })} placeholder="baseline, ablation…" />
        {!isNew && (
          <div className="flex flex-wrap gap-2 border-t border-line pt-4">
            <Button size="sm" variant="secondary" icon="sparkles" onClick={toFinding}>
              Turn into a finding
            </Button>
            <Button
              size="sm"
              variant="secondary"
              icon="share"
              onClick={() =>
                openComposer({
                  space: 'research',
                  title: `Experiment: ${exp.name}`,
                  body: [exp.hypothesis && `**Hypothesis:** ${exp.hypothesis}`, metricText && `**Results:** ${metricText}`, exp.conclusion && `**Takeaway:** ${exp.conclusion}`].filter(Boolean).join('\n\n'),
                })
              }
            >
              Share with the community
            </Button>
            <span className="ml-auto self-center text-[11px] text-muted">Updated {timeAgo(exp.updated_at ?? exp.created_at ?? new Date().toISOString())}</span>
          </div>
        )}
      </div>
      <ConfirmModal isOpen={deleting} title="Delete this experiment?" description={auto ? 'The training run and its model are not affected.' : 'This cannot be undone.'} confirmLabel="Delete" danger onConfirm={remove} onCancel={() => setDeleting(false)} />
    </Drawer>
  );
}
