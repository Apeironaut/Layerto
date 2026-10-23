import { useCallback, useEffect, useMemo, useState } from 'react';
import { errorMessage } from '@layerto/api-client';
import type { CommunityPost, Space } from '@layerto/types';
import { Avatar, Button, Card, ConfirmModal, EmptyState, Icon, Input, Modal, Skeleton, Tabs, cn, useNotify, useResource } from '@layerto/ui';
import type { IconName } from '@layerto/ui';
import { api } from '../../lib/api';
import { useHub } from '../../hub/HubContext';
import { PostCard, TrackBadge } from './PostCard';
import { PostDetail } from './PostDetail';
import { SPACE_ICON } from './util';
import { CategorySpacesPanel } from './components/CategorySpacesPanel';
import {
  type SpaceCategory,
  getFieldDisplayName,
  loadStoredCategories,
  saveStoredCategories,
} from './lib/spacesCategories';

type Sort = 'hot' | 'new' | 'top' | 'saved';

const NEXT_STEPS: Record<string, { icon: IconName; label: string; to: string }[]> = {
  researcher: [
    { icon: 'flask', label: 'Open your research workspace', to: '/research' },
    { icon: 'book', label: 'Add a paper or import BibTeX', to: '/research/papers' },
    { icon: 'store', label: 'Find datasets to train on', to: '/marketplace/datasets' },
  ],
  photographer: [
    { icon: 'camera', label: 'List a photo collection for sale', to: '/sell' },
    { icon: 'store', label: 'See what buyers look for', to: '/marketplace/datasets' },
    { icon: 'message', label: 'Introduce yourself in Jobs & collabs', to: '/home?space=jobs' },
  ],
  enterprise: [
    { icon: 'team', label: 'Create a team and invite people', to: '/teams' },
    { icon: 'folder', label: 'Start a shared project', to: '/projects' },
    { icon: 'key', label: 'Create an API key', to: '/keys' },
  ],
  student: [
    { icon: 'spark', label: 'Try a model in the playground', to: '/playground' },
    { icon: 'key', label: 'Make your first API call', to: '/keys' },
    { icon: 'info', label: 'Ask the community', to: '/home?space=help' },
  ],
  solo: [
    { icon: 'spark', label: 'Test models in the playground', to: '/playground' },
    { icon: 'folder', label: 'Train a detector on your data', to: '/projects' },
    { icon: 'store', label: 'Browse community models', to: '/marketplace' },
  ],
};

/** Home: the community feed. People share findings, models, datasets and questions; vote, comment and save. */
export function HomePage() {
  const { user, track, navigate, openComposer } = useHub();
  const notify = useNotify();
  const params = new URLSearchParams(window.location.search);
  const [space, setSpace] = useState<Space | ''>((params.get('space') as Space) || '');
  const [sort, setSort] = useState<Sort>('hot');
  const [q, setQ] = useState('');
  const [query, setQuery] = useState('');
  const [posts, setPosts] = useState<CommunityPost[] | null>(null);
  const [more, setMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [open, setOpen] = useState<string | null>(() => window.location.pathname.match(/^\/home\/post\/([0-9a-f-]{36})/)?.[1] ?? null);
  const [reporting, setReporting] = useState<{ post_id?: string; comment_id?: string } | null>(null);
  const [reason, setReason] = useState('');
  const [deleting, setDeleting] = useState<CommunityPost | null>(null);
  const meta = useResource(() => api.communityMeta(), 'community-meta');
  const [categories, setCategories] = useState<SpaceCategory[]>(() => loadStoredCategories());

  // Listen for category updates from Composer or other components
  useEffect(() => {
    const onCategoriesUpdated = (e: Event) => {
      const cats = (e as CustomEvent<SpaceCategory[]>).detail;
      if (cats) setCategories(cats);
    };
    window.addEventListener('layerto:categories_updated', onCategoriesUpdated);
    return () => window.removeEventListener('layerto:categories_updated', onCategoriesUpdated);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setQuery(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);

  const load = useCallback(
    async (offset = 0) => {
      const page = await api.posts({ space: space || undefined, sort: sort === 'saved' ? 'new' : sort, saved: sort === 'saved', q: query || undefined, offset });
      setMore(page.length === 30);
      setPosts((cur) => (offset === 0 ? page : [...(cur ?? []), ...page]));
    },
    [space, sort, query],
  );

  useEffect(() => {
    setPosts(null);
    load(0).catch((err) => {
      setPosts([]);
      notify(errorMessage(err, "Couldn't load the feed."), 'error');
    });
  }, [load, notify]);

  // new posts from the composer appear at the top
  useEffect(() => {
    const onPosted = (e: Event) => {
      const p = (e as CustomEvent<CommunityPost>).detail;
      setPosts((cur) => [p, ...(cur ?? [])]);
    };
    window.addEventListener('layerto:posted', onPosted);
    return () => window.removeEventListener('layerto:posted', onPosted);
  }, []);

  const update = (p: CommunityPost) => setPosts((cur) => cur?.map((x) => (x.id === p.id ? p : x)) ?? cur);

  const spacesMetaCounts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const s of meta.data?.spaces ?? []) {
      map[s.id] = s.posts;
    }
    return map;
  }, [meta.data?.spaces]);

  const totalPosts = useMemo(() => {
    return (meta.data?.spaces ?? []).reduce((a, s) => a + s.posts, 0);
  }, [meta.data?.spaces]);

  const spaceName = useCallback((s: string) => getFieldDisplayName(categories, s), [categories]);
  const firstName = user.first_name || user.name?.split(' ')[0] || user.username || '';
  const steps = NEXT_STEPS[track || 'solo'] ?? NEXT_STEPS.solo;

  const openPost = (id: string | null) => {
    setOpen(id);
    window.history.replaceState({}, '', id ? `/home/post/${id}` : '/home');
  };

  return (
    <div className="grid gap-4 lg:gap-5 xl:gap-6 xl:grid-cols-[16rem_minmax(0,1fr)_18.5rem] -ml-6 sm:-ml-8 lg:-ml-24 -mr-2 sm:-mr-4 lg:-mr-8 -mt-2 sm:-mt-3">
      {/* categorized spaces left sidebar */}
      <aside className="hidden xl:block">
        <CategorySpacesPanel
          currentSpace={space}
          onSelectSpace={(s) => setSpace(s)}
          categories={categories}
          onChangeCategories={(next) => {
            setCategories(next);
            saveStoredCategories(next);
            window.dispatchEvent(new CustomEvent('layerto:categories_updated', { detail: next }));
          }}
          spacesMetaCounts={spacesMetaCounts}
          totalPosts={totalPosts}
        />
      </aside>

      {/* feed */}
      <section className="min-w-0 space-y-4">
        <div className="relative overflow-hidden rounded-l1 border border-line bg-card p-5 shadow-l1">
          <div aria-hidden className="pointer-events-none absolute -right-16 -top-20 size-64 rounded-full bg-crimson/10 blur-3xl" />
          <div className="relative flex flex-wrap items-center gap-4">
            <Avatar name={user.username || user.email} size={44} />
            <div className="min-w-0 flex-1">
              <h1 className="text-xl font-bold">{firstName ? `Hi ${firstName}` : 'Welcome'}, what are you working on?</h1>
              <p className="text-sm text-muted">Researchers, photographers, builders and teams sharing what they find.</p>
            </div>
            <Button icon="plus" onClick={() => openComposer(space ? { space } : undefined)}>
              New post
            </Button>
          </div>
          <button
            type="button"
            onClick={() => openComposer(space ? { space } : undefined)}
            className="relative mt-4 w-full rounded-control border border-line bg-page px-4 py-3 text-left text-sm text-muted hover:border-crimson-border cursor-text transition-colors"
          >
            Share a finding, a model, a dataset or a question…
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Tabs<Sort>
            className="flex-1 border-b-0"
            value={sort}
            onChange={setSort}
            items={[
              { value: 'hot', label: 'Hot', icon: 'zap' },
              { value: 'new', label: 'New', icon: 'clock' },
              { value: 'top', label: 'Top this month', icon: 'trophy' },
              { value: 'saved', label: 'Saved', icon: 'bookmark' },
            ]}
          />
          <div className="w-full sm:w-64">
            <Input placeholder="Search posts" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search posts" />
          </div>
        </div>

        {/* Mobile categorized spaces chips */}
        <div className="xl:hidden flex gap-2 overflow-x-auto pb-1">
          <button
            type="button"
            onClick={() => setSpace('')}
            className={cn(
              'shrink-0 rounded-pill border px-3 py-1.5 text-xs font-medium cursor-pointer',
              space === '' ? 'border-crimson bg-crimson-tint text-crimson font-semibold' : 'border-line text-muted',
            )}
          >
            All spaces
          </button>
          {categories
            .flatMap((cat) => cat.fields)
            .map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setSpace(s.id as Space | '')}
                className={cn(
                  'shrink-0 rounded-pill border px-3 py-1.5 text-xs font-medium cursor-pointer flex items-center gap-1.5',
                  space === s.id ? 'border-crimson bg-crimson-tint text-crimson font-semibold' : 'border-line text-muted',
                )}
              >
                <Icon name={s.icon || SPACE_ICON[s.id] || 'message'} size={13} />
                <span>{s.name}</span>
              </button>
            ))}
        </div>

        {posts === null ? (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-36" />
            ))}
          </div>
        ) : posts.length === 0 ? (
          <Card>
            <EmptyState
              icon="message"
              title={sort === 'saved' ? 'Nothing saved yet' : query ? 'No posts match' : 'No posts here yet'}
              description={sort === 'saved' ? 'Save posts to read them later.' : 'Start the conversation. Share what you are building or ask a question.'}
              action={<Button icon="plus" onClick={() => openComposer(space ? { space } : undefined)}>New post</Button>}
            />
          </Card>
        ) : (
          <div className="space-y-3">
            {posts.map((p) => (
              <PostCard
                key={p.id}
                post={p}
                spaceName={spaceName(p.space)}
                onChange={update}
                onOpen={() => openPost(p.id)}
                onDelete={() => setDeleting(p)}
                onReport={() => setReporting({ post_id: p.id })}
                navigate={navigate}
              />
            ))}
            {more && (
              <div className="flex justify-center pt-2">
                <Button
                  variant="secondary"
                  loading={loadingMore}
                  onClick={async () => {
                    setLoadingMore(true);
                    await load(posts.length).catch(() => undefined);
                    setLoadingMore(false);
                  }}
                >
                  Load more
                </Button>
              </div>
            )}
          </div>
        )}
      </section>

      {/* right rail */}
      <aside className="hidden xl:block space-y-4">
        <Card title="Next steps for you" className="sticky top-3 sm:top-4">
          <ul className="space-y-1">
            {steps.map((s) => (
              <li key={s.label}>
                <button type="button" onClick={() => navigate(s.to)} className="w-full flex items-center gap-3 rounded-control px-2 py-2 text-left text-sm hover:bg-page cursor-pointer">
                  <span className="grid size-8 place-items-center rounded-control bg-crimson-tint text-crimson">
                    <Icon name={s.icon} size={16} />
                  </span>
                  <span className="flex-1">{s.label}</span>
                  <Icon name="chevronRight" size={15} className="text-muted" />
                </button>
              </li>
            ))}
          </ul>
          {(meta.data?.top_contributors ?? []).length > 0 && (
            <div className="mt-5 border-t border-line pt-4">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted">Top this month</p>
              <ol className="space-y-2">
                {meta.data!.top_contributors.map((c, i) => (
                  <li key={c.username} className="flex items-center gap-2 text-sm">
                    <span className="w-4 text-xs font-mono text-muted">{i + 1}</span>
                    <Avatar name={c.username} size={24} />
                    <span className="flex-1 truncate">@{c.username}</span>
                    <TrackBadge track={c.track} />
                    <span className="font-mono text-xs text-muted">{c.score}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}
          <p className="mt-5 border-t border-line pt-4 text-xs text-muted">
            Be kind and specific. Share real results and say where numbers come from. Report anything harmful.
          </p>
        </Card>
      </aside>

      {open && (
        <PostDetail
          id={open}
          onClose={() => openPost(null)}
          onChange={update}
          navigate={navigate}
          onReport={(t) => setReporting(t)}
          spaceName={spaceName}
        />
      )}
      <Modal isOpen={reporting !== null} onClose={() => setReporting(null)} title="Report" description="Tell the moderators what's wrong. They'll review it.">
        <div className="space-y-4">
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={500}
            placeholder="Spam, harassment, wrong license, misleading results…"
            className="w-full min-h-24 rounded-control border border-line-strong bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-focus"
          />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setReporting(null)}>
              Cancel
            </Button>
            <Button
              disabled={!reason.trim()}
              onClick={async () => {
                try {
                  await api.report(reporting!, reason.trim());
                  notify('Thanks, a moderator will take a look', 'success');
                  setReporting(null);
                  setReason('');
                } catch (err) {
                  notify(errorMessage(err, "Couldn't send the report."), 'error');
                }
              }}
            >
              Send report
            </Button>
          </div>
        </div>
      </Modal>
      <ConfirmModal
        isOpen={deleting !== null}
        title="Delete this post?"
        description="It and its comments are removed for everyone."
        confirmLabel="Delete"
        danger
        onConfirm={async () => {
          const p = deleting;
          setDeleting(null);
          if (!p) return;
          try {
            await api.deletePost(p.id);
            setPosts((cur) => cur?.filter((x) => x.id !== p.id) ?? cur);
          } catch (err) {
            notify(errorMessage(err, "Couldn't delete."), 'error');
          }
        }}
        onCancel={() => setDeleting(null)}
      />
    </div>
  );
}
