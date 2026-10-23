import { useEffect, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import type { PublicSite, SitePrediction } from '@layerto/types';
import { cn } from '../lib/cn';
import { BoundingBoxCanvas } from './BoundingBoxCanvas';
import { UploadZone } from './UploadZone';

const HEX = /^#[0-9a-fA-F]{6}$/;

function colors(site: PublicSite) {
  const dark = site.theme.mode === 'dark';
  const primary = HEX.test(site.theme.primary ?? '') ? site.theme.primary! : '#A3122A';
  const accent = HEX.test(site.theme.accent ?? '') ? site.theme.accent! : primary;
  const bg = HEX.test(site.theme.background ?? '') ? site.theme.background! : dark ? '#0F1013' : '#F7F7F8';
  return {
    '--site-primary': primary,
    '--site-accent': accent,
    '--site-bg': bg,
    '--site-card': dark ? 'rgba(255,255,255,0.05)' : '#FFFFFF',
    '--site-ink': dark ? '#ECEDEF' : '#15161A',
    '--site-muted': dark ? '#A0A3AD' : '#5B5F6B',
    '--site-line': dark ? 'rgba(255,255,255,0.12)' : '#E3E5EA',
  } as CSSProperties;
}

const FONT: Record<string, string> = { sans: 'font-sans', serif: 'font-serif', mono: 'font-mono' };

export interface ModelSiteViewProps {
  site: PublicSite;
  /** Sends the image to the site's server-side proxy. Never put an API key in this callback's page. */
  onRun: (file: File) => Promise<SitePrediction[]>;
  /** Inside the dashboard editor: smaller, no full-height layout. */
  preview?: boolean;
}

/** A model's public website, rendered from one of the three templates. */
export function ModelSiteView({ site, onRun, preview = false }: ModelSiteViewProps) {
  return (
    <div
      style={colors(site)}
      className={cn(
        '@container bg-[var(--site-bg)] text-[var(--site-ink)]',
        FONT[site.theme.font ?? 'sans'] ?? 'font-sans',
        preview ? 'rounded-l2 overflow-hidden border border-line' : 'min-h-screen',
      )}
    >
      {site.template === 'product' ? (
        <ProductTemplate site={site} onRun={onRun} />
      ) : site.template === 'research' ? (
        <ResearchTemplate site={site} onRun={onRun} />
      ) : (
        <DemoTemplate site={site} onRun={onRun} />
      )}
      <footer className="px-6 py-6 text-center text-xs text-[var(--site-muted)] border-t border-[var(--site-line)]">
        {site.owner ? <>Made by @{site.owner} · </> : null}Runs on Layerto. Uploaded images are processed in memory and never stored.
      </footer>
    </div>
  );
}

function Cta({ site }: { site: PublicSite }) {
  if (!site.cta_label || !/^(https:\/\/|mailto:)/.test(site.cta_url)) return null;
  return (
    <a
      href={site.cta_url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center rounded-full px-5 py-2.5 text-sm font-semibold no-underline text-white bg-[var(--site-primary)] hover:opacity-90"
    >
      {site.cta_label}
    </a>
  );
}

function Metrics({ site }: { site: PublicSite }) {
  const items: [string, string][] = [];
  if (typeof site.metrics.map50_95 === 'number') items.push(['mAP 50–95', (site.metrics.map50_95 * 100).toFixed(1) + '%']);
  if (typeof site.metrics.map50 === 'number') items.push(['mAP 50', (site.metrics.map50 * 100).toFixed(1) + '%']);
  items.push(['Classes', String(site.classes.length)]);
  return (
    <dl className="grid grid-cols-3 gap-3">
      {items.map(([k, v]) => (
        <div key={k} className="rounded-xl border border-[var(--site-line)] bg-[var(--site-card)] p-3">
          <dt className="text-xs text-[var(--site-muted)]">{k}</dt>
          <dd className="mt-1 text-lg font-semibold">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

function ClassList({ classes }: { classes: string[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {classes.map((c) => (
        <span key={c} className="rounded-full border border-[var(--site-line)] px-3 py-1 text-xs">
          {c}
        </span>
      ))}
    </div>
  );
}

function TryIt({ site, onRun }: { site: PublicSite; onRun: (file: File) => Promise<SitePrediction[]> }) {
  const [file, setFile] = useState<File | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [preds, setPreds] = useState<SitePrediction[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => () => {
    if (url) URL.revokeObjectURL(url);
  }, [url]);

  const choose = (f: File) => {
    setFile(f);
    setPreds(null);
    setError(null);
    setUrl(URL.createObjectURL(f));
  };

  const run = async () => {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      setPreds(await onRun(file));
    } catch (err) {
      const msg = (err as { error?: { message?: string } })?.error?.message;
      setError(msg || "Couldn't run the model. Try again.");
    } finally {
      setBusy(false);
    }
  };

  if (!site.available) {
    return (
      <div className="rounded-2xl border border-[var(--site-line)] bg-[var(--site-card)] p-6 text-sm text-[var(--site-muted)]">
        The live demo is paused for now. Please check back later.
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-[var(--site-line)] bg-[var(--site-card)] p-4 @xl:p-5 space-y-4">
      <UploadZone onFile={choose} onInvalid={setError} disabled={busy} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-sm text-[var(--site-muted)] truncate max-w-[60%]">{file ? file.name : 'Choose an image to try it'}</span>
        <button
          type="button"
          onClick={run}
          disabled={!file || busy}
          className="rounded-full px-5 py-2 text-sm font-semibold text-white bg-[var(--site-primary)] disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
        >
          {busy ? 'Detecting…' : 'Detect objects'}
        </button>
      </div>
      {error && <p role="alert" className="text-sm text-red-500">{error}</p>}
      {url && (
        <BoundingBoxCanvas imageSrc={url} predictions={(preds ?? []).map((p) => ({ ...p, bbox: p.bbox ?? null }))} confidenceThreshold={0.25} />
      )}
      {preds && (
        <p className="text-sm text-[var(--site-muted)]">
          {preds.length === 0
            ? 'Nothing found in this image.'
            : `${preds.length} found: ` +
              Object.entries(
                preds.reduce<Record<string, number>>((acc, p) => {
                  acc[p.label] = (acc[p.label] ?? 0) + 1;
                  return acc;
                }, {}),
              )
                .map(([l, n]) => `${n} × ${l}`)
                .join(', ')}
        </p>
      )}
    </div>
  );
}

function Section({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={cn('mx-auto w-full max-w-5xl px-5 @xl:px-8', className)}>{children}</section>;
}

function DemoTemplate({ site, onRun }: { site: PublicSite; onRun: ModelSiteViewProps['onRun'] }) {
  return (
    <>
      <Section className="pt-14 pb-8 text-center space-y-4">
        <p className="text-xs font-semibold uppercase tracking-widest text-[var(--site-accent)]">{site.model_name}</p>
        <h1 className="text-3xl @xl:text-5xl font-bold tracking-tight">{site.title}</h1>
        {site.tagline && <p className="mx-auto max-w-2xl text-lg text-[var(--site-muted)]">{site.tagline}</p>}
        <div className="pt-2"><Cta site={site} /></div>
      </Section>
      <Section className="pb-12 max-w-3xl">
        <TryIt site={site} onRun={onRun} />
      </Section>
      {(site.description || site.classes.length > 0) && (
        <Section className="pb-14 max-w-3xl space-y-4">
          {site.description && <p className="whitespace-pre-line leading-relaxed">{site.description}</p>}
          <ClassList classes={site.classes} />
        </Section>
      )}
    </>
  );
}

function ProductTemplate({ site, onRun }: { site: PublicSite; onRun: ModelSiteViewProps['onRun'] }) {
  return (
    <>
      <header className="border-b border-[var(--site-line)]">
        <Section className="flex items-center justify-between py-4">
          <span className="font-bold">{site.title}</span>
          <Cta site={site} />
        </Section>
      </header>
      <Section className="grid gap-10 py-14 @4xl:grid-cols-2 @4xl:items-center">
        <div className="space-y-5">
          <h1 className="text-3xl @xl:text-5xl font-bold tracking-tight">{site.tagline || site.title}</h1>
          {site.description && <p className="whitespace-pre-line leading-relaxed text-[var(--site-muted)]">{site.description}</p>}
          <Metrics site={site} />
        </div>
        <TryIt site={site} onRun={onRun} />
      </Section>
      <Section className="pb-16 space-y-4">
        <h2 className="text-xl font-semibold">What it detects</h2>
        <ClassList classes={site.classes} />
      </Section>
    </>
  );
}

function ResearchTemplate({ site, onRun }: { site: PublicSite; onRun: ModelSiteViewProps['onRun'] }) {
  return (
    <Section className="max-w-3xl py-14 space-y-8">
      <div className="space-y-3 text-center">
        <h1 className="text-3xl @xl:text-4xl font-bold tracking-tight">{site.title}</h1>
        {site.owner && <p className="text-[var(--site-muted)]">@{site.owner}</p>}
        {site.tagline && <p className="text-lg">{site.tagline}</p>}
        <div className="flex justify-center"><Cta site={site} /></div>
      </div>
      {site.description && (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-[var(--site-accent)]">Abstract</h2>
          <p className="whitespace-pre-line leading-relaxed">{site.description}</p>
        </div>
      )}
      <div className="space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-[var(--site-accent)]">Results</h2>
        <Metrics site={site} />
        <p className="text-xs text-[var(--site-muted)]">Measured on the held-out split of the training dataset.</p>
      </div>
      <div className="space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-[var(--site-accent)]">Classes</h2>
        <ClassList classes={site.classes} />
      </div>
      <div className="space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-[var(--site-accent)]">Try it</h2>
        <TryIt site={site} onRun={onRun} />
      </div>
    </Section>
  );
}
