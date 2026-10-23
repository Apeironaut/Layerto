import { useEffect, useRef, useState } from 'react';
import { errorMessage } from '@layerto/api-client';
import type { CommunityPost, Space } from '@layerto/types';
import { Button, Icon, Input, Markdown, Modal, Select, cn, useNotify, validateImageFile } from '@layerto/ui';
import { api } from '../../lib/api';
import { CategorizedSpacePicker } from './components/CategorizedSpacePicker';

export interface ComposerPrefill {
  space?: string;
  title?: string;
  body?: string;
  link_kind?: string;
  link_ref?: string;
}

/** New community post: space, title, Markdown body with preview, an image and an optional link to a model, dataset, paper or URL. */
export function Composer({ open, prefill, onClose, onPosted }: { open: boolean; prefill?: ComposerPrefill; onClose: () => void; onPosted: (p: CommunityPost) => void }) {
  const notify = useNotify();
  const [space, setSpace] = useState<Space>('general');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [preview, setPreview] = useState(false);
  const [image, setImage] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [linkKind, setLinkKind] = useState<'' | 'model' | 'listing' | 'paper' | 'url'>('');
  const [linkRef, setLinkRef] = useState('');
  const [options, setOptions] = useState<{ value: string; label: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setSpace((prefill?.space as Space) || 'general');
    setTitle(prefill?.title ?? '');
    setBody(prefill?.body ?? '');
    setLinkKind((prefill?.link_kind as typeof linkKind) ?? '');
    setLinkRef(prefill?.link_ref ?? '');
    setImage(null);
    setImageUrl(null);
    setPreview(false);
  }, [open, prefill]);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      let opts: { value: string; label: string }[] = [];
      if (linkKind === 'model') {
        const [mine, market] = await Promise.all([api.studioModels().catch(() => []), api.studioMarketplace().catch(() => [])]);
        const seen = new Set<string>();
        opts = [...mine, ...market].filter((m) => !seen.has(m.slug) && seen.add(m.slug)).map((m) => ({ value: m.slug, label: m.name }));
        const platform = await api.getModels().catch(() => []);
        opts.push(...platform.filter((m) => !seen.has(m.slug)).map((m) => ({ value: m.slug, label: `${m.name} (Layerto)` })));
      } else if (linkKind === 'listing') {
        const [all, mine] = await Promise.all([api.listings().catch(() => []), api.myListings().catch(() => [])]);
        const seen = new Set<string>();
        opts = [...mine.filter((l) => l.status === 'public'), ...all].filter((l) => !seen.has(l.id) && seen.add(l.id)).map((l) => ({ value: l.id, label: l.title }));
      } else if (linkKind === 'paper') {
        const pubs = await api.publicPapers().catch(() => []);
        opts = pubs.map((p) => ({ value: p.id, label: p.title }));
      }
      if (alive) setOptions(opts);
    };
    if (linkKind && linkKind !== 'url') void load();
    return () => {
      alive = false;
    };
  }, [linkKind]);

  useEffect(() => () => {
    if (imageUrl) URL.revokeObjectURL(imageUrl);
  }, [imageUrl]);

  const submit = async () => {
    setBusy(true);
    try {
      const p = await api.createPost({ space, title: title.trim(), body: body.trim(), link_kind: linkKind, link_ref: linkRef.trim(), image });
      notify('Posted', 'success');
      onPosted(p);
    } catch (err) {
      notify(errorMessage(err, "Couldn't post."), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal isOpen={open} onClose={onClose} title="Share with the community" description="Findings, questions, models, datasets, results, collabs." size="lg">
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <div className="grid gap-3 sm:grid-cols-[15.5rem_1fr]">
          <CategorizedSpacePicker value={space} onChange={(s) => setSpace(s)} label="Area & Field" />
          <Input label="Title" value={title} maxLength={200} onChange={(e) => setTitle(e.target.value)} placeholder="What did you find, build or want to ask?" required />
        </div>
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-sm font-medium">Post</span>
            <div className="flex rounded-control border border-line p-0.5 text-xs">
              {(['Write', 'Preview'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setPreview(t === 'Preview')}
                  className={cn('rounded px-2.5 py-1 cursor-pointer', (t === 'Preview') === preview ? 'bg-crimson text-white' : 'text-muted')}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
          {preview ? (
            <div className="min-h-40 rounded-control border border-line bg-page p-3">{body ? <Markdown text={body} /> : <p className="text-sm text-muted">Nothing to preview.</p>}</div>
          ) : (
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              maxLength={20000}
              placeholder={'Markdown works: **bold**, `code`, - lists, [links](https://…)'}
              className="w-full min-h-40 rounded-control border border-line-strong bg-card px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-focus"
            />
          )}
        </div>
        <div className="grid gap-3 sm:grid-cols-[12rem_1fr]">
          <Select
            label="Attach"
            value={linkKind}
            onChange={(e) => {
              setLinkKind(e.target.value as typeof linkKind);
              setLinkRef('');
            }}
            options={[
              { value: '', label: 'Nothing' },
              { value: 'model', label: 'A model' },
              { value: 'listing', label: 'A dataset' },
              { value: 'paper', label: 'A paper' },
              { value: 'url', label: 'A link' },
            ]}
          />
          {linkKind === 'url' ? (
            <Input label="URL" value={linkRef} onChange={(e) => setLinkRef(e.target.value)} placeholder="https://" />
          ) : linkKind ? (
            <Select label="Choose" value={linkRef} onChange={(e) => setLinkRef(e.target.value)} options={[{ value: '', label: options.length ? 'Select…' : 'Nothing available yet' }, ...options]} />
          ) : (
            <div />
          )}
        </div>
        <div className="flex items-center gap-3">
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              if (!f) return;
              const problem = validateImageFile(f) ?? (f.size > 5 * 1024 * 1024 ? 'Images must be under 5 MB' : null);
              if (problem) return notify(problem, 'error');
              setImage(f);
              setImageUrl(URL.createObjectURL(f));
            }}
          />
          <Button type="button" variant="secondary" size="sm" icon="image" onClick={() => fileRef.current?.click()}>
            {image ? 'Change image' : 'Add image'}
          </Button>
          {imageUrl && (
            <div className="relative">
              <img src={imageUrl} alt="" className="h-14 w-20 rounded-control object-cover border border-line" />
              <button type="button" aria-label="Remove image" onClick={() => {
                  setImage(null);
                  setImageUrl(null);
                }} className="absolute -right-2 -top-2 grid size-5 place-items-center rounded-full bg-ink text-card cursor-pointer">
                <Icon name="close" size={12} />
              </button>
            </div>
          )}
          <div className="ml-auto flex gap-2">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" icon="sparkles" loading={busy} disabled={title.trim().length < 3 || (!!linkKind && !linkRef)}>
              Post
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
