import { useEffect, useMemo, useRef, useState } from 'react';
import { errorMessage } from '@layerto/api-client';
import type { ResearchNote } from '@layerto/types';
import { Button, Card, ConfirmModal, EmptyState, Icon, Markdown, Skeleton, cn, useNotify, useResource } from '@layerto/ui';
import { api } from '../../lib/api';
import { timeAgo } from '../home/util';
import { AreaDot, SearchBox, areaOptions, useResearch } from './shared';

/** A lab notebook: Markdown notes with live preview and autosave. Training runs add notes automatically. */
export function NotesView() {
  const { area, canWrite, areas } = useResearch();
  const notify = useNotify();
  const notes = useResource(() => api.notes({ area }), `notes-${area}`);
  const [q, setQ] = useState('');
  const [sel, setSel] = useState<string | null>(null);
  const [draft, setDraft] = useState<ResearchNote | null>(null);
  const [mode, setMode] = useState<'split' | 'edit' | 'read'>('split');
  const [saving, setSaving] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [deleting, setDeleting] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const created = useRef(false);

  const list = useMemo(() => {
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    return (notes.data ?? [])
      .filter((n) => words.every((w) => `${n.title} ${n.body}`.toLowerCase().includes(w)))
      .sort((a, b) => Number(b.pinned) - Number(a.pinned) || +new Date(b.updated_at) - +new Date(a.updated_at));
  }, [notes.data, q]);

  useEffect(() => {
    if (!sel && list.length) setSel(list[0].id);
  }, [list, sel]);
  useEffect(() => {
    const n = (notes.data ?? []).find((x) => x.id === sel);
    if (n && n.id !== draft?.id) setDraft(n);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sel, notes.data]);

  const create = async () => {
    try {
      const n = await api.researchCreate<ResearchNote>('notes', { title: 'Untitled note', body: '', area_id: area });
      await notes.reload();
      setSel(n.id);
      setDraft(n);
      setMode('edit');
    } catch (err) {
      notify(errorMessage(err, "Couldn't create the note."), 'error');
    }
  };
  useEffect(() => {
    if (!created.current && new URLSearchParams(window.location.search).get('new')) {
      created.current = true;
      void create();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const edit = (patch: Partial<ResearchNote>) => {
    if (!draft) return;
    const next = { ...draft, ...patch };
    setDraft(next);
    setSaving('saving');
    clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      try {
        await api.researchUpdate('notes', next.id, { title: next.title || 'Untitled note', body: next.body, pinned: next.pinned, area_id: next.area_id ?? '' });
        setSaving('saved');
        void notes.reload();
      } catch (err) {
        setSaving('idle');
        notify(errorMessage(err, "Couldn't save the note."), 'error');
      }
    }, 700);
  };
  useEffect(() => () => clearTimeout(timer.current), []);

  const remove = async () => {
    if (!draft) return;
    try {
      await api.researchDelete('notes', draft.id);
      setDeleting(false);
      setSel(null);
      setDraft(null);
      void notes.reload();
    } catch (err) {
      notify(errorMessage(err, "Couldn't delete."), 'error');
    }
  };

  const editable = draft ? canWrite(draft.area_id) : false;
  if (notes.loading) return <Skeleton className="h-96" />;
  if ((notes.data ?? []).length === 0) {
    return (
      <Card>
        <EmptyState
          icon="pen"
          title="Your lab notebook is empty"
          description="Write ideas, meeting notes and results in Markdown. When a training run finishes, a note comparing it with your previous best is added here."
          action={canWrite() && <Button icon="plus" onClick={create}>New note</Button>}
        />
      </Card>
    );
  }

  return (
    <div className="grid min-h-[70vh] overflow-hidden rounded-l2 border border-line bg-card shadow-l1 md:grid-cols-[300px_1fr]">
      <aside className="flex flex-col border-b border-line md:border-b-0 md:border-r">
        <div className="flex items-center gap-2 border-b border-line p-3">
          <div className="flex-1">
            <SearchBox value={q} onChange={setQ} placeholder="Search notes" />
          </div>
          {canWrite() && (
            <Button size="sm" icon="plus" aria-label="New note" onClick={create}>
              New
            </Button>
          )}
        </div>
        <ul className="max-h-60 flex-1 overflow-y-auto md:max-h-none">
          {list.map((n) => (
            <li key={n.id}>
              <button
                type="button"
                onClick={() => {
                  setSel(n.id);
                  setDraft(n);
                }}
                className={cn('block w-full border-l-2 px-4 py-3 text-left transition-colors cursor-pointer', sel === n.id ? 'border-crimson bg-crimson-tint/50' : 'border-transparent hover:bg-page')}
              >
                <div className="flex items-center gap-1.5">
                  {n.pinned && <Icon name="pin" size={12} className="text-crimson" />}
                  {n.auto && <Icon name="sparkles" size={12} className="text-violet-500" />}
                  <span className="truncate text-sm font-medium">{n.title}</span>
                </div>
                <p className="mt-0.5 line-clamp-2 text-xs text-muted">{n.body.replace(/[#*_`>[\]()-]/g, '').slice(0, 140) || 'Empty'}</p>
                <div className="mt-1 flex items-center gap-1.5 text-[10px] text-muted">
                  <AreaDot id={n.area_id} /> {timeAgo(n.updated_at)}
                </div>
              </button>
            </li>
          ))}
        </ul>
      </aside>
      <section className="flex min-w-0 flex-col">
        {!draft ? (
          <div className="grid flex-1 place-items-center text-sm text-muted">Pick a note</div>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-2.5">
              <input
                value={draft.title}
                onChange={(e) => edit({ title: e.target.value })}
                disabled={!editable}
                maxLength={200}
                aria-label="Note title"
                className="min-w-0 flex-1 bg-transparent text-lg font-semibold outline-none"
              />
              <span className="text-[11px] text-muted">{saving === 'saving' ? 'Saving…' : saving === 'saved' ? 'Saved' : ''}</span>
              <div className="flex rounded-control border border-line p-0.5 text-xs">
                {(['edit', 'split', 'read'] as const).map((m) => (
                  <button key={m} type="button" onClick={() => setMode(m)} className={cn('rounded px-2 py-1 capitalize cursor-pointer', mode === m ? 'bg-ink text-page' : 'text-muted hover:text-ink')}>
                    {m}
                  </button>
                ))}
              </div>
              {editable && (
                <>
                  <select
                    value={draft.area_id ?? ''}
                    onChange={(e) => edit({ area_id: e.target.value || null })}
                    aria-label="Research area"
                    className="h-8 rounded-control border border-line bg-card px-2 text-xs"
                  >
                    {areaOptions(areas).map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                  <button type="button" aria-label={draft.pinned ? 'Unpin' : 'Pin'} onClick={() => edit({ pinned: !draft.pinned })} className={cn('rounded-control p-1.5 cursor-pointer hover:bg-page', draft.pinned ? 'text-crimson' : 'text-muted')}>
                    <Icon name="pin" size={16} />
                  </button>
                  <button type="button" aria-label="Delete note" onClick={() => setDeleting(true)} className="rounded-control p-1.5 text-muted hover:bg-page hover:text-crimson cursor-pointer">
                    <Icon name="trash" size={16} />
                  </button>
                </>
              )}
            </div>
            <div className={cn('grid flex-1', mode === 'split' && 'lg:grid-cols-2')}>
              {mode !== 'read' && (
                <textarea
                  value={draft.body}
                  onChange={(e) => edit({ body: e.target.value })}
                  disabled={!editable}
                  maxLength={50000}
                  placeholder={'# Idea\n\nWrite in Markdown: **bold**, lists, `code`, links…'}
                  aria-label="Note body"
                  className={cn('min-h-[50vh] w-full resize-none bg-transparent p-5 font-mono text-[13px] leading-relaxed outline-none', mode === 'split' && 'lg:border-r lg:border-line')}
                />
              )}
              {mode !== 'edit' && (
                <div className={cn('overflow-y-auto p-5', mode === 'split' && 'hidden lg:block')}>
                  <Markdown text={draft.body || '_Nothing here yet._'} />
                </div>
              )}
            </div>
          </>
        )}
      </section>
      <ConfirmModal isOpen={deleting} title="Delete this note?" description="This cannot be undone." confirmLabel="Delete" danger onConfirm={remove} onCancel={() => setDeleting(false)} />
    </div>
  );
}
