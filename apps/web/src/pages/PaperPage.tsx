import { useEffect, useState } from 'react';
import type { PublicPaper } from '@layerto/types';
import { CopyButton, Icon, Skeleton } from '@layerto/ui';
import { LayertoClient } from '@layerto/api-client';
import { API_URL } from '../config';
import { useSeo } from '../hooks/useSeo';

const client = new LayertoClient(API_URL);

/** Public page of a paper published on Layerto: abstract, PDF, BibTeX and the models behind it. */
export function PaperPage({ id, navigate }: { id: string; navigate: (to: string) => void }) {
  const [paper, setPaper] = useState<PublicPaper | null>(null);
  const [missing, setMissing] = useState(false);
  useEffect(() => {
    let alive = true;
    client.publicPaper(id).then(
      (p) => alive && setPaper(p),
      () => alive && setMissing(true),
    );
    return () => {
      alive = false;
    };
  }, [id]);
  useSeo(paper ? `${paper.title} · Layerto` : 'Paper · Layerto', paper?.abstract.slice(0, 160) ?? 'A paper published on Layerto.');

  if (missing) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-24 text-center">
        <h1 className="text-2xl font-bold">Paper not found</h1>
        <p className="mt-2 text-muted">It may have been unpublished.</p>
        <button type="button" className="mt-6 text-crimson cursor-pointer" onClick={() => navigate('/papers')}>
          Browse papers
        </button>
      </div>
    );
  }
  if (!paper) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16">
        <Skeleton className="h-96" />
      </div>
    );
  }
  return (
    <article className="mx-auto max-w-3xl px-4 py-14 sm:px-8">
      <button type="button" onClick={() => navigate('/papers')} className="inline-flex items-center gap-1 text-sm text-muted hover:text-crimson cursor-pointer">
        <Icon name="arrowLeft" size={14} /> Papers
      </button>
      <div className="mt-6 flex flex-wrap gap-2 text-xs">
        {paper.venue && <span className="rounded-pill bg-crimson-tint px-2.5 py-1 font-semibold text-crimson">{paper.venue} {paper.year}</span>}
        <span className="rounded-pill bg-card px-2.5 py-1 capitalize text-muted">{paper.status.replace('_', ' ')}</span>
      </div>
      <h1 className="mt-4 text-3xl font-bold leading-tight tracking-tight sm:text-4xl">{paper.title}</h1>
      <p className="mt-3 text-lg text-ink-secondary">{paper.authors.join(', ')}</p>
      <p className="mt-1 text-sm text-muted">
        Published on Layerto by{' '}
        <button type="button" className="text-crimson cursor-pointer" onClick={() => navigate(`/@${paper.owner}`)}>
          @{paper.owner}
        </button>
        {paper.published_at && ` · ${new Date(paper.published_at).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })}`}
      </p>
      <div className="mt-6 flex flex-wrap gap-2">
        {paper.has_pdf && (
          <a href={client.publicPaperPdfUrl(paper.id)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-control bg-crimson px-4 py-2 text-sm font-semibold text-white hover:bg-crimson-fill">
            <Icon name="download" size={15} /> PDF
          </a>
        )}
        {paper.arxiv && (
          <a href={`https://arxiv.org/abs/${paper.arxiv}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-control border border-line px-4 py-2 text-sm hover:border-crimson">
            arXiv
          </a>
        )}
        {paper.doi && (
          <a href={`https://doi.org/${paper.doi}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-control border border-line px-4 py-2 text-sm hover:border-crimson">
            DOI
          </a>
        )}
        {paper.url && (
          <a href={paper.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-control border border-line px-4 py-2 text-sm hover:border-crimson">
            <Icon name="external" size={14} /> Link
          </a>
        )}
      </div>
      <section className="mt-10">
        <h2 className="text-xs font-bold uppercase tracking-widest text-muted">Abstract</h2>
        <p className="mt-3 whitespace-pre-line leading-relaxed">{paper.abstract}</p>
      </section>
      {paper.keywords.length > 0 && (
        <div className="mt-6 flex flex-wrap gap-1.5">
          {paper.keywords.map((k) => (
            <span key={k} className="rounded-pill bg-card px-2.5 py-1 text-xs">
              {k}
            </span>
          ))}
        </div>
      )}
      {paper.model_slugs.length > 0 && (
        <section className="mt-10">
          <h2 className="text-xs font-bold uppercase tracking-widest text-muted">Models</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {paper.model_slugs.map((s) => (
              <button key={s} type="button" onClick={() => navigate(`/models/${s}`)} className="inline-flex items-center gap-2 rounded-control border border-line bg-card px-3 py-2 text-sm hover:border-crimson cursor-pointer">
                <Icon name="box" size={15} className="text-crimson" /> {s}
              </button>
            ))}
          </div>
        </section>
      )}
      <section className="mt-10">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-widest text-muted">Cite</h2>
          <CopyButton text={paper.bibtex} label="Copy BibTeX" />
        </div>
        <pre className="mt-3 overflow-x-auto rounded-l2 border border-line bg-card p-4 text-[12.5px] leading-relaxed">{paper.bibtex}</pre>
      </section>
    </article>
  );
}

/** All papers published on Layerto. */
export function PapersPage({ navigate }: { navigate: (to: string) => void }) {
  const [q, setQ] = useState('');
  const [papers, setPapers] = useState<PublicPaper[] | null>(null);
  useSeo('Papers · Layerto', 'Computer vision research published on Layerto, with PDFs, BibTeX and the models behind each paper.');
  useEffect(() => {
    let alive = true;
    const t = setTimeout(() => {
      client.publicPapers({ q: q.trim() }).then(
        (p) => alive && setPapers(p),
        () => alive && setPapers([]),
      );
    }, 250);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [q]);
  return (
    <div className="mx-auto max-w-4xl px-4 py-14 sm:px-8">
      <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Papers</h1>
      <p className="mt-2 text-muted">Research published on Layerto, often with the trained models you can call.</p>
      <label className="mt-6 flex h-11 items-center gap-2 rounded-control border border-line bg-card px-3">
        <Icon name="search" size={16} className="text-muted" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search titles, abstracts and keywords" className="flex-1 bg-transparent text-sm outline-none" aria-label="Search papers" />
      </label>
      <div className="mt-6 space-y-3">
        {papers === null && <Skeleton className="h-40" />}
        {papers?.length === 0 && <p className="py-10 text-center text-muted">No papers yet.</p>}
        {papers?.map((p) => (
          <button key={p.id} type="button" onClick={() => navigate(`/papers/${p.id}`)} className="block w-full rounded-l2 border border-line bg-card p-5 text-left transition-colors hover:border-crimson cursor-pointer">
            <div className="text-xs text-muted">
              {p.venue && `${p.venue} ${p.year ?? ''} · `}@{p.owner}
            </div>
            <h2 className="mt-1 text-lg font-semibold leading-snug">{p.title}</h2>
            <p className="mt-1 text-sm text-muted">{p.authors.join(', ')}</p>
            <p className="mt-2 line-clamp-2 text-sm text-ink-secondary">{p.abstract}</p>
          </button>
        ))}
      </div>
    </div>
  );
}
