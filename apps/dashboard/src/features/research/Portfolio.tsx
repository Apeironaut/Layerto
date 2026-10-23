import { useEffect, useState } from 'react';
import { errorMessage } from '@layerto/api-client';
import type { PortfolioSettings } from '@layerto/types';
import { Alert, Button, Card, Icon, Input, Markdown, Skeleton, Switch, cn, usd, useNotify, useResource } from '@layerto/ui';
import { api } from '../../lib/api';
import { ROOT_DOMAIN, SITE_URL } from '../../config';
import { useHub } from '../../hub/HubContext';
import { pct } from '../studio/lib/format';
import { TextArea } from './shared';

const SECTIONS: { id: string; label: string; hint: string }[] = [
  { id: 'about', label: 'About', hint: 'Headline, bio and affiliation' },
  { id: 'papers', label: 'Papers', hint: 'Papers you published on Layerto' },
  { id: 'projects', label: 'Projects', hint: 'Projects marked public' },
  { id: 'models', label: 'Models', hint: 'Public models with metrics' },
  { id: 'findings', label: 'Findings', hint: 'Confirmed findings in public areas' },
  { id: 'datasets', label: 'Datasets', hint: 'Datasets you sell' },
];

const PALETTE = ['#E11D48', '#2563EB', '#16A34A', '#7C3AED', '#D97706', '#0F172A'];

/** Settings and live preview for the personal research site at <name>.layerto.com. */
export function PortfolioView() {
  const notify = useNotify();
  const { user, reloadPlan, reloadBalance } = useHub();
  const settings = useResource(() => api.portfolio(), 'portfolio');
  const profile = useResource(() => api.studioProfile(), 'studio-profile');
  const papers = useResource(() => api.papers(), 'papers-');
  const models = useResource(() => api.studioModels(), 'studio-models');
  const [f, setF] = useState<PortfolioSettings | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (settings.data) setF({ ...settings.data, subdomain: settings.data.subdomain || (user.username ?? '').replace(/_/g, '-').toLowerCase() });
  }, [settings.data, user.username]);

  if (!f) return <Skeleton className="h-96" />;
  const set = (p: Partial<PortfolioSettings>) => setF({ ...f, ...p });
  const theme = { primary: '#E11D48', mode: 'light' as const, font: 'sans' as const, ...f.theme };
  const host = `${f.subdomain || 'you'}.${ROOT_DOMAIN}`;

  const save = async (patch: Partial<PortfolioSettings> = {}) => {
    const next = { ...f, ...patch };
    setBusy(true);
    try {
      const r = await api.savePortfolio({ subdomain: next.subdomain, enabled: next.enabled, theme: next.theme, sections: next.sections, about: next.about });
      setF(r);
      notify(r.enabled ? 'Your site is live' : 'Saved', 'success');
    } catch (err) {
      notify(errorMessage(err, "Couldn't save the site."), 'error');
    } finally {
      setBusy(false);
    }
  };
  const buy = async () => {
    setBusy(true);
    try {
      await api.buyAddon('portfolio');
      await reloadPlan();
      reloadBalance();
      await settings.reload();
      notify('Portfolio add-on active', 'success');
    } catch (err) {
      notify(errorMessage(err, "Couldn't add the portfolio site."), 'error');
    } finally {
      setBusy(false);
    }
  };

  const showPapers = (papers.data ?? []).filter((p) => p.on_layerto);
  const showModels = (models.data ?? []).filter((m) => m.visibility === 'public');
  const name = [user.first_name, user.last_name].filter(Boolean).join(' ') || user.username || 'Your name';
  const dark = theme.mode === 'dark';

  return (
    <div className="grid gap-4 xl:grid-cols-[420px_1fr]">
      <div className="space-y-4">
        {!f.addon_active && (
          <Card className="relative overflow-hidden">
            <div aria-hidden className="pointer-events-none absolute -right-10 -top-10 size-40 rounded-full bg-crimson/15 blur-2xl" />
            <div className="relative">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Icon name="globe" size={16} className="text-crimson" /> Portfolio site add-on
              </div>
              <p className="mt-1 text-sm text-muted">
                A personal site at <strong>{host}</strong> with your papers, models and findings, kept up to date automatically. {usd(f.addon_price_usd)} per 30 days.
              </p>
              <Button className="mt-3" icon="sparkles" loading={busy} onClick={buy}>
                Add for {usd(f.addon_price_usd)}
              </Button>
              <p className="mt-2 text-[11px] text-muted">You can set everything up and preview it first. AI agents that design the site for you are coming later.</p>
            </div>
          </Card>
        )}
        <Card title="Address">
          <div className="flex items-end gap-1">
            <div className="flex-1">
              <Input label="Subdomain" value={f.subdomain} maxLength={32} onChange={(e) => set({ subdomain: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })} />
            </div>
            <span className="pb-2.5 text-sm text-muted">.{ROOT_DOMAIN}</span>
          </div>
          <div className="mt-4">
            <Switch
              checked={f.enabled}
              disabled={!f.addon_active}
              onChange={(v) => void save({ enabled: v })}
              label="Site is live"
              description={f.addon_active ? (f.enabled ? `https://${host}` : 'Visitors see a “not found” page until you turn this on.') : 'Needs the add-on.'}
            />
          </div>
          {f.enabled && f.saved && (
            <div className="mt-3 flex flex-wrap gap-2">
              <a href={`https://${host}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm font-semibold text-crimson hover:underline">
                <Icon name="external" size={14} /> Open site
              </a>
              <a href={`${SITE_URL}/portfolio/${f.subdomain}`} target="_blank" rel="noreferrer" className="text-sm text-muted hover:text-crimson">
                Preview link
              </a>
            </div>
          )}
        </Card>
        <Card title="Look">
          <div className="space-y-4">
            <div>
              <span className="mb-1.5 block text-sm font-medium">Accent colour</span>
              <div className="flex flex-wrap items-center gap-2">
                {PALETTE.map((c) => (
                  <button
                    key={c}
                    type="button"
                    aria-label={c}
                    onClick={() => set({ theme: { ...f.theme, primary: c } })}
                    className={cn('size-8 rounded-full border-2 cursor-pointer transition-transform hover:scale-110', theme.primary === c ? 'border-ink scale-110' : 'border-transparent')}
                    style={{ background: c }}
                  />
                ))}
                <input type="color" value={theme.primary} onChange={(e) => set({ theme: { ...f.theme, primary: e.target.value.toUpperCase() } })} aria-label="Custom colour" className="size-8 cursor-pointer rounded-full border border-line bg-transparent" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Toggle label="Mode" value={theme.mode} options={['light', 'dark']} onChange={(mode) => set({ theme: { ...f.theme, mode: mode as 'light' | 'dark' } })} />
              <Toggle label="Font" value={theme.font} options={['sans', 'serif', 'mono']} onChange={(font) => set({ theme: { ...f.theme, font: font as 'sans' | 'serif' | 'mono' } })} />
            </div>
          </div>
        </Card>
        <Card title="Sections">
          <ul className="space-y-1">
            {SECTIONS.map((s) => {
              const on = f.sections.includes(s.id);
              return (
                <li key={s.id}>
                  <label className="flex items-center gap-3 rounded-control px-2 py-2 hover:bg-page cursor-pointer">
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={() => set({ sections: on ? f.sections.filter((x) => x !== s.id) : [...f.sections, s.id] })}
                      className="size-4 accent-[var(--color-crimson)]"
                    />
                    <span className="flex-1">
                      <span className="block text-sm font-medium">{s.label}</span>
                      <span className="block text-[11px] text-muted">{s.hint}</span>
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        </Card>
        <Card title="About">
          <TextArea label="Intro (Markdown)" value={f.about} onChange={(about) => set({ about })} rows={6} maxLength={10000} placeholder="I study efficient object detection for agriculture at …" hint="Your headline, bio and affiliation come from your public profile in Settings." />
        </Card>
        <div className="sticky bottom-4 flex justify-end">
          <Button loading={busy} icon="check" onClick={() => void save()} disabled={f.subdomain.length < 3}>
            Save site
          </Button>
        </div>
      </div>

      <div className="xl:sticky xl:top-4 xl:self-start">
        <div className="overflow-hidden rounded-l2 border border-line shadow-l3">
          <div className="flex items-center gap-2 border-b border-line bg-page px-3 py-2">
            <span className="flex gap-1.5">
              <span className="size-2.5 rounded-full bg-red-400" />
              <span className="size-2.5 rounded-full bg-amber-400" />
              <span className="size-2.5 rounded-full bg-emerald-400" />
            </span>
            <span className="mx-auto flex items-center gap-1.5 rounded-pill bg-card px-3 py-0.5 text-xs text-muted">
              <Icon name="lock" size={11} /> {host}
            </span>
          </div>
          <div
            className={cn('max-h-[75vh] overflow-y-auto px-8 py-10', theme.font === 'serif' && 'font-serif', theme.font === 'mono' && 'font-mono')}
            style={{ background: dark ? '#0B0F17' : '#FFFFFF', color: dark ? '#E5E7EB' : '#111827' }}
          >
            <div className="mx-auto max-w-2xl">
              <div className="h-1 w-12 rounded-pill" style={{ background: theme.primary }} />
              <h2 className="mt-5 text-3xl font-bold tracking-tight">{name}</h2>
              <p className="mt-1 text-sm opacity-70">{profile.data?.headline || 'Your headline'}{profile.data?.affiliation ? ` · ${profile.data.affiliation}` : ''}</p>
              {f.sections.includes('about') && (
                <section className="mt-6 text-sm leading-relaxed opacity-90">
                  <Markdown text={f.about || profile.data?.bio || '_Write a short intro on the left._'} compact />
                </section>
              )}
              {f.sections.includes('papers') && (
                <PreviewSection title="Papers" color={theme.primary} empty={showPapers.length === 0 ? 'Publish a paper on Layerto to list it here.' : ''}>
                  {showPapers.slice(0, 4).map((p) => (
                    <div key={p.id} className="py-2.5">
                      <div className="font-semibold">{p.title}</div>
                      <div className="text-xs opacity-60">
                        {p.authors.join(', ')}
                        {p.venue && ` · ${p.venue}`} {p.year}
                      </div>
                    </div>
                  ))}
                </PreviewSection>
              )}
              {f.sections.includes('models') && (
                <PreviewSection title="Models" color={theme.primary} empty={showModels.length === 0 ? 'Public models appear here with their metrics.' : ''}>
                  <div className="grid gap-3 py-2 sm:grid-cols-2">
                    {showModels.slice(0, 4).map((m) => (
                      <div key={m.slug} className="rounded-lg border p-3" style={{ borderColor: dark ? '#1F2937' : '#E5E7EB' }}>
                        <div className="font-semibold">{m.name}</div>
                        <div className="mt-1 text-xs opacity-60">{m.classes.slice(0, 4).join(', ')}</div>
                        <div className="mt-2 text-lg font-bold" style={{ color: theme.primary }}>
                          {pct(m.metrics.map50_95)} <span className="text-xs font-normal opacity-60">mAP50-95</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </PreviewSection>
              )}
              {f.sections.includes('projects') && <PreviewSection title="Projects" color={theme.primary} empty="Projects you mark public are listed here." />}
              {f.sections.includes('findings') && <PreviewSection title="Findings" color={theme.primary} empty="Confirmed findings from public research areas." />}
              {f.sections.includes('datasets') && <PreviewSection title="Datasets" color={theme.primary} empty="Datasets you sell on the marketplace." />}
              <p className="mt-10 text-center text-[11px] opacity-50">Built with Layerto</p>
            </div>
          </div>
        </div>
        {!f.addon_active && (
          <Alert tone="info" className="mt-3">
            This is a preview. Turn on the add-on to publish it.
          </Alert>
        )}
      </div>
    </div>
  );
}

function PreviewSection({ title, color, empty, children }: { title: string; color: string; empty?: string; children?: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h3 className="text-xs font-bold uppercase tracking-widest" style={{ color }}>
        {title}
      </h3>
      <div className="mt-2 divide-y divide-current/10">{empty ? <p className="py-2 text-sm italic opacity-50">{empty}</p> : children}</div>
    </section>
  );
}

function Toggle({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (v: string) => void }) {
  return (
    <div>
      <span className="mb-1.5 block text-sm font-medium">{label}</span>
      <div className="flex rounded-control border border-line p-0.5">
        {options.map((o) => (
          <button key={o} type="button" onClick={() => onChange(o)} className={cn('flex-1 rounded px-2 py-1 text-xs capitalize cursor-pointer', value === o ? 'bg-ink text-page' : 'text-muted hover:text-ink')}>
            {o}
          </button>
        ))}
      </div>
    </div>
  );
}
