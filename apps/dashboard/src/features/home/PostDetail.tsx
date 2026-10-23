import { useEffect, useState } from 'react';
import { errorMessage } from '@layerto/api-client';
import type { CommunityComment, CommunityPost } from '@layerto/types';
import { Avatar, Button, Drawer, Icon, Markdown, Skeleton, useNotify } from '@layerto/ui';
import { api } from '../../lib/api';
import { AuthImage } from '../studio/components/AuthImage';
import { LinkPreview, TrackBadge, VoteColumn } from './PostCard';
import { timeAgo } from './util';

function CommentItem({
  c,
  replies,
  onReply,
  onDelete,
  onReport,
}: {
  c: CommunityComment;
  replies: CommunityComment[];
  onReply: (c: CommunityComment) => void;
  onDelete: (c: CommunityComment) => void;
  onReport: (c: CommunityComment) => void;
}) {
  return (
    <li className="space-y-3">
      <div className="flex gap-3">
        <Avatar name={c.author || '·'} size={28} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
            <span className="font-semibold text-ink-secondary">{c.removed ? 'deleted' : `@${c.author}`}</span>
            {!c.removed && <TrackBadge track={c.author_track} />}
            <span>{timeAgo(c.created_at)}</span>
          </div>
          {c.removed ? <p className="text-sm italic text-muted">This comment was deleted.</p> : <Markdown text={c.body} compact className="mt-0.5" />}
          {!c.removed && (
            <div className="mt-1 flex gap-3 text-xs font-medium text-muted">
              {!c.parent_id && (
                <button type="button" className="hover:text-ink cursor-pointer" onClick={() => onReply(c)}>
                  Reply
                </button>
              )}
              {c.mine ? (
                <button type="button" className="hover:text-crimson cursor-pointer" onClick={() => onDelete(c)}>
                  Delete
                </button>
              ) : (
                <button type="button" className="hover:text-ink cursor-pointer" onClick={() => onReport(c)}>
                  Report
                </button>
              )}
            </div>
          )}
        </div>
      </div>
      {replies.length > 0 && (
        <ul className="ml-10 space-y-3 border-l border-line pl-4">
          {replies.map((r) => (
            <CommentItem key={r.id} c={r} replies={[]} onReply={onReply} onDelete={onDelete} onReport={onReport} />
          ))}
        </ul>
      )}
    </li>
  );
}

/** A post with its full text, image and threaded comments. */
export function PostDetail({
  id,
  onClose,
  onChange,
  navigate,
  onReport,
  spaceName,
}: {
  id: string;
  onClose: () => void;
  onChange: (p: CommunityPost) => void;
  navigate: (to: string) => void;
  onReport: (target: { post_id?: string; comment_id?: string }) => void;
  spaceName: (s: string) => string;
}) {
  const notify = useNotify();
  const [data, setData] = useState<{ post: CommunityPost; comments: CommunityComment[] } | null>(null);
  const [text, setText] = useState('');
  const [replyTo, setReplyTo] = useState<CommunityComment | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let alive = true;
    api.post(id).then(
      (d) => alive && setData(d),
      () => alive && (notify('That post is no longer available', 'error'), onClose()),
    );
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const send = async () => {
    if (!text.trim()) return;
    setBusy(true);
    try {
      const d = await api.comment(id, text.trim(), replyTo?.id);
      setData(d);
      onChange(d.post);
      setText('');
      setReplyTo(null);
    } catch (err) {
      notify(errorMessage(err, "Couldn't comment."), 'error');
    } finally {
      setBusy(false);
    }
  };
  const del = async (c: CommunityComment) => {
    try {
      await api.deleteComment(c.id);
      setData((d) => d && { ...d, comments: d.comments.map((x) => (x.id === c.id ? { ...x, removed: true, body: '', author: '' } : x)) });
    } catch (err) {
      notify(errorMessage(err, "Couldn't delete."), 'error');
    }
  };

  const post = data?.post;
  const top = (data?.comments ?? []).filter((c) => !c.parent_id);
  return (
    <Drawer isOpen onClose={onClose} title={post ? spaceName(post.space) : 'Post'} className="max-w-2xl">
      {!post ? (
        <Skeleton className="h-64" />
      ) : (
        <div className="space-y-5">
          <div className="flex gap-3">
            <VoteColumn
              post={post}
              onChange={(p) => {
                setData((d) => d && { ...d, post: p });
                onChange(p);
              }}
            />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
                <Avatar name={post.author} size={20} />
                <span className="font-semibold text-ink-secondary">@{post.author}</span>
                <TrackBadge track={post.author_track} />
                <span>{timeAgo(post.created_at)}</span>
              </div>
              <h2 className="mt-2 text-xl font-bold leading-snug">{post.title}</h2>
              {post.body && <Markdown text={post.body} className="mt-3" />}
              {post.has_image && (
                <div className="mt-4 overflow-hidden rounded-control border border-line bg-page">
                  <AuthImage path={api.postImagePath(post.id)} alt="" className="w-full object-contain max-h-[520px]" />
                </div>
              )}
              <LinkPreview post={post} navigate={navigate} />
            </div>
          </div>
          <div className="rounded-l2 border border-line bg-page p-3 space-y-2">
            {replyTo && (
              <div className="flex items-center gap-2 text-xs text-muted">
                <Icon name="message" size={13} /> Replying to @{replyTo.author}
                <button type="button" className="ml-auto hover:text-ink cursor-pointer" onClick={() => setReplyTo(null)}>
                  Cancel
                </button>
              </div>
            )}
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') void send();
              }}
              maxLength={5000}
              placeholder="Add a comment (Markdown works, Ctrl+Enter to send)"
              className="w-full min-h-20 rounded-control border border-line-strong bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-focus"
            />
            <div className="flex justify-end">
              <Button size="sm" loading={busy} disabled={!text.trim()} onClick={send}>
                Comment
              </Button>
            </div>
          </div>
          <div>
            <h3 className="mb-3 text-sm font-semibold">{post.comments} {post.comments === 1 ? 'comment' : 'comments'}</h3>
            <ul className="space-y-5">
              {top.map((c) => (
                <CommentItem
                  key={c.id}
                  c={c}
                  replies={(data?.comments ?? []).filter((r) => r.parent_id === c.id)}
                  onReply={setReplyTo}
                  onDelete={del}
                  onReport={(x) => onReport({ comment_id: x.id })}
                />
              ))}
            </ul>
            {top.length === 0 && <p className="text-sm text-muted">Be the first to comment.</p>}
          </div>
        </div>
      )}
    </Drawer>
  );
}
