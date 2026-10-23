import { useEffect, useMemo, useState } from 'react';
import { errorMessage } from '@layerto/api-client';
import type { ModelSite, PublicSite, SiteInput, SiteTemplate, User } from '@layerto/types';
import {
  Alert,
  Button,
  Card,
  Chip,
  ConfirmModal,
  EmptyState,
  Icon,
  Input,
  ModelSiteView,
  PageHeader,
  Reveal,
  SegmentedControl,
  Select,
  Skeleton,
  Switch,
  useNotify,
  useResource,
  usd,
} from '@layerto/ui';
import { api } from '../../../lib/api';
import { SITE_URL } from '../../../config';

const TEMPLATES: { value: SiteTemplate; label: string; hint: string }[] = [
  { value: 'demo', label: 'Demo', hint: 'One page: a headline and a try-it box.' },
  { value: 'product', label: 'Product', hint: 'A landing page with a call to action, results and the demo.' },
  { value: 'research', label: 'Research', hint: 'A paper-style page: abstract, results, classes and demo.' },
];

interface Form {
  slug: string;
  model_slug: string;
  title: string;
  tagline: string;
  description: string;
  template: SiteTemplate;
  primary: string;
  accent: string;
  background: string;
  mode: 'light' | 'dark';
  font: 'sans' | 'serif' | 'mono';
  cta_label: string;
  cta_url: string;
  monthly_cap_usd: string;
  published: boolean;
}

function toForm(s: ModelSite | null, model: string): Form {
  return {
    slug: s?.slug ?? '',
    model_slug: s?.model_slug ?? model,
    title: s?.title ?? '',
    tagline: s?.tagline ?? '',
    description: s?.description ?? '',
    template: s?.template ?? 'demo',
    primary: s?.theme.primary ?? '#A3122A',
    accent: s?.theme.accent ?? '#A3122A',
    background: s?.theme.background ?? '#F7F7F8',
    mode: s?.theme.mode ?? 'light',
    font: s?.theme.font ?? 'sans',
    cta_label: s?.cta_label ?? '',
    cta_url: s?.cta_url ?? '',
    monthly_cap_usd: s?.monthly_cap_usd ?? '5.00',
    published: s?.published ?? true,
  };
}

function toInput(f: Form): SiteInput {
  return {
    slug: f.slug.trim(),
    model_slug: f.model_slug,
    title: f.title.trim(),
    tagline: f.tagline.trim(),
    description: f.description.trim(),
    template: f.template,
    theme: { primary: f.primary.toUpperCase(), accent: f.accent.toUpperCase(), background: f.background.toUpperCase(), mode: f.mode, font: f.font },
    cta_label: f.cta_label.trim(),
    cta_url: f.cta_url.trim(),
    monthly_cap_usd: f.monthly_cap_usd.trim(),
    published: f.published,
  };
}

export function SitesPage({ user, onCharged }: { user: User; onCharged: () => void }) {
  const sites = useResource(() => api.studioSites(), 'studio-sites');
  const [editing, setEditing] = useState<ModelSite | 'new' | null>(() => (new URLSearchParams(window.location.search).get('model') ? 'new' : null));

  if (editing) {
    return (
      <SiteEditor
        site={editing === 'new' ? null : editing}
        user={user}
        onCharged={onCharged}
        onDone={() => {
          setEditing(null);
          void sites.reload();
        }}
      />
    );
  }

  return (
    <>
      <PageHeader
        title="Model sites"
        description="A ready-made website for your model, with a live demo. The site calls your model through Layerto's servers, so your API key is never in the page."
        actions={<Button icon="plus" onClick={() => setEditing('new')}>New site</Button>}
      />
      <Reveal index={0}>
        {sites.loading ? (
          <Skeleton className="h-40" />
        ) : (sites.data ?? []).length === 0 ? (
          <Card>
            <EmptyState
              icon="globe"
              title="No sites yet"
              description="Pick a model and a template, and get a shareable page like layerto.com/s/your-model."
              action={<Button icon="plus" onClick={() => setEditing('new')}>New site</Button>}
            />
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {(sites.data ?? []).map((s) => (
              <Card key={s.id} className="flex flex-col">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold text-ink">{s.title}</h3>
                  {s.disabled_by_admin ? <Chip variant="danger">Disabled</Chip> : s.published ? <Chip variant="active">Live</Chip> : <Chip variant="muted">Draft</Chip>}
                </div>
                <p className="mt-1 text-xs text-muted">{s.model_name} · {s.template}</p>
                <a href={`${SITE_URL}/s/${s.slug}`} target="_blank" rel="noopener noreferrer" className="mt-3 text-sm text-crimson inline-flex items-center gap-1 break-all">
                  {SITE_URL.replace(/^https?:\/\//, '')}/s/{s.slug} <Icon name="external" size={14} />
                </a>
                <p className="mt-3 text-xs text-muted flex-1">This month: {usd(s.spent_this_month_usd)} of {usd(s.monthly_cap_usd)} cap</p>
                <div className="mt-4">
                  <Button size="sm" variant="secondary" icon="pen" onClick={() => setEditing(s)}>Edit</Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </Reveal>
    </>
  );
}

function SiteEditor({ site, user, onDone, onCharged }: { site: ModelSite | null; user: User; onDone: () => void; onCharged: () => void }) {
  const notify = useNotify();
  const mine = useResource(() => api.studioModels(), 'studio-models');
  const catalog = useResource(() => api.getModels(), 'models');
  const initialModel = new URLSearchParams(window.location.search).get('model') ?? '';
  const [f, setF] = useState<Form>(() => toForm(site, initialModel));
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((x) => ({ ...x, [k]: v }));

  const options = useMemo(() => {
    const own = (mine.data ?? []).filter((m) => m.enabled).map((m) => ({ value: m.slug, label: `${m.name} (yours)` }));
    const seen = new Set(own.map((o) => o.value));
    const pub = (catalog.data ?? []).filter((m) => !seen.has(m.slug)).map((m) => ({ value: m.slug, label: m.name }));
    return [...own, ...pub];
  }, [mine.data, catalog.data]);

  useEffect(() => {
    if (!f.model_slug && options.length) set('model_slug', options[0].value);
  }, [options, f.model_slug]);

  const own = (mine.data ?? []).find((m) => m.slug === f.model_slug);
  const pub = (catalog.data ?? []).find((m) => m.slug === f.model_slug);
  const preview: PublicSite = {
    slug: f.slug || 'preview',
    title: f.title || 'Your site title',
    tagline: f.tagline,
    description: f.description,
    template: f.template,
    theme: { primary: f.primary, accent: f.accent, background: f.background, mode: f.mode, font: f.font },
    cta_label: f.cta_label,
    cta_url: f.cta_url,
    model_name: own?.name ?? pub?.name ?? f.model_slug,
    classes: own?.classes ?? [],
    metrics: own ? { map50_95: own.metrics.map50_95, map50: own.metrics.map50 } : {},
    owner: user.username ?? '',
    available: true,
  };

  const save = async () => {
    setBusy(true);
    try {
      if (site) await api.studioUpdateSite(site.id, toInput(f));
      else await api.studioCreateSite(toInput(f));
      notify(site ? 'Site saved' : 'Site created', 'success');
      onDone();
    } catch (err) {
      notify(errorMessage(err, "Couldn't save the site."), 'error');
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!site) return;
    try {
      await api.studioDeleteSite(site.id);
      notify('Site deleted', 'success');
      onDone();
    } catch (err) {
      notify(errorMessage(err, "Couldn't delete the site."), 'error');
    }
  };

  const runPreview = async (file: File) => {
    const res = await api.runPlayground(f.model_slug, file);
    onCharged();
    return res.predictions.map((p) => ({ label: p.label, confidence: p.confidence, bbox: p.bbox ?? null }));
  };

  return (
    <>
      <PageHeader
        title={site ? `Edit “${site.title}”` : 'New site'}
        description={<button type="button" className="text-crimson cursor-pointer" onClick={onDone}>← All sites</button>}
        actions={
          <div className="flex gap-2">
            {site && <Button variant="ghost" icon="trash" onClick={() => setDeleting(true)}>Delete</Button>}
            <Button loading={busy} onClick={save} disabled={!f.title.trim() || !f.slug.trim() || !f.model_slug}>{site ? 'Save' : 'Create site'}</Button>
          </div>
        }
      />
      {site?.disabled_by_admin && <Alert tone="error">Layerto disabled this site. Contact support if you think this is a mistake.</Alert>}
      <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] items-start">
        <div className="space-y-4">
          <Card title="Content">
            <div className="space-y-4">
              <Select label="Model" value={f.model_slug} onChange={(e) => set('model_slug', e.target.value)} options={options.length ? options : [{ value: '', label: 'Loading…' }]} />
              <Input
                label="Address"
                value={f.slug}
                onChange={(e) => set('slug', e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                maxLength={40}
                helperText={`${SITE_URL.replace(/^https?:\/\//, '')}/s/${f.slug || 'your-address'}`}
              />
              <Input label="Title" value={f.title} maxLength={80} onChange={(e) => set('title', e.target.value)} />
              <Input label="Tagline" value={f.tagline} maxLength={160} onChange={(e) => set('tagline', e.target.value)} />
              <label className="block">
                <span className="block text-sm font-medium text-ink mb-1.5">Description</span>
                <textarea
                  className="w-full min-h-28 rounded-control border border-line-strong bg-card px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-focus"
                  value={f.description}
                  maxLength={4000}
                  onChange={(e) => set('description', e.target.value)}
                />
              </label>
              <div className="grid gap-4 sm:grid-cols-2">
                <Input label="Button label" placeholder="Get API access" value={f.cta_label} maxLength={40} onChange={(e) => set('cta_label', e.target.value)} />
                <Input label="Button link" placeholder="https://" value={f.cta_url} maxLength={300} onChange={(e) => set('cta_url', e.target.value)} />
              </div>
            </div>
          </Card>
          <Card title="Look">
            <div className="space-y-4">
              <SegmentedControl label="Template" value={f.template} onChange={(v) => set('template', v)} segments={TEMPLATES.map((t) => ({ value: t.value, label: t.label }))} />
              <p className="text-xs text-muted">{TEMPLATES.find((t) => t.value === f.template)?.hint}</p>
              <div className="grid grid-cols-3 gap-3">
                {(['primary', 'accent', 'background'] as const).map((k) => (
                  <label key={k} className="block">
                    <span className="block text-xs font-medium text-ink mb-1 capitalize">{k}</span>
                    <input type="color" value={f[k]} onChange={(e) => set(k, e.target.value)} className="h-10 w-full cursor-pointer rounded-control border border-line bg-card" />
                  </label>
                ))}
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <SegmentedControl
                  label="Mode"
                  value={f.mode}
                  onChange={(v) => {
                    set('mode', v);
                    set('background', v === 'dark' ? '#0F1013' : '#F7F7F8');
                  }}
                  segments={[{ value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' }]}
                />
                <SegmentedControl
                  label="Font"
                  value={f.font}
                  onChange={(v) => set('font', v)}
                  segments={[{ value: 'sans', label: 'Sans' }, { value: 'serif', label: 'Serif' }, { value: 'mono', label: 'Mono' }]}
                />
              </div>
            </div>
          </Card>
          <Card title="Billing and visibility">
            <div className="space-y-4">
              <Input
                label="Monthly spending cap (USD)"
                value={f.monthly_cap_usd}
                onChange={(e) => set('monthly_cap_usd', e.target.value)}
                helperText="Visitors' runs are charged to your balance at the model's price. The demo pauses when the cap is reached. 20 runs per visitor per minute."
              />
              <Switch checked={f.published} onChange={(v) => set('published', v)} label="Published" description="Off: only you can see it here." />
            </div>
          </Card>
        </div>
        <div className="xl:sticky xl:top-6 space-y-2">
          <p className="text-xs text-muted">Live preview. Runs here are charged to you like the playground.</p>
          <div className="max-h-[80vh] overflow-auto rounded-l2">
            <ModelSiteView site={preview} onRun={runPreview} preview />
          </div>
        </div>
      </div>
      <ConfirmModal
        isOpen={deleting}
        title="Delete this site?"
        description="The address stops working right away."
        confirmLabel="Delete site"
        danger
        onConfirm={remove}
        onCancel={() => setDeleting(false)}
      />
    </>
  );
}
