import { useEffect, useState } from 'react';
import { errorMessage } from '@layerto/api-client';
import type { CommunityReport, DatasetListing } from '@layerto/types';
import { Button, Card, Chip, EmptyState, Input, Markdown, Modal, PageHeader, Reveal, SegmentedControl, Skeleton, StatCard, useNotify, useResource, usd } from '@layerto/ui';
import { api } from '../lib/api';

type Tab = 'overview' | 'reports' | 'posts' | 'listings';

function AuthImage({ path, className }: { path: string; className?: string }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let url: string | null = null;
    let alive = true;
    api.getBlob(path).then(
      (b) => {
        if (!alive) return;
        url = URL.createObjectURL(b);
        setSrc(url);
      },
      () => undefined,
    );
    return () => {
      alive = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [path]);
  return src ? <img src={src} alt="" className={className} /> : <div className={`${className ?? ''} bg-page`} />;
}

const when = (s?: string | null) => (s ? new Date(s).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—');

/** Community moderation, dataset listing review and hub-wide numbers. */
export function HubPage() {
  const [tab, setTab] = useState<Tab>('overview');
  const overview = useResource(() => api.adminHubOverview(), 'admin-hub-overview');
  const o = overview.data;
  return (
    <>
      <PageHeader title="Hub" description="Community, dataset marketplace, research, teams and portfolios." />
      <SegmentedControl<Tab>
        label="Section"
        value={tab}
        onChange={setTab}
        segments={[
          { value: 'overview', label: 'Overview' },
          { value: 'reports', label: `Reports${o?.open_reports ? ` (${o.open_reports})` : ''}` },
          { value: 'posts', label: 'Posts' },
          { value: 'listings', label: `Listings${o?.listings_pending ? ` (${o.listings_pending})` : ''}` },
        ]}
      />
      {tab === 'overview' && (
        <Reveal index={0}>
          {!o ? (
            <Skeleton className="h-48" />
          ) : (
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <StatCard label="Community posts" value={o.posts} hint={`${o.posts_7d} in the last 7 days`} />
                <StatCard label="Open reports" value={o.open_reports} />
                <StatCard label="Datasets on sale" value={o.listings_public} hint={`${o.listings_pending} waiting for review`} />
                <StatCard label="Dataset sales, 30 days" value={usd(o.sales_30d_usd)} hint={`${o.purchases} purchases in total`} />
                <StatCard label="Research areas" value={o.research_areas} hint={`${o.papers_published} papers published`} />
                <StatCard label="Teams" value={o.teams} hint={`${o.team_members} members`} />
                <StatCard label="Portfolio sites" value={o.portfolios} />
                <StatCard label="Research chat waitlist" value={o.assistant_waitlist} />
              </div>
              <div className="grid gap-4 lg:grid-cols-2">
                <Card title="Account types">
                  <Breakdown data={o.tracks} />
                </Card>
                <Card title="Active plans">
                  <Breakdown data={o.plans} />
                </Card>
              </div>
            </div>
          )}
        </Reveal>
      )}
      {tab === 'reports' && <Reports onChanged={() => void overview.reload()} />}
      {tab === 'posts' && <Posts />}
      {tab === 'listings' && <Listings onChanged={() => void overview.reload()} />}
    </>
  );
}

function Breakdown({ data }: { data: Record<string, number> }) {
  const entries = Object.entries(data).sort((a, b) => b[1] - a[1]);
  const max = Math.max(1, ...entries.map(([, v]) => v));
  if (!entries.length) return <p className="text-sm text-muted">No data yet.</p>;
  return (
    <ul className="space-y-2">
      {entries.map(([k, v]) => (
        <li key={k} className="grid grid-cols-[120px_1fr_48px] items-center gap-3 text-sm">
          <span className="truncate capitalize">{k || 'not chosen'}</span>
          <span className="h-2 overflow-hidden rounded-full bg-line">
            <span className="block h-full rounded-full bg-crimson" style={{ width: `${(v / max) * 100}%` }} />
          </span>
          <span className="text-right tabular-nums text-muted">{v}</span>
        </li>
      ))}
    </ul>
  );
}

function Reports({ onChanged }: { onChanged: () => void }) {
  const notify = useNotify();
  const [all, setAll] = useState(false);
  const reports = useResource(() => api.adminReports(all), `admin-reports-${all}`);
  const act = async (r: CommunityReport, what: 'remove' | 'restore' | 'resolve') => {
    try {
      if (what !== 'resolve') {
        if (r.comment_id) await api.adminRemoveComment(r.comment_id, what === 'remove');
        else if (r.post_id) await api.adminRemovePost(r.post_id, what === 'remove');
      }
      if (what !== 'restore') await api.adminResolveReport(r.id);
      notify(what === 'remove' ? 'Removed and resolved' : what === 'restore' ? 'Restored' : 'Resolved', 'success');
      void reports.reload();
      onChanged();
    } catch (err) {
      notify(errorMessage(err, 'Action failed.'), 'error');
    }
  };
  return (
    <div className="space-y-3">
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={all} onChange={(e) => setAll(e.target.checked)} /> Show resolved too
      </label>
      {reports.loading ? (
        <Skeleton className="h-40" />
      ) : (reports.data ?? []).length === 0 ? (
        <Card>
          <EmptyState icon="shield" title="No reports" description="Nothing to review." />
        </Card>
      ) : (
        (reports.data ?? []).map((r) => (
          <Card key={r.id}>
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
              <Chip variant={r.resolved ? 'muted' : 'pending'}>{r.resolved ? 'Resolved' : 'Open'}</Chip>
              <Chip variant="neutral">{r.comment_id ? 'Comment' : 'Post'}</Chip>
              {r.removed && <Chip variant="danger">Removed</Chip>}
              <span>
                by @{r.author} · reported by @{r.reporter} · {when(r.created_at)}
              </span>
            </div>
            <p className="mt-2 text-sm">
              <strong>Reason:</strong> {r.reason}
            </p>
            {r.title && <h3 className="mt-2 font-semibold">{r.title}</h3>}
            <div className="mt-1 max-h-40 overflow-y-auto rounded-control bg-page p-3 text-sm">
              <Markdown text={r.body || '_empty_'} compact />
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {!r.removed ? (
                <Button size="sm" variant="danger" onClick={() => void act(r, 'remove')}>
                  Remove content
                </Button>
              ) : (
                <Button size="sm" variant="secondary" onClick={() => void act(r, 'restore')}>
                  Restore
                </Button>
              )}
              {!r.resolved && (
                <Button size="sm" variant="secondary" onClick={() => void act(r, 'resolve')}>
                  Keep and resolve
                </Button>
              )}
            </div>
          </Card>
        ))
      )}
    </div>
  );
}

function Posts() {
  const notify = useNotify();
  const [q, setQ] = useState('');
  const [query, setQuery] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setQuery(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);
  const posts = useResource(() => api.adminPosts(query), `admin-posts-${query}`);
  const toggle = async (id: string, removed: boolean) => {
    try {
      await api.adminRemovePost(id, removed);
      void posts.reload();
    } catch (err) {
      notify(errorMessage(err, 'Action failed.'), 'error');
    }
  };
  return (
    <div className="space-y-3">
      <Input label="Search posts" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Title, text or author" />
      {posts.loading ? (
        <Skeleton className="h-40" />
      ) : (
        <Card padded={false}>
          <ul className="divide-y divide-line">
            {(posts.data ?? []).map((p) => (
              <li key={p.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{p.title}</div>
                  <div className="text-xs text-muted">
                    @{p.author} · {p.space} · {p.score} points · {p.comments} comments · {when(p.created_at)}
                  </div>
                </div>
                {p.removed && <Chip variant="danger">Removed</Chip>}
                <Button size="sm" variant={p.removed ? 'secondary' : 'ghost'} onClick={() => void toggle(p.id, !p.removed)}>
                  {p.removed ? 'Restore' : 'Remove'}
                </Button>
              </li>
            ))}
            {(posts.data ?? []).length === 0 && <li className="px-5 py-6 text-sm text-muted">No posts.</li>}
          </ul>
        </Card>
      )}
    </div>
  );
}

function Listings({ onChanged }: { onChanged: () => void }) {
  const notify = useNotify();
  const [status, setStatus] = useState<'pending' | 'public' | 'rejected' | 'all'>('pending');
  const listings = useResource(() => api.adminListings(status), `admin-listings-${status}`);
  const [reviewing, setReviewing] = useState<{ l: DatasetListing; decision: 'reject' | 'remove' } | null>(null);
  const [note, setNote] = useState('');
  const decide = async (l: DatasetListing, decision: 'approve' | 'reject' | 'remove', n = '') => {
    try {
      await api.adminReviewListing(l.id, decision, n);
      notify(decision === 'approve' ? 'Listing is on sale' : decision === 'reject' ? 'Sent back to the seller' : 'Listing removed', 'success');
      setReviewing(null);
      setNote('');
      void listings.reload();
      onChanged();
    } catch (err) {
      notify(errorMessage(err, 'Action failed.'), 'error');
    }
  };
  return (
    <div className="space-y-3">
      <SegmentedControl
        label="Status"
        value={status}
        onChange={setStatus}
        segments={[
          { value: 'pending', label: 'Waiting' },
          { value: 'public', label: 'On sale' },
          { value: 'rejected', label: 'Rejected' },
          { value: 'all', label: 'All' },
        ]}
      />
      {listings.loading ? (
        <Skeleton className="h-48" />
      ) : (listings.data ?? []).length === 0 ? (
        <Card>
          <EmptyState icon="image" title="Nothing here" description="Dataset listings submitted by sellers appear here for review." />
        </Card>
      ) : (
        (listings.data ?? []).map((l) => (
          <Card key={l.id}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="font-semibold">{l.title}</h3>
                <p className="text-xs text-muted">
                  @{l.seller} · {l.images} images · {l.labeled} labeled · {l.boxes} boxes · {l.license.replace(/_/g, ' ')} · {usd(l.price_usd)} · {l.sales} sales
                </p>
              </div>
              <Chip variant={l.status === 'public' ? 'active' : l.status === 'pending' ? 'pending' : l.status === 'rejected' ? 'danger' : 'muted'}>{l.status}</Chip>
            </div>
            <p className="mt-2 whitespace-pre-line text-sm text-ink-secondary">{l.description}</p>
            <div className="mt-3 grid grid-cols-4 gap-1.5 sm:grid-cols-8">
              {l.previews.map((p) => (
                <AuthImage key={p} path={api.adminListingPreviewPath(l.id, p)} className="aspect-square w-full rounded-control object-cover" />
              ))}
            </div>
            <p className="mt-2 text-[11px] text-muted">Check the photos look original, match the description and contain no personal data such as faces or number plates without consent.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {l.status !== 'public' && (
                <Button size="sm" onClick={() => void decide(l, 'approve')}>
                  Approve
                </Button>
              )}
              {l.status === 'pending' && (
                <Button size="sm" variant="secondary" onClick={() => setReviewing({ l, decision: 'reject' })}>
                  Ask for changes
                </Button>
              )}
              {l.status !== 'removed' && (
                <Button size="sm" variant="ghost" onClick={() => setReviewing({ l, decision: 'remove' })}>
                  Remove
                </Button>
              )}
            </div>
          </Card>
        ))
      )}
      <Modal isOpen={reviewing !== null} onClose={() => setReviewing(null)} title={reviewing?.decision === 'reject' ? 'Ask for changes' : 'Remove listing'}>
        <div className="space-y-4">
          <Input label="Note to the seller" value={note} onChange={(e) => setNote(e.target.value)} placeholder="What needs to change" />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setReviewing(null)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={() => reviewing && void decide(reviewing.l, reviewing.decision, note)}>
              Confirm
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
