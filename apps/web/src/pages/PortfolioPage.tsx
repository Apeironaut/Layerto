import { useEffect, useState } from 'react';
import type { PublicPortfolio } from '@layerto/types';
import { Icon, Markdown, Skeleton, cn, usd } from '@layerto/ui';
import { LayertoClient } from '@layerto/api-client';
import { API_URL, SITE_URL } from '../config';
import { useSeo } from '../hooks/useSeo';

const client = new LayertoClient(API_URL);

const pct = (v: unknown) => (typeof v === 'number' ? `${(v * 100).toFixed(1)}%` : '—');

/** A researcher's personal site, served at <subdomain>.layerto.com (or /portfolio/<subdomain> as a preview). */
export function PortfolioPage({ subdomain }: { subdomain: string }) {
  const [p, setP] = useState<PublicPortfolio | null>(null);
  const [missing, setMissing] = useState(false);
  useEffect(() => {
    let alive = true;
    client.publicPortfolio(subdomain).then(
      (x) => alive && setP(x),
      () => alive && setMissing(true),
    );
    return () => {
      alive = false;
    };
  }, [subdomain]);
  useSeo(p ? `${p.name || p.username} · Research` : 'Portfolio', p?.headline || p?.bio || 'Research portfolio on Layerto.');

  if (missing) {
    return (
      <div className="grid min-h-screen place-items-center bg-page px-4 text-center text-ink">
        <div>
          <h1 className="text-2xl font-bold">This site isn’t available</h1>
          <p className="mt-2 text-muted">There’s no published portfolio at this address.</p>
          <a href={SITE_URL} className="mt-6 inline-block text-crimson">
            Go to Layerto
          </a>
        </div>
      </div>
    );
  }
  if (!p) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-24">
        <Skeleton className="h-96" />
      </div>
    );
  }
  const primary = p.theme.primary || '#E11D48';
  const dark = p.theme.mode === 'dark';
  const has = (s: string) => p.sections.includes(s);
  const fg = dark ? '#E5E7EB' : '#111827';
  const border = dark ? '#1F2937' : '#E5E7EB';
  const surface = dark ? '#111827' : '#F9FAFB';

  return (
    <div className={cn('min-h-screen', p.theme.font === 'serif' && 'font-serif', p.theme.font === 'mono' && 'font-mono')} style={{ background: dark ? '#0B0F17' : '#FFFFFF', color: fg }}>
      <div className="mx-auto max-w-3xl px-6 py-20">
        <header>
          <div className="h-1.5 w-14 rounded-full" style={{ background: primary }} />
          <h1 className="mt-6 text-4xl font-bold tracking-tight sm:text-5xl">{p.name || p.username}</h1>
          {(p.headline || p.affiliation) && (
            <p className="mt-3 text-lg opacity-75">
              {p.headline}
              {p.headline && p.affiliation && ' · '}
              {p.affiliation}
            </p>
          )}
          <nav className="mt-6 flex flex-wrap gap-4 text-sm">
            {['papers', 'models', 'projects', 'findings', 'datasets']
              .filter((s) => has(s))
              .map((s) => (
                <a key={s} href={`#${s}`} className="capitalize opacity-70 hover:opacity-100" style={{ textDecorationColor: primary }}>
                  {s}
                </a>
              ))}
            {p.website && (
              <a href={p.website} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 opacity-70 hover:opacity-100">
                <Icon name="external" size={13} /> Website
              </a>
            )}
          </nav>
        </header>

        {has('about') && (p.about || p.bio) && (
          <section className="mt-12 leading-relaxed opacity-90">
            <Markdown text={p.about || p.bio} />
          </section>
        )}

        {has('papers') && p.papers.length > 0 && (
          <Section id="papers" title="Papers" color={primary}>
            {p.papers.map((x) => (
              <a key={x.id} href={`${SITE_URL}/papers/${x.id}`} className="block py-4 transition-opacity hover:opacity-80" style={{ borderTop: `1px solid ${border}` }}>
                <div className="font-semibold leading-snug">{x.title}</div>
                <div className="mt-1 text-sm opacity-60">
                  {x.authors.join(', ')}
                  {x.venue && ` · ${x.venue}`} {x.year}
                </div>
              </a>
            ))}
          </Section>
        )}

        {has('models') && p.models.length > 0 && (
          <Section id="models" title="Models" color={primary}>
            <div className="grid gap-3 pt-2 sm:grid-cols-2">
              {p.models.map((m) => (
                <a key={m.slug} href={`${SITE_URL}/models/${m.slug}`} className="rounded-xl p-4 transition-transform hover:-translate-y-0.5" style={{ border: `1px solid ${border}`, background: surface }}>
                  <div className="font-semibold">{m.name}</div>
                  <div className="mt-1 line-clamp-2 text-xs opacity-60">{m.description || m.classes.join(', ')}</div>
                  <div className="mt-3 flex items-baseline gap-2">
                    <span className="text-2xl font-bold" style={{ color: primary }}>
                      {pct(m.metrics.map50_95)}
                    </span>
                    <span className="text-xs opacity-60">mAP50-95</span>
                  </div>
                </a>
              ))}
            </div>
          </Section>
        )}

        {has('projects') && p.projects.length > 0 && (
          <Section id="projects" title="Projects" color={primary}>
            {p.projects.map((x) => (
              <a key={x.id} href={`${SITE_URL}/@${p.username}/${x.slug}`} className="block py-4 hover:opacity-80" style={{ borderTop: `1px solid ${border}` }}>
                <div className="font-semibold">{x.name}</div>
                <div className="mt-1 text-sm opacity-60">
                  {x.description}
                  {x.best_map != null && ` · best mAP ${pct(x.best_map)}`}
                </div>
              </a>
            ))}
          </Section>
        )}

        {has('findings') && p.findings.length > 0 && (
          <Section id="findings" title="Findings" color={primary}>
            {p.findings.map((f, i) => (
              <div key={i} className="py-4" style={{ borderTop: `1px solid ${border}` }}>
                <div className="text-xs uppercase tracking-wider opacity-50">
                  {f.area} · {f.confidence} confidence
                </div>
                <div className="mt-1 font-semibold">{f.title}</div>
                {f.body && (
                  <div className="mt-1 text-sm opacity-80">
                    <Markdown text={f.body} compact />
                  </div>
                )}
              </div>
            ))}
          </Section>
        )}

        {has('datasets') && p.datasets.length > 0 && (
          <Section id="datasets" title="Datasets" color={primary}>
            {p.datasets.map((d) => (
              <div key={d.id} className="flex items-center justify-between py-3" style={{ borderTop: `1px solid ${border}` }}>
                <span>
                  {d.title} <span className="text-xs opacity-50">· {d.images} images · {d.license.replace(/_/g, ' ')}</span>
                </span>
                <span className="font-semibold">{Number(d.price_usd) ? usd(d.price_usd) : 'Free'}</span>
              </div>
            ))}
          </Section>
        )}

        <footer className="mt-20 text-center text-xs opacity-50">
          <a href={SITE_URL}>Built with Layerto</a>
        </footer>
      </div>
    </div>
  );
}

function Section({ id, title, color, children }: { id: string; title: string; color: string; children: React.ReactNode }) {
  return (
    <section id={id} className="mt-14 scroll-mt-10">
      <h2 className="mb-2 text-xs font-bold uppercase tracking-[0.2em]" style={{ color }}>
        {title}
      </h2>
      {children}
    </section>
  );
}
