import { useEffect, useState } from 'react';
import { errorMessage } from '@layerto/api-client';
import type { CustomModel, VisionResponse } from '@layerto/types';
import { BoundingBoxCanvas, Button, Chip, CopyButton, Drawer, Icon, MetricsPanel, Modal, Select, Tabs, UploadZone, usd, useNotify, useResource } from '@layerto/ui';
import { api } from '../../lib/api';
import { PUBLIC_API_URL } from '../../config';
import { useHub } from '../../hub/HubContext';
import { shortDate } from '../studio/lib/format';

export function apiSnippets(slug: string): Record<'curl' | 'python' | 'js', string> {
  const url = `${PUBLIC_API_URL}/v1/vision/${slug}`;
  return {
    curl: `curl -X POST "${url}" \\\n  -H "Authorization: Bearer $LAYERTO_KEY" \\\n  -F "image=@photo.jpg"`,
    python: `import os, requests\n\nr = requests.post(\n    "${url}",\n    headers={"Authorization": f"Bearer {os.environ['LAYERTO_KEY']}"},\n    files={"image": open("photo.jpg", "rb")},\n)\nfor p in r.json()["predictions"]:\n    print(p["label"], round(p["confidence"], 2), p.get("bbox"))`,
    js: `const form = new FormData();\nform.append('image', file); // a File or Blob\n\nconst res = await fetch('${url}', {\n  method: 'POST',\n  headers: { Authorization: \`Bearer \${process.env.LAYERTO_KEY}\` },\n  body: form,\n});\nconst { predictions } = await res.json();`,
  };
}

/** A community model: metrics explained, a live try-out, API code and fine-tuning. */
export function ModelDrawer({ model, onClose }: { model: CustomModel | null; onClose: () => void }) {
  const { navigate, openComposer, reloadBalance, has } = useHub();
  const notify = useNotify();
  const [tab, setTab] = useState<'metrics' | 'try' | 'api'>('metrics');
  const [lang, setLang] = useState<'curl' | 'python' | 'js'>('curl');
  const [image, setImage] = useState<{ file: File; url: string } | null>(null);
  const [result, setResult] = useState<VisionResponse | null>(null);
  const [running, setRunning] = useState(false);
  const [threshold, setThreshold] = useState(0.25);
  const [finetune, setFinetune] = useState(false);

  useEffect(() => {
    setTab('metrics');
    setResult(null);
    setImage((old) => {
      if (old) URL.revokeObjectURL(old.url);
      return null;
    });
  }, [model?.slug]);

  if (!model) return null;
  const run = async (file: File) => {
    const url = URL.createObjectURL(file);
    setImage((old) => {
      if (old) URL.revokeObjectURL(old.url);
      return { file, url };
    });
    setResult(null);
    setRunning(true);
    try {
      const r = await api.runPlayground(model.slug, file);
      setResult(r);
      reloadBalance();
    } catch (err) {
      notify(errorMessage(err, "Couldn't run the model."), 'error');
    } finally {
      setRunning(false);
    }
  };
  const snippets = apiSnippets(model.slug);
  const shown = (result?.predictions ?? []).filter((p) => p.confidence >= threshold);

  return (
    <Drawer
      isOpen
      onClose={onClose}
      title={model.name}
      description={`by @${model.owner} · ${usd(model.price_usd)} per call`}
      className="max-w-3xl"
      footer={
        <div className="flex flex-wrap items-center gap-2">
          {has('train') && (
            <Button icon="cpu" onClick={() => setFinetune(true)}>
              Fine-tune on my data
            </Button>
          )}
          <Button variant="secondary" icon="spark" onClick={() => navigate(`/playground?model=${model.slug}`)}>
            Open in Playground
          </Button>
          <Button
            variant="ghost"
            icon="share"
            onClick={() => openComposer({ space: 'showcase', title: `Check out ${model.name}`, body: model.description, link_kind: 'model', link_ref: model.slug })}
          >
            Share
          </Button>
        </div>
      }
    >
      <div className="space-y-5">
        <div className="flex flex-wrap gap-1.5">
          {model.size && <Chip variant="neutral">LTVision {model.size}</Chip>}
          <Chip variant="neutral">{model.license || 'license not set'}</Chip>
          {model.source === 'imported' && <Chip variant="muted">Imported weights</Chip>}
          {model.data_license && <Chip variant="muted">Data: {model.data_license.replace(/_/g, ' ')}</Chip>}
          {model.published_at && <Chip variant="muted">Published {shortDate(model.published_at)}</Chip>}
          <Chip variant="muted">{model.calls_30d.toLocaleString()} calls / 30 days</Chip>
        </div>
        {model.description && <p className="text-sm text-ink-secondary">{model.description}</p>}
        <div>
          <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted">Detects {model.classes.length} classes</div>
          <div className="flex flex-wrap gap-1.5">
            {model.classes.map((c) => (
              <span key={c} className="rounded-pill bg-page px-2.5 py-0.5 text-xs">
                {c}
              </span>
            ))}
          </div>
        </div>
        <Tabs
          value={tab}
          onChange={setTab}
          items={[
            { value: 'metrics', label: 'Metrics', icon: 'gauge' },
            { value: 'try', label: 'Try it', icon: 'play' },
            { value: 'api', label: 'API', icon: 'key' },
          ]}
        />
        {tab === 'metrics' && <MetricsPanel metrics={model.metrics} history={model.history} source={model.source} />}
        {tab === 'try' && (
          <div className="space-y-4">
            {!image ? (
              <UploadZone onFile={(f: File) => void run(f)} />
            ) : (
              <>
                <div className="relative overflow-hidden rounded-l2 border border-line bg-page">
                  <BoundingBoxCanvas imageSrc={image.url} predictions={shown} confidenceThreshold={threshold} />
                  {running && (
                    <div className="absolute inset-0 grid place-items-center bg-black/30 text-sm font-medium text-white backdrop-blur-[1px]">
                      <span className="inline-flex items-center gap-2">
                        <Icon name="refresh" size={16} className="animate-spin" /> Running…
                      </span>
                    </div>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-4">
                  <label className="flex flex-1 items-center gap-3 text-sm">
                    <span className="whitespace-nowrap text-muted">Min confidence {Math.round(threshold * 100)}%</span>
                    <input type="range" min={0} max={0.95} step={0.05} value={threshold} onChange={(e) => setThreshold(Number(e.target.value))} className="flex-1 accent-[var(--color-crimson)]" />
                  </label>
                  <Button size="sm" variant="secondary" icon="upload" onClick={() => setImage(null)}>
                    Another image
                  </Button>
                </div>
                {result && (
                  <div className="rounded-l2 border border-line">
                    <div className="flex justify-between border-b border-line px-4 py-2 text-xs text-muted">
                      <span>{shown.length} objects</span>
                      <span>
                        {result.latency_ms} ms · {usd(result.charge_usd)}
                      </span>
                    </div>
                    <ul className="max-h-48 divide-y divide-line overflow-y-auto text-sm">
                      {shown.map((p, i) => (
                        <li key={i} className="flex justify-between px-4 py-1.5">
                          <span>{p.label}</span>
                          <span className="tabular-nums text-muted">{Math.round(p.confidence * 100)}%</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            )}
            <p className="text-xs text-muted">Each run is charged {usd(model.price_usd)} from your balance. Images are processed in memory and never stored.</p>
          </div>
        )}
        {tab === 'api' && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              {(['curl', 'python', 'js'] as const).map((l) => (
                <button key={l} type="button" onClick={() => setLang(l)} className={`rounded-pill px-3 py-1 text-xs font-medium cursor-pointer ${lang === l ? 'bg-ink text-page' : 'bg-page text-muted hover:text-ink'}`}>
                  {l === 'curl' ? 'cURL' : l === 'python' ? 'Python' : 'JavaScript'}
                </button>
              ))}
              <span className="ml-auto">
                <CopyButton text={snippets[lang]} />
              </span>
            </div>
            <pre className="overflow-x-auto rounded-l2 bg-[#0B0F17] p-4 text-[12.5px] leading-relaxed text-slate-200">{snippets[lang]}</pre>
            <p className="text-xs text-muted">
              Use an API key from{' '}
              <button type="button" className="text-crimson cursor-pointer" onClick={() => navigate('/keys')}>
                API keys
              </button>
              . The creator earns a share of each paid call.
            </p>
          </div>
        )}
      </div>
      <FinetuneModal open={finetune} slug={model.slug} onClose={() => setFinetune(false)} />
    </Drawer>
  );
}

function FinetuneModal({ open, slug, onClose }: { open: boolean; slug: string; onClose: () => void }) {
  const { navigate } = useHub();
  const projects = useResource(() => (open ? api.studioProjects() : Promise.resolve([])), open ? 'studio-projects' : null);
  const [pid, setPid] = useState('');
  const writable = (projects.data ?? []).filter((p) => p.role !== 'viewer');
  useEffect(() => {
    if (!pid && writable[0]) setPid(writable[0].id);
  }, [writable, pid]);
  return (
    <Modal isOpen={open} onClose={onClose} title="Fine-tune this model" description="Start from these weights and train on a dataset in one of your projects. Runs on Layerto GPUs.">
      {writable.length === 0 ? (
        <div className="space-y-3">
          <p className="text-sm text-muted">You need a project with a labeled dataset first.</p>
          <Button onClick={() => navigate('/projects')}>Create a project</Button>
        </div>
      ) : (
        <div className="space-y-4">
          <Select label="Project" value={pid} onChange={(e) => setPid(e.target.value)} options={writable.map((p) => ({ value: p.id, label: p.name }))} />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button icon="cpu" disabled={!pid} onClick={() => navigate(`/projects/${pid}/train?base=${slug}`)}>
              Continue
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
