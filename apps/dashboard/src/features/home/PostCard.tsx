import { useState } from 'react';
import { errorMessage } from '@layerto/api-client';
import type { CommunityPost } from '@layerto/types';
import { Avatar, Icon, Markdown, cn, useNotify } from '@layerto/ui';
import { api } from '../../lib/api';
import { AuthImage } from '../studio/components/AuthImage';
import { SPACE_ICON, timeAgo, trackBadge } from './util';

export function TrackBadge({ track }: { track: string }) {
  const b = trackBadge(track);
  if (!b) return null;
  return <span className={cn('rounded-pill border px-1.5 py-px text-[10px] font-semibold', b.cls)}>{b.label}</span>;
}

export function VoteColumn({ post, onChange, horizontal = false }: { post: CommunityPost; onChange: (p: CommunityPost) => void; horizontal?: boolean }) {
  const notify = useNotify();
  const [busy, setBusy] = useState(false);
  const vote = async (v: -1 | 1) => {
    if (busy) return;
    const next = post.my_vote === v ? 0 : v;
    // optimistic
    onChange({ ...post, my_vote: next, score: post.score + next - post.my_vote });
    setBusy(true);
    try {
      onChange(await api.votePost(post.id, next));
    } catch (err) {
      onChange(post);
      notify(errorMessage(err, "Couldn't vote."), 'error');
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className={cn('flex items-center gap-0.5', horizontal ? 'flex-row rounded-pill bg-page px-1' : 'flex-col')}>
      <button
        type="button"
        aria-label="Upvote"
        aria-pressed={post.my_vote === 1}
        onClick={(e) => {
          e.stopPropagation();
          void vote(1);
        }}
        className={cn('grid size-8 place-items-center rounded-control cursor-pointer transition-all hover:bg-crimson-tint active:scale-90', post.my_vote === 1 ? 'text-crimson' : 'text-muted')}
      >
        <Icon name="arrowUp" size={18} />
      </button>
      <span className={cn('min-w-6 text-center text-sm font-bold tabular-nums', post.my_vote === 1 ? 'text-crimson' : post.my_vote === -1 ? 'text-sky-600' : 'text-ink')}>{post.score}</span>
      <button
        type="button"
        aria-label="Downvote"
        aria-pressed={post.my_vote === -1}
        onClick={(e) => {
          e.stopPropagation();
          void vote(-1);
        }}
        className={cn('grid size-8 place-items-center rounded-control cursor-pointer transition-all hover:bg-sky-500/10 active:scale-90', post.my_vote === -1 ? 'text-sky-600' : 'text-muted')}
      >
        <Icon name="arrowDownLong" size={18} />
      </button>
    </div>
  );
}

export function LinkPreview({ post, navigate }: { post: CommunityPost; navigate: (to: string) => void }) {
  if (!post.link_kind) return null;
  const meta: Record<string, { icon: 'box' | 'database' | 'book' | 'link'; label: string; to?: string; href?: string }> = {
    model: { icon: 'box', label: 'Model', to: `/marketplace?model=${post.link_ref}` },
    listing: { icon: 'database', label: 'Dataset', to: `/marketplace/datasets/${post.link_ref}` },
    paper: { icon: 'book', label: 'Paper', to: `/marketplace/papers?paper=${post.link_ref}` },
    url: { icon: 'link', label: 'Link', href: post.link_ref },
  };
  const m = meta[post.link_kind];
  const title = post.link_title || post.link_ref;
  const inner = (
    <>
      <span className="grid size-9 shrink-0 place-items-center rounded-control bg-crimson-tint text-crimson">
        <Icon name={m.icon} size={17} />
      </span>
      <span className="min-w-0">
        <span className="block text-[11px] uppercase tracking-wider text-muted">{m.label}</span>
        <span className="block truncate text-sm font-medium text-ink">{title}</span>
      </span>
      <Icon name={m.href ? 'external' : 'chevronRight'} size={16} className="ml-auto text-muted" />
    </>
  );
  const cls = 'mt-3 flex items-center gap-3 rounded-control border border-line bg-page px-3 py-2 no-underline hover:border-crimson-border transition-colors';
  if (m.href) {
    return (
      <a href={m.href} target="_blank" rel="noopener noreferrer nofollow" className={cls} onClick={(e) => e.stopPropagation()}>
        {inner}
      </a>
    );
  }
  return (
    <button
      type="button"
      className={cn(cls, 'w-full text-left cursor-pointer')}
      onClick={(e) => {
        e.stopPropagation();
        navigate(m.to!);
      }}
    >
      {inner}
    </button>
  );
}

/** One post in the feed: votes, author, space, preview, image, linked item and actions. */
export function PostCard({
  post,
  onChange,
  onOpen,
  onDelete,
  onReport,
  navigate,
  spaceName,
}: {
  post: CommunityPost;
  onChange: (p: CommunityPost) => void;
  onOpen: () => void;
  onDelete: () => void;
  onReport: () => void;
  navigate: (to: string) => void;
  spaceName: string;
}) {
  const notify = useNotify();
  const [menu, setMenu] = useState(false);
  const save = async () => {
    try {
      onChange(await api.savePost(post.id, !post.saved));
    } catch (err) {
      notify(errorMessage(err, "Couldn't save."), 'error');
    }
  };
  const share = async () => {
    const url = `${window.location.origin}/home/post/${post.id}`;
    try {
      await navigator.clipboard.writeText(url);
      notify('Link copied', 'success');
    } catch {
      notify(url, 'info');
    }
  };
  return (
    <article
      className="group flex gap-3 rounded-l2 border border-line bg-card p-3 sm:p-4 shadow-l1 transition-all hover:border-line-strong hover:shadow-l2 cursor-pointer"
      onClick={onOpen}
    >
      <div className="hidden sm:block">
        <VoteColumn post={post} onChange={onChange} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
          <span className="inline-flex items-center gap-1 font-semibold text-ink-secondary">
            <Icon name={SPACE_ICON[post.space] ?? 'message'} size={13} />
            {spaceName}
          </span>
          <span>·</span>
          <Avatar name={post.author || '?'} size={18} />
          <span className="font-medium text-ink-secondary">@{post.author || 'someone'}</span>
          <TrackBadge track={post.author_track} />
          <span>·</span>
          <time dateTime={post.created_at}>{timeAgo(post.created_at)}</time>
          {post.edited && <span>· edited</span>}
        </div>
        <h3 className="mt-1.5 text-[17px] font-semibold leading-snug text-ink group-hover:text-crimson transition-colors">{post.title}</h3>
        {post.body && <Markdown text={post.body} compact className="mt-1.5 line-clamp-4 [&_pre]:hidden" />}
        {post.has_image && (
          <div className="mt-3 overflow-hidden rounded-control border border-line bg-page">
            <AuthImage path={api.postImagePath(post.id)} alt="" className="max-h-[420px] w-full object-contain" />
          </div>
        )}
        <LinkPreview post={post} navigate={navigate} />
        <div className="mt-3 flex flex-wrap items-center gap-1 text-xs font-medium text-muted" onClick={(e) => e.stopPropagation()}>
          <div className="sm:hidden mr-1">
            <VoteColumn post={post} onChange={onChange} horizontal />
          </div>
          <button type="button" onClick={onOpen} className="inline-flex items-center gap-1.5 rounded-pill px-2.5 py-1.5 hover:bg-page cursor-pointer">
            <Icon name="message" size={15} /> {post.comments} {post.comments === 1 ? 'comment' : 'comments'}
          </button>
          <button type="button" onClick={save} className={cn('inline-flex items-center gap-1.5 rounded-pill px-2.5 py-1.5 hover:bg-page cursor-pointer', post.saved && 'text-crimson')}>
            <Icon name="bookmark" size={15} /> {post.saved ? 'Saved' : 'Save'}
          </button>
          <button type="button" onClick={share} className="inline-flex items-center gap-1.5 rounded-pill px-2.5 py-1.5 hover:bg-page cursor-pointer">
            <Icon name="share" size={15} /> Share
          </button>
          <div className="relative ml-auto">
            <button type="button" aria-label="More" onClick={() => setMenu((v) => !v)} className="grid size-8 place-items-center rounded-pill hover:bg-page cursor-pointer">
              <Icon name="more" size={16} />
            </button>
            {menu && (
              <div className="absolute right-0 z-20 mt-1 w-36 rounded-control border border-line bg-raised p-1 shadow-l2" onMouseLeave={() => setMenu(false)}>
                {post.mine ? (
                  <button type="button" onClick={() => (setMenu(false), onDelete())} className="w-full rounded px-2.5 py-1.5 text-left text-sm text-crimson hover:bg-crimson-tint cursor-pointer">
                    Delete
                  </button>
                ) : (
                  <button type="button" onClick={() => (setMenu(false), onReport())} className="w-full rounded px-2.5 py-1.5 text-left text-sm hover:bg-page cursor-pointer">
                    Report
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}

export { timeAgo };
