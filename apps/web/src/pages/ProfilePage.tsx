import { useEffect, useState } from 'react';
import type { PublicModelSummary, PublicProfile, PublicProjectPage } from '@layerto/types';
import { Button, Card, Chip, CopyButton, Icon, Skeleton, usd } from '@layerto/ui';
import { useSeo } from '../hooks/useSeo';
import { PUBLIC_API_URL } from '../config';
import { pct, studioClient } from '../lib/studio';

function useLoad<T>(load: () => Promise<T>, key: string) {
  const [state, setState] = useState<{ status: 'loading' | 'ready' | 'missing'; data?: T }>({ status: 'loading' });
  useEffect(() => {
    let alive = true;
    setState({ status: 'loading' });
    load().then(
      (data) => alive && setState({ status: 'ready', data }),
      () => alive && setState({ status: 'missing' }),
    );
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return state;
}

function Missing({ what, navigate }: { what: string; navigate: (to: string) => void }) {
  return (
    <div className="max-w-xl mx-auto px-4 py-24 text-center">
      <h1 className="text-2xl font-bold">This {what} isn't public</h1>
      <p className="mt-2 text-muted">It may be private, or the address may have a typo.</p>
      <Button className="mt-6" onClick={() => navigate('/')}>Go to the home page</Button>
    </div>
  );
}

function ModelCard({ m }: { m: PublicModelSummary }) {
  const curl = `curl -X POST "${PUBLIC_API_URL}/v1/vision/${m.slug}" -H "Authorization: Bearer $LAYERTO_KEY" -F "image=@photo.jpg"`;
  return (
    <Card className="flex flex-col">
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-semibold text-ink">{m.name}</h3>
        {m.public_api ? <Chip variant="active">API</Chip> : <Chip variant="muted">Results only</Chip>}
      </div>
      {m.description && <p className="mt-2 text-sm text-ink-secondary line-clamp-3">{m.description}</p>}
      <p className="mt-3 text-xs text-muted">
        mAP {pct(m.metrics.map50_95)} · mAP50 {pct(m.metrics.map50)} · {m.classes.length} classes
      </p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {m.classes.slice(0, 8).map((c) => <Chip key={c} variant="neutral">{c}</Chip>)}
      </div>
      {m.public_api && (
        <div className="mt-4 flex items-center justify-between gap-2">
          <span className="text-xs text-muted">{usd(m.price_usd)} per call</span>
          <CopyButton text={curl} label="Copy cURL" />
        </div>
      )}
    </Card>
  );
}

export function ProfilePage({ username, navigate }: { username: string; navigate: (to: string) => void }) {
  const s = useLoad<PublicProfile>(() => studioClient.publicProfile(username), username);
  const p = s.data;
  const name = p ? [p.first_name, p.last_name].filter(Boolean).join(' ') || `@${p.username}` : `@${username}`;
  useSeo(`${name} — Layerto`, p?.headline || `Projects and models by @${username} on Layerto.`);
  if (s.status === 'missing') return <Missing what="profile" navigate={navigate} />;
  if (!p) return <div className="max-w-5xl mx-auto px-4 py-16"><Skeleton className="h-64" /></div>;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-14 space-y-10">
      <header className="flex flex-col sm:flex-row sm:items-center gap-6">
        <div className="grid size-20 shrink-0 place-items-center rounded-full bg-crimson text-white text-3xl font-bold">
          {name.replace('@', '').charAt(0).toUpperCase()}
        </div>
        <div className="space-y-1.5">
          <h1 className="text-3xl font-bold tracking-tight">{name}</h1>
          <p className="text-muted">@{p.username}{p.affiliation ? ` · ${p.affiliation}` : ''}</p>
          {p.headline && <p className="text-lg text-ink-secondary">{p.headline}</p>}
          {/^https?:\/\//.test(p.website) && (
            <a href={p.website} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-center gap-1 text-sm text-crimson">
              {p.website.replace(/^https?:\/\//, '')} <Icon name="external" size={14} />
            </a>
          )}
        </div>
      </header>
      {p.bio && <p className="max-w-3xl whitespace-pre-line leading-relaxed text-ink-secondary">{p.bio}</p>}

      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Projects</h2>
        {p.projects.length === 0 ? (
          <p className="text-muted text-sm">No public projects yet.</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {p.projects.map((pr) => (
              <a
                key={pr.id}
                href={`/@${p.username}/${pr.slug}`}
                onClick={(e) => {
                  e.preventDefault();
                  navigate(`/@${p.username}/${pr.slug}`);
                }}
                className="no-underline rounded-l2 border border-line bg-card p-5 hover:border-crimson transition-colors"
              >
                <h3 className="font-semibold text-ink">{pr.name}</h3>
                <p className="mt-1 text-sm text-muted line-clamp-2">{pr.description || 'No description'}</p>
                <p className="mt-3 text-xs text-muted">
                  {pr.datasets} datasets · {pr.models} models{pr.best_map != null ? ` · best mAP ${pct(pr.best_map)}` : ''}
                </p>
              </a>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Published models</h2>
        {p.models.length === 0 ? (
          <p className="text-muted text-sm">No published models yet.</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{p.models.map((m) => <ModelCard key={m.slug} m={m} />)}</div>
        )}
      </section>
    </div>
  );
}

export function PublicProjectView({ username, slug, navigate }: { username: string; slug: string; navigate: (to: string) => void }) {
  const s = useLoad<PublicProjectPage>(() => studioClient.publicProject(username, slug), `${username}/${slug}`);
  const d = s.data;
  useSeo(d ? `${d.project.name} — @${d.owner.username}` : 'Project — Layerto', d?.project.description || 'A research project on Layerto.');
  if (s.status === 'missing') return <Missing what="project" navigate={navigate} />;
  if (!d) return <div className="max-w-5xl mx-auto px-4 py-16"><Skeleton className="h-64" /></div>;
  const owner = [d.owner.first_name, d.owner.last_name].filter(Boolean).join(' ') || `@${d.owner.username}`;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-14 space-y-10">
      <header className="space-y-2">
        <a
          href={`/@${d.owner.username}`}
          onClick={(e) => {
            e.preventDefault();
            navigate(`/@${d.owner.username}`);
          }}
          className="text-sm text-crimson"
        >
          ← {owner}
        </a>
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">{d.project.name}</h1>
        {d.project.description && <p className="text-lg text-ink-secondary">{d.project.description}</p>}
      </header>
      {d.project.notes && (
        <Card title="Notes and results">
          <p className="whitespace-pre-line leading-relaxed text-ink-secondary">{d.project.notes}</p>
        </Card>
      )}
      {d.datasets.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-xl font-semibold">Datasets</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {d.datasets.map((ds) => (
              <div key={ds.name} className="rounded-l2 border border-line bg-card p-4">
                <p className="font-medium text-ink">{ds.name}</p>
                <p className="text-xs text-muted">{ds.labeled} labeled images · {ds.classes.join(', ')}</p>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted">Dataset images are private; only these summaries are public.</p>
        </section>
      )}
      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Models</h2>
        {d.models.length === 0 ? (
          <p className="text-sm text-muted">No models yet.</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{d.models.map((m) => <ModelCard key={m.slug} m={m} />)}</div>
        )}
      </section>
    </div>
  );
}
