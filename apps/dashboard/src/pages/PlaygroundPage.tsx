import { useEffect, useMemo, useState } from 'react';
import { errorMessage } from '@layerto/api-client';
import type { CustomModel, VisionResponse } from '@layerto/types';
import { Alert, BoundingBoxCanvas, Button, Card, Chip, CopyButton, EmptyState, Icon, Input, MetricsPanel, PageHeader, Reveal, UploadZone, cn, usd, useNotify, useResource } from '@layerto/ui';
import { ModelIntelligenceCard } from '../components/playground/ModelIntelligenceCard';
import { PlaygroundOutputPanel } from '../components/playground/PlaygroundOutputPanel';
import { SampleImagePicker } from '../components/playground/SampleImagePicker';
import { WorkflowChainBuilder } from '../components/playground/WorkflowChainBuilder';
import { ModelPicker } from '../components/playground/ModelPicker';
import type { PickerModel } from '../components/playground/ModelPicker';
import { useModels } from '../hooks/useModels';
import { usePlaygroundRun } from '../hooks/usePlaygroundRun';
import type { ChainStepConfig } from '../lib/playgroundLogic';
import { api } from '../lib/api';
import { PUBLIC_API_URL } from '../config';
import { apiSnippets } from '../features/market/ModelDrawer';

type Mode = 'single' | 'compare' | 'workflow';

interface HistoryItem {
  id: string;
  at: number;
  file: string;
  model: string;
  objects: number;
  latency: number;
  charge: string;
  top: string;
}

const MODES: { id: Mode; label: string; icon: 'spark' | 'layoutGrid' | 'layers'; hint: string }[] = [
  { id: 'single', label: 'Single', icon: 'spark', hint: 'Run one model' },
  { id: 'compare', label: 'Compare', icon: 'layoutGrid', hint: 'Two models, same image' },
  { id: 'workflow', label: 'Chain', icon: 'layers', hint: 'Models in sequence' },
];

/** Vision workbench: any model (catalogue, yours or community), side-by-side comparison, chaining, metrics and ready-to-paste API code. */
export function PlaygroundPage({ onCharged }: { onCharged: () => void }) {
  const catalogue = useModels();
  const mine = useResource(() => api.studioModels().catch(() => [] as CustomModel[]), 'studio-models');
  const market = useResource(() => api.studioMarketplace('', 'popular').catch(() => [] as CustomModel[]), 'market-models-playground');
  const playground = usePlaygroundRun();
  const notify = useNotify();

  const [mode, setMode] = useState<Mode>('single');
  const [model, setModel] = useState(() => new URLSearchParams(window.location.search).get('model') ?? 'auto');
  const [prompt, setPrompt] = useState('');
  const [threshold, setThreshold] = useState(0.5);
  const [highlighted, setHighlighted] = useState<number | null>(null);
  const [rightTab, setRightTab] = useState<'output' | 'code' | 'history'>('output');
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [pair, setPair] = useState<[string, string]>(['', '']);
  const [pairResults, setPairResults] = useState<[VisionResponse | null, VisionResponse | null]>([null, null]);
  const [pairRunning, setPairRunning] = useState(false);
  const [chainSteps, setChainSteps] = useState<ChainStepConfig[]>([
    { id: 'step_1', model_slug: 'turtle-id', min_confidence: 0.5, prompt: 'sea turtle' },
    { id: 'step_2', model_slug: 'bioclip', min_confidence: 0.3, prompt: '' },
  ]);

  const customs = useMemo(() => {
    const m = new Map<string, CustomModel>();
    for (const x of market.data ?? []) m.set(x.slug, x);
    for (const x of mine.data ?? []) m.set(x.slug, x);
    return m;
  }, [market.data, mine.data]);
  const myOwn = useMemo(() => new Set((mine.data ?? []).map((m) => m.slug)), [mine.data]);

  const pickerModels: PickerModel[] = useMemo(() => {
    const out: PickerModel[] = [];
    const seen = new Set<string>();
    for (const m of mine.data ?? []) {
      if (!m.enabled) continue;
      seen.add(m.slug);
      out.push({ slug: m.slug, name: m.name, price_usd: m.price_usd, group: 'My models', map: m.metrics.map50_95, classes: m.classes, description: m.description });
    }
    for (const m of catalogue.data ?? []) {
      if (seen.has(m.slug)) continue;
      seen.add(m.slug);
      const c = customs.get(m.slug);
      out.push(
        c
          ? { slug: m.slug, name: m.name, price_usd: m.price_usd, group: 'Community', owner: c.owner, map: c.metrics.map50_95, classes: c.classes, description: m.description }
          : { slug: m.slug, name: m.name, price_usd: m.price_usd, group: 'Layerto', description: m.description, owner: typeof m.meta?.owner === 'string' ? m.meta.owner : undefined },
      );
    }
    return out;
  }, [catalogue.data, mine.data, customs]);

  useEffect(() => {
    if (!pair[0] && pickerModels.length) setPair([pickerModels[0].slug, pickerModels[1]?.slug ?? pickerModels[0].slug]);
  }, [pickerModels, pair]);

  const options = useMemo(() => [{ value: 'auto', label: 'Auto (pick from prompt)' }, ...pickerModels.map((m) => ({ value: m.slug, label: `${m.name} · ${usd(m.price_usd)}` }))], [pickerModels]);
  const catalogueItem = (catalogue.data ?? []).find((m) => m.slug === model);
  const custom = customs.get(model);
  const pickedPrice = pickerModels.find((m) => m.slug === model)?.price_usd;

  const remember = (slug: string, res: VisionResponse) => {
    const counts = new Map<string, number>();
    for (const p of res.predictions) if (p.confidence >= threshold) counts.set(p.label, (counts.get(p.label) ?? 0) + 1);
    const top = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, v]) => `${v}× ${k}`).join(', ');
    setHistory((h) => [{ id: res.request_id, at: Date.now(), file: playground.file?.name ?? 'image', model: res.model || slug, objects: [...counts.values()].reduce((a, b) => a + b, 0), latency: res.latency_ms, charge: res.charge_usd, top }, ...h].slice(0, 25));
  };

  const runSingle = async () => {
    const res = await playground.run(model, prompt);
    if (res) {
      notify(`Ran ${res.model} · ${usd(res.charge_usd)}`, 'success');
      remember(model, res);
      setRightTab('output');
      onCharged();
    }
  };
  const runCompare = async () => {
    if (!playground.file || !pair[0] || !pair[1]) return;
    setPairRunning(true);
    setPairResults([null, null]);
    try {
      const out = await Promise.allSettled(pair.map((slug) => api.runPlayground(slug, playground.file!)));
      const res = out.map((o) => (o.status === 'fulfilled' ? o.value : null)) as [VisionResponse | null, VisionResponse | null];
      setPairResults(res);
      res.forEach((r, i) => r && remember(pair[i], r));
      const failed = out.find((o) => o.status === 'rejected') as PromiseRejectedResult | undefined;
      if (failed) notify(errorMessage(failed.reason, 'One of the models failed.'), 'error');
      onCharged();
    } finally {
      setPairRunning(false);
    }
  };
  const runChain = async () => {
    const results = await playground.runChain(chainSteps);
    if (results && results.length > 0) {
      results.forEach((r) => remember(r.model, r.response));
      notify(`Chain finished: ${results.length} steps`, 'success');
      onCharged();
    }
  };
  const handleRun = () => void (mode === 'single' ? runSingle() : mode === 'compare' ? runCompare() : runChain());
  const running = playground.running || pairRunning;

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && playground.file && !running) {
        e.preventDefault();
        handleRun();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  const snippets = model === 'auto' ? autoSnippets(prompt) : apiSnippets(model);
  const [lang, setLang] = useState<'curl' | 'python' | 'js'>('curl');
  const runLabel = mode === 'single' ? 'Run model' : mode === 'compare' ? 'Run both' : `Run chain (${chainSteps.length} steps)`;
  const est =
    mode === 'single'
      ? pickedPrice
      : mode === 'compare'
        ? String(pair.reduce((s, slug) => s + Number(pickerModels.find((m) => m.slug === slug)?.price_usd ?? 0), 0))
        : String(chainSteps.reduce((s, st) => s + Number(pickerModels.find((m) => m.slug === st.model_slug)?.price_usd ?? 0), 0));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Playground"
        description="Try any model on your own image: Layerto's, yours or the community's. Compare two side by side, chain them, and copy the API call."
        actions={
          <div className="flex rounded-control border border-line bg-page p-0.5 text-xs">
            {MODES.map((m) => (
              <button
                key={m.id}
                type="button"
                title={m.hint}
                onClick={() => setMode(m.id)}
                className={cn('inline-flex items-center gap-1.5 rounded px-3 py-1.5 font-medium transition-colors cursor-pointer', mode === m.id ? 'bg-crimson text-white shadow-l1' : 'text-muted hover:text-ink')}
              >
                <Icon name={m.icon} size={13} /> {m.label}
              </button>
            ))}
          </div>
        }
      />

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <div className="space-y-6">
          <Reveal index={0}>
            <Card className="space-y-5 shadow-l2">
              {playground.error && <Alert tone="error">{playground.error}</Alert>}
              {mode === 'single' && (
                <div className="space-y-4">
                  <ModelPicker models={pickerModels} value={model} onChange={setModel} />
                  <Input
                    label={model === 'auto' ? 'What should it find?' : 'Prompt (optional)'}
                    placeholder="e.g. sea turtle, කැස්බෑවා, pothole"
                    maxLength={1000}
                    helperText={model === 'auto' ? 'Auto uses this to choose a model.' : 'Only used by Auto routing.'}
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                  />
                </div>
              )}
              {mode === 'compare' && (
                <div className="grid gap-3 sm:grid-cols-2">
                  <ModelPicker label="Model A" models={pickerModels} value={pair[0]} onChange={(v) => setPair([v, pair[1]])} allowAuto={false} />
                  <ModelPicker label="Model B" models={pickerModels} value={pair[1]} onChange={(v) => setPair([pair[0], v])} allowAuto={false} />
                </div>
              )}
              <div className="space-y-3">
                <UploadZone onFile={playground.choose} onInvalid={playground.setError} disabled={running} />
                <SampleImagePicker onSelectSample={playground.choose} disabled={running} />
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-3">
                <p className="text-xs text-muted">
                  {playground.file ? (
                    <>
                      <strong className="text-ink">{playground.file.name}</strong> · {(playground.file.size / 1024).toFixed(0)} KB
                      {est && Number(est) > 0 && <> · about {usd(est)}</>}
                    </>
                  ) : (
                    'Pick an image to start'
                  )}
                </p>
                <Button icon="spark" onClick={handleRun} loading={running} disabled={!playground.file}>
                  {runLabel}
                </Button>
              </div>
              <p className="-mt-2 text-[11px] text-muted">
                <kbd className="rounded border border-line px-1">Ctrl</kbd>+<kbd className="rounded border border-line px-1">Enter</kbd> runs. Images are processed in memory and never stored.
              </p>
            </Card>
          </Reveal>

          {mode === 'single' && (
            <Reveal index={1}>
              {custom ? (
                <Card
                  title={custom.name}
                  subtitle={`${myOwn.has(custom.slug) ? 'Your model' : `by @${custom.owner}`} · ${custom.classes.length} classes · ${usd(custom.price_usd)} per call`}
                  actions={custom.source === 'imported' ? <Chip variant="muted">Self-reported</Chip> : <Chip variant="active">Measured by Layerto</Chip>}
                >
                  {custom.description && <p className="mb-4 text-sm text-ink-secondary">{custom.description}</p>}
                  <div className="mb-4 flex flex-wrap gap-1.5">
                    {custom.classes.map((c) => (
                      <span key={c} className="rounded-pill bg-page px-2 py-0.5 text-xs">
                        {c}
                      </span>
                    ))}
                  </div>
                  <MetricsPanel metrics={custom.metrics} history={custom.history} source={custom.source} compact />
                </Card>
              ) : (
                <ModelIntelligenceCard model={catalogueItem} isAuto={model === 'auto'} />
              )}
            </Reveal>
          )}
          {mode === 'compare' && (
            <Reveal index={1}>
              <CompareMetrics a={customs.get(pair[0])} b={customs.get(pair[1])} names={pair.map((s) => pickerModels.find((m) => m.slug === s)?.name ?? s) as [string, string]} />
            </Reveal>
          )}
          {mode === 'workflow' && (
            <Reveal index={1}>
              <WorkflowChainBuilder modelOptions={options} steps={chainSteps} onStepsChange={setChainSteps} />
            </Reveal>
          )}
        </div>

        <Reveal index={2}>
          <div className="space-y-3 xl:sticky xl:top-6">
            <div className="flex gap-1 rounded-control border border-line bg-page p-1 text-xs">
              {(['output', 'code', 'history'] as const).map((t) => (
                <button key={t} type="button" onClick={() => setRightTab(t)} className={cn('flex-1 rounded px-3 py-1.5 font-medium capitalize transition-colors cursor-pointer', rightTab === t ? 'bg-card text-ink shadow-l1' : 'text-muted hover:text-ink')}>
                  {t === 'code' ? 'API code' : t}
                  {t === 'history' && history.length > 0 && <span className="ml-1 text-muted">{history.length}</span>}
                </button>
              ))}
            </div>
            {rightTab === 'output' &&
              (mode === 'compare' ? (
                <CompareOutput previewUrl={playground.previewUrl} running={pairRunning} results={pairResults} names={pair.map((s) => pickerModels.find((m) => m.slug === s)?.name ?? s) as [string, string]} threshold={threshold} onThreshold={setThreshold} />
              ) : (
                <PlaygroundOutputPanel
                  previewUrl={playground.previewUrl}
                  fileName={playground.file?.name}
                  running={playground.running}
                  result={playground.result}
                  chainResults={playground.chainResults}
                  activeStepIndex={playground.activeStepIndex}
                  onSelectStepIndex={playground.setActiveStepIndex}
                  isChainMode={mode === 'workflow'}
                  threshold={threshold}
                  onThresholdChange={setThreshold}
                  highlightedIndex={highlighted}
                  onHoverBox={setHighlighted}
                />
              ))}
            {rightTab === 'code' && (
              <Card title={model === 'auto' ? 'Call Auto from your code' : `Call ${pickerModels.find((m) => m.slug === model)?.name ?? model} from your code`}>
                <div className="mb-3 flex items-center gap-2">
                  {(['curl', 'python', 'js'] as const).map((l) => (
                    <button key={l} type="button" onClick={() => setLang(l)} className={cn('rounded-pill px-3 py-1 text-xs font-medium cursor-pointer', lang === l ? 'bg-ink text-page' : 'bg-page text-muted hover:text-ink')}>
                      {l === 'curl' ? 'cURL' : l === 'python' ? 'Python' : 'JavaScript'}
                    </button>
                  ))}
                  <span className="ml-auto">
                    <CopyButton text={snippets[lang]} />
                  </span>
                </div>
                <pre className="overflow-x-auto rounded-l2 bg-[#0B0F17] p-4 text-[12.5px] leading-relaxed text-slate-200">{snippets[lang]}</pre>
                <p className="mt-3 text-xs text-muted">Create a key under API keys and keep it on your server; never put it in browser code.</p>
              </Card>
            )}
            {rightTab === 'history' && (
              <Card title="This session" subtitle="Runs since you opened the playground" padded={false}>
                {history.length === 0 ? (
                  <EmptyState icon="clock" title="No runs yet" description="Each run is listed here with its model, objects found, speed and cost." />
                ) : (
                  <ul className="divide-y divide-line">
                    {history.map((h) => (
                      <li key={h.id + h.at} className="flex items-center gap-3 px-5 py-3 text-sm">
                        <span className="grid size-8 shrink-0 place-items-center rounded-control bg-page text-muted">
                          <Icon name="image" size={15} />
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="truncate font-medium">{h.model}</div>
                          <div className="truncate text-xs text-muted">
                            {h.file} · {h.objects} objects{h.top && `: ${h.top}`}
                          </div>
                        </div>
                        <div className="text-right text-xs text-muted">
                          <div>{h.latency} ms</div>
                          <div>{usd(h.charge)}</div>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            )}
          </div>
        </Reveal>
      </div>
    </div>
  );
}

function autoSnippets(prompt: string) {
  const url = `${PUBLIC_API_URL}/v1/vision/auto`;
  const p = (prompt || 'sea turtle').replace(/"/g, '\\"');
  return {
    curl: `curl -X POST "${url}" \\\n  -H "Authorization: Bearer $LAYERTO_KEY" \\\n  -F "image=@photo.jpg" \\\n  -F "prompt=${p}"`,
    python: `import os, requests\n\nr = requests.post(\n    "${url}",\n    headers={"Authorization": f"Bearer {os.environ['LAYERTO_KEY']}"},\n    files={"image": open("photo.jpg", "rb")},\n    data={"prompt": "${p}"},\n)\nprint(r.json()["model"], r.json()["predictions"])`,
    js: `const form = new FormData();\nform.append('image', file);\nform.append('prompt', '${p.replace(/'/g, "\\'")}');\n\nconst res = await fetch('${url}', {\n  method: 'POST',\n  headers: { Authorization: \`Bearer \${process.env.LAYERTO_KEY}\` },\n  body: form,\n});\nconst { model, predictions } = await res.json();`,
  };
}

function CompareMetrics({ a, b, names }: { a?: CustomModel; b?: CustomModel; names: [string, string] }) {
  const keys: [string, string, boolean][] = [
    ['map50_95', 'mAP 50–95', true],
    ['map50', 'mAP 50', true],
    ['precision', 'Precision', true],
    ['recall', 'Recall', true],
    ['map_small', 'mAP small', true],
    ['latency_ms', 'Latency', false],
  ];
  if (!a && !b) {
    return (
      <Card title="Accuracy side by side">
        <p className="text-sm text-muted">Detection metrics appear here for trained models. Catalogue models are compared on the outputs only.</p>
      </Card>
    );
  }
  const fmt = (k: string, v?: number) => (v == null ? '—' : k === 'latency_ms' ? `${Math.round(v)} ms` : `${(v * 100).toFixed(1)}%`);
  return (
    <Card title="Accuracy side by side" padded={false}>
      <table className="w-full text-sm">
        <thead className="bg-page text-xs text-muted">
          <tr>
            <th className="px-4 py-2 text-left font-medium">Metric</th>
            <th className="px-4 py-2 text-right font-medium">{names[0]}</th>
            <th className="px-4 py-2 text-right font-medium">{names[1]}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {keys.map(([k, label, higher]) => {
            const va = a?.metrics[k as keyof CustomModel['metrics']] as number | undefined;
            const vb = b?.metrics[k as keyof CustomModel['metrics']] as number | undefined;
            const win = va != null && vb != null && va !== vb ? ((va > vb) === higher ? 0 : 1) : -1;
            return (
              <tr key={k}>
                <td className="px-4 py-2 text-muted">{label}</td>
                <td className={cn('px-4 py-2 text-right tabular-nums', win === 0 && 'font-bold text-emerald-600 dark:text-emerald-400')}>{fmt(k, va)}</td>
                <td className={cn('px-4 py-2 text-right tabular-nums', win === 1 && 'font-bold text-emerald-600 dark:text-emerald-400')}>{fmt(k, vb)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Card>
  );
}

function CompareOutput({
  previewUrl,
  running,
  results,
  names,
  threshold,
  onThreshold,
}: {
  previewUrl: string | null;
  running: boolean;
  results: [VisionResponse | null, VisionResponse | null];
  names: [string, string];
  threshold: number;
  onThreshold: (v: number) => void;
}) {
  if (!previewUrl) {
    return (
      <Card className="min-h-[420px]">
        <EmptyState icon="layoutGrid" title="Compare two models" description="Pick two models and an image, then run both. Boxes, counts, speed and cost appear side by side." />
      </Card>
    );
  }
  const counts = results.map((r) => {
    const m = new Map<string, number>();
    for (const p of r?.predictions ?? []) if (p.confidence >= threshold) m.set(p.label, (m.get(p.label) ?? 0) + 1);
    return m;
  });
  const labels = Array.from(new Set([...counts[0].keys(), ...counts[1].keys()])).sort();
  return (
    <Card className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        {[0, 1].map((i) => {
          const r = results[i];
          const shown = (r?.predictions ?? []).filter((p) => p.confidence >= threshold);
          return (
            <div key={i} className="overflow-hidden rounded-l2 border border-line">
              <div className="flex items-center justify-between border-b border-line bg-page px-3 py-2 text-xs">
                <span className="truncate font-semibold">
                  {i === 0 ? 'A' : 'B'} · {names[i]}
                </span>
                {r && (
                  <span className="text-muted">
                    {r.latency_ms} ms · {usd(r.charge_usd)}
                  </span>
                )}
              </div>
              <div className="relative">
                <BoundingBoxCanvas imageSrc={previewUrl} predictions={shown} confidenceThreshold={threshold} maxDisplayWidth={520} />
                {running && (
                  <div className="absolute inset-0 grid place-items-center bg-black/25 text-xs font-medium text-white">
                    <Icon name="refresh" size={16} className="animate-spin" />
                  </div>
                )}
              </div>
              <div className="border-t border-line px-3 py-2 text-xs text-muted">{r ? `${shown.length} ${shown.length === 1 ? 'object' : 'objects'}` : running ? 'Running…' : 'Not run yet'}</div>
            </div>
          );
        })}
      </div>
      <label className="flex items-center gap-3 text-sm">
        <span className="whitespace-nowrap text-muted">Min confidence {Math.round(threshold * 100)}%</span>
        <input type="range" min={0} max={0.95} step={0.05} value={threshold} onChange={(e) => onThreshold(Number(e.target.value))} className="flex-1 accent-[var(--color-crimson)]" />
      </label>
      {labels.length > 0 && (
        <table className="w-full text-sm">
          <thead className="text-xs text-muted">
            <tr>
              <th className="py-1.5 text-left font-medium">Label</th>
              <th className="py-1.5 text-right font-medium">A</th>
              <th className="py-1.5 text-right font-medium">B</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {labels.map((l) => (
              <tr key={l}>
                <td className="py-1.5">{l}</td>
                <td className="py-1.5 text-right tabular-nums">{counts[0].get(l) ?? 0}</td>
                <td className="py-1.5 text-right tabular-nums">{counts[1].get(l) ?? 0}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Card>
  );
}
