import { useEffect, useMemo, useRef, useState } from 'react';
import { errorMessage } from '@layerto/api-client';
import type { Paper, PaperStatus } from '@layerto/types';
import { Alert, Button, Card, Chip, ConfirmModal, CopyButton, Drawer, EmptyState, Icon, Input, SegmentedControl, Select, Skeleton, cn, useNotify, useResource } from '@layerto/ui';
import { api } from '../../lib/api';
import { SITE_URL } from '../../config';
import { useHub } from '../../hub/HubContext';
import { bytes } from '../studio/lib/format';
import { timeAgo } from '../home/util';
import { AreaDot, AreaTag, SearchBox, TagInput, TextArea, areaOptions, useResearch } from './shared';

export const PAPER_STATUS: { value: PaperStatus; label: string; tone: string }[] = [
  { value: 'idea', label: 'Idea', tone: 'bg-slate-400' },
  { value: 'drafting', label: 'Drafting', tone: 'bg-sky-500' },
  { value: 'submitted', label: 'Submitted', tone: 'bg-violet-500' },
  { value: 'under_review', label: 'Under review', tone: 'bg-amber-500' },
  { value: 'accepted', label: 'Accepted', tone: 'bg-emerald-500' },
  { value: 'published', label: 'Published', tone: 'bg-crimson' },
];

/** Your papers from idea to publication: a board by status, a list, and an editor with PDF, BibTeX and publishing. */
export function PapersView() {
  const { area, canWrite } = useResearch();
  const notify = useNotify();
  const [q, setQ] = useState('');
  const [view, setView] = useState<'board' | 'list'>('board');
  const papers = useResource(() => api.papers({ area }), `papers-${area}`);
  const [open, setOpen] = useState<Partial<Paper> | null>(() => (new URLSearchParams(window.location.search).get('new') ? { area_id: area || null } : null));
  const [dragging, setDragging] = useState<string | null>(null);
  const list = useMemo(() => {
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    return (papers.data ?? []).filter((p) => words.every((w) => `${p.title} ${p.authors.join(' ')} ${p.venue} ${p.keywords.join(' ')}`.toLowerCase().includes(w)));
  }, [papers.data, q]);

  const move = async (p: Paper, status: PaperStatus) => {
    if (p.status === status) return;
    try {
      await api.researchUpdate<Paper>('papers', p.id, { status });
      void papers.reload();
    } catch (err) {
      notify(errorMessage(err, "Couldn't move the paper."), 'error');
    }
  };

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <SearchBox value={q} onChange={setQ} placeholder="Search papers" />
          <SegmentedControl
            label="View"
            value={view}
            onChange={(v) => setView(v as 'board' | 'list')}
            segments={[
              { value: 'board', label: 'Board' },
              { value: 'list', label: 'List' },
            ]}
          />
        </div>
        {canWrite() && (
          <Button icon="plus" onClick={() => setOpen({ area_id: area || null, status: 'idea' })}>
            New paper
          </Button>
        )}
      </div>
      {papers.loading ? (
        <Skeleton className="h-72" />
      ) : (papers.data ?? []).length === 0 ? (
        <Card>
          <EmptyState
            icon="file"
            title="No papers yet"
            description="Track every paper from first idea to camera-ready, link the models behind it and publish it on Layerto with its PDF."
            action={canWrite() && <Button icon="plus" onClick={() => setOpen({ area_id: area || null, status: 'idea' })}>New paper</Button>}
          />
        </Card>
      ) : view === 'board' ? (
        <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-2">
          {PAPER_STATUS.map((s) => {
            const col = list.filter((p) => p.status === s.value);
            return (
              <div
                key={s.value}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => {
                  const p = list.find((x) => x.id === dragging);
                  if (p) void move(p, s.value);
                  setDragging(null);
                }}
                className={cn('flex w-64 shrink-0 flex-col rounded-l2 border border-line bg-page/60 p-2 transition-colors', dragging && 'border-dashed border-crimson-border')}
              >
                <div className="flex items-center gap-2 px-2 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
                  <span className={`size-2 rounded-full ${s.tone}`} />
                  {s.label}
                  <span className="ml-auto font-mono">{col.length}</span>
                </div>
                <div className="mt-1 flex min-h-24 flex-col gap-2">
                  {col.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      draggable
                      onDragStart={() => setDragging(p.id)}
                      onDragEnd={() => setDragging(null)}
                      onClick={() => setOpen(p)}
                      className="rounded-control border border-line bg-card p-3 text-left shadow-l1 transition-all hover:-translate-y-0.5 hover:shadow-l2 cursor-grab active:cursor-grabbing"
                    >
                      <div className="flex items-start gap-2">
                        <AreaDot id={p.area_id} className="mt-1.5" />
                        <span className="line-clamp-3 text-sm font-medium leading-snug">{p.title}</span>
                      </div>
                      <div className="mt-2 truncate text-[11px] text-muted">{p.authors.slice(0, 3).join(', ') || 'No authors yet'}</div>
                      <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px] text-muted">
                        {p.venue && <span className="rounded bg-page px-1.5 py-0.5">{p.venue}{p.year ? ` ${p.year}` : ''}</span>}
                        {p.pdf_bytes > 0 && <Icon name="file" size={12} />}
                        {p.on_layerto && <Icon name="globe" size={12} className="text-crimson" />}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <Card padded={false}>
          <ul className="divide-y divide-line">
            {list.map((p) => {
              const st = PAPER_STATUS.find((s) => s.value === p.status);
              return (
                <li key={p.id}>
                  <button type="button" onClick={() => setOpen(p)} className="flex w-full items-center gap-3 px-5 py-3.5 text-left hover:bg-page cursor-pointer">
                    <span className={`size-2 shrink-0 rounded-full ${st?.tone}`} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium">{p.title}</div>
                      <div className="truncate text-xs text-muted">
                        {p.authors.join(', ')}
                        {p.venue && ` · ${p.venue}`}
                        {p.year && ` ${p.year}`}
                      </div>
                    </div>
                    <AreaTag id={p.area_id} />
                    <Chip variant="neutral">{st?.label}</Chip>
                    {p.on_layerto && <Chip variant="active">On Layerto</Chip>}
                    <span className="hidden w-20 text-right text-xs text-muted sm:block">{timeAgo(p.updated_at)}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </Card>
      )}
      {open && (
        <PaperEditor
          paper={open}
          onClose={() => setOpen(null)}
          onSaved={(p) => {
            setOpen(p);
            void papers.reload();
          }}
          onDeleted={() => {
            setOpen(null);
            void papers.reload();
          }}
        />
      )}
    </>
  );
}

function PaperEditor({ paper, onClose, onSaved, onDeleted }: { paper: Partial<Paper>; onClose: () => void; onSaved: (p: Paper) => void; onDeleted: () => void }) {
  const notify = useNotify();
  const { areas, canWrite } = useResearch();
  const { openComposer, user } = useHub();
  const models = useResource(() => api.studioModels(), 'studio-models');
  const [f, setF] = useState<Partial<Paper>>(paper);
  const [busy, setBusy] = useState(false);
  const [bib, setBib] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  useEffect(() => setF(paper), [paper]);
  const isNew = !paper.id;
  const editable = canWrite(paper.area_id);
  const set = (patch: Partial<Paper>) => setF((x) => ({ ...x, ...patch }));

  const save = async () => {
    setBusy(true);
    try {
      const body = {
        title: f.title?.trim(),
        authors: f.authors ?? [],
        venue: f.venue ?? '',
        year: f.year || null,
        status: f.status ?? 'idea',
        doi: f.doi ?? '',
        arxiv: f.arxiv ?? '',
        url: f.url ?? '',
        abstract: f.abstract ?? '',
        keywords: f.keywords ?? [],
        model_slugs: f.model_slugs ?? [],
        area_id: f.area_id ?? '',
      };
      const p = isNew ? await api.researchCreate<Paper>('papers', body) : await api.researchUpdate<Paper>('papers', paper.id!, body);
      notify(isNew ? 'Paper added' : 'Saved', 'success');
      onSaved(p);
    } catch (err) {
      notify(errorMessage(err, "Couldn't save the paper."), 'error');
    } finally {
      setBusy(false);
    }
  };
  const upload = async (file: File) => {
    if (!paper.id) return;
    setBusy(true);
    try {
      const p = await api.uploadPaperPdf(paper.id, file);
      notify('PDF uploaded', 'success');
      onSaved(p);
    } catch (err) {
      notify(errorMessage(err, "Couldn't upload the PDF."), 'error');
    } finally {
      setBusy(false);
    }
  };
  const openPdf = async () => {
    try {
      const blob = await api.getBlob(api.paperPdfPath(paper.id!));
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank', 'noopener');
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (err) {
      notify(errorMessage(err, "Couldn't open the PDF."), 'error');
    }
  };
  const publish = async (on: boolean) => {
    setBusy(true);
    try {
      const p = await api.publishPaper(paper.id!, on);
      notify(on ? 'Published on Layerto' : 'Unpublished', 'success');
      onSaved(p);
    } catch (err) {
      notify(errorMessage(err, "Couldn't change publishing."), 'error');
    } finally {
      setBusy(false);
    }
  };
  const remove = async () => {
    try {
      await api.researchDelete('papers', paper.id!);
      notify('Paper deleted', 'success');
      onDeleted();
    } catch (err) {
      notify(errorMessage(err, "Couldn't delete."), 'error');
    }
  };
  const publicUrl = paper.id ? `${SITE_URL}/papers/${paper.id}` : '';

  return (
    <Drawer
      isOpen
      onClose={onClose}
      title={isNew ? 'New paper' : 'Paper'}
      className="max-w-2xl"
      footer={
        editable && (
          <div className="flex items-center justify-between gap-2">
            {!isNew ? (
              <Button variant="ghost" icon="trash" onClick={() => setDeleting(true)}>
                Delete
              </Button>
            ) : (
              <span />
            )}
            <Button loading={busy} disabled={!f.title?.trim()} onClick={save}>
              {isNew ? 'Add paper' : 'Save'}
            </Button>
          </div>
        )
      }
    >
      <div className="space-y-4">
        <Input label="Title" value={f.title ?? ''} maxLength={300} onChange={(e) => set({ title: e.target.value })} autoFocus={isNew} />
        <TagInput label="Authors" value={f.authors ?? []} onChange={(authors) => set({ authors })} placeholder={user.first_name ? `${user.first_name} ${user.last_name}` : 'Type a name, press Enter'} />
        <div className="grid gap-4 sm:grid-cols-3">
          <Select label="Status" value={f.status ?? 'idea'} onChange={(e) => set({ status: e.target.value as PaperStatus })} options={PAPER_STATUS.map((s) => ({ value: s.value, label: s.label }))} />
          <Input label="Venue" value={f.venue ?? ''} maxLength={200} placeholder="CVPR, NeurIPS…" onChange={(e) => set({ venue: e.target.value })} />
          <Input label="Year" type="number" value={f.year ?? ''} onChange={(e) => set({ year: e.target.value ? Number(e.target.value) : null })} />
        </div>
        <Select label="Research area" value={f.area_id ?? ''} onChange={(e) => set({ area_id: e.target.value || null })} options={areaOptions(areas)} />
        <TextArea label="Abstract" value={f.abstract ?? ''} onChange={(abstract) => set({ abstract })} rows={6} maxLength={10000} hint={`${(f.abstract ?? '').length} characters`} />
        <TagInput label="Keywords" value={f.keywords ?? []} onChange={(keywords) => set({ keywords })} placeholder="object detection, few-shot…" />
        <div className="grid gap-4 sm:grid-cols-3">
          <Input label="DOI" value={f.doi ?? ''} maxLength={200} onChange={(e) => set({ doi: e.target.value })} />
          <Input label="arXiv id" value={f.arxiv ?? ''} maxLength={50} placeholder="2406.01234" onChange={(e) => set({ arxiv: e.target.value })} />
          <Input label="URL" value={f.url ?? ''} maxLength={500} onChange={(e) => set({ url: e.target.value })} />
        </div>
        <div>
          <span className="mb-1.5 block text-sm font-medium">Models behind this paper</span>
          <div className="flex flex-wrap gap-1.5">
            {(models.data ?? []).length === 0 && <span className="text-xs text-muted">Models you train show up here to link.</span>}
            {(models.data ?? []).map((m) => {
              const on = (f.model_slugs ?? []).includes(m.slug);
              return (
                <button
                  key={m.slug}
                  type="button"
                  onClick={() => set({ model_slugs: on ? (f.model_slugs ?? []).filter((s) => s !== m.slug) : [...(f.model_slugs ?? []), m.slug] })}
                  className={cn('rounded-pill border px-2.5 py-1 text-xs cursor-pointer transition-colors', on ? 'border-crimson bg-crimson-tint text-crimson' : 'border-line text-muted hover:text-ink')}
                >
                  {on && <Icon name="check" size={11} className="mr-1 inline" />}
                  {m.name}
                </button>
              );
            })}
          </div>
        </div>

        {!isNew && (
          <div className="space-y-3 rounded-l2 border border-line bg-page p-4">
            <div className="flex flex-wrap items-center gap-2">
              <Icon name="file" size={18} className="text-muted" />
              <span className="text-sm font-medium">PDF</span>
              <span className="text-xs text-muted">{paper.pdf_bytes ? bytes(paper.pdf_bytes) : 'none yet'}</span>
              <div className="ml-auto flex gap-2">
                {!!paper.pdf_bytes && (
                  <Button size="sm" variant="secondary" icon="external" onClick={openPdf}>
                    Open
                  </Button>
                )}
                {editable && (
                  <Button size="sm" variant="secondary" icon="upload" loading={busy} onClick={() => fileRef.current?.click()}>
                    {paper.pdf_bytes ? 'Replace' : 'Upload'}
                  </Button>
                )}
                <input
                  ref={fileRef}
                  type="file"
                  accept="application/pdf"
                  hidden
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void upload(file);
                    e.target.value = '';
                  }}
                />
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 border-t border-line pt-3">
              <Icon name="copy" size={18} className="text-muted" />
              <span className="text-sm font-medium">BibTeX</span>
              <Button
                size="sm"
                variant="ghost"
                className="ml-auto"
                onClick={async () => {
                  try {
                    setBib(await api.paperBibtex(paper.id!));
                  } catch (err) {
                    notify(errorMessage(err, "Couldn't build BibTeX."), 'error');
                  }
                }}
              >
                Show
              </Button>
            </div>
            {bib && (
              <div className="relative">
                <pre className="overflow-x-auto rounded-control bg-card p-3 text-[12px] leading-relaxed">{bib}</pre>
                <div className="absolute right-2 top-2">
                  <CopyButton text={bib} />
                </div>
              </div>
            )}
            <div className="flex flex-wrap items-center gap-2 border-t border-line pt-3">
              <Icon name="globe" size={18} className={paper.on_layerto ? 'text-crimson' : 'text-muted'} />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium">{paper.on_layerto ? 'Published on Layerto' : 'Publish on Layerto'}</div>
                <div className="truncate text-xs text-muted">
                  {paper.on_layerto ? publicUrl : 'A public page with the abstract, PDF, BibTeX and linked models. Needs an abstract (50+ characters) and authors.'}
                </div>
              </div>
              {editable && paper.owner_id === user.id && (
                <Button size="sm" variant={paper.on_layerto ? 'secondary' : 'primary'} loading={busy} onClick={() => void publish(!paper.on_layerto)}>
                  {paper.on_layerto ? 'Unpublish' : 'Publish'}
                </Button>
              )}
            </div>
            {paper.on_layerto && (
              <Alert tone="success">
                Live at{' '}
                <a className="font-semibold underline" href={publicUrl} target="_blank" rel="noreferrer">
                  {publicUrl.replace(/^https?:\/\//, '')}
                </a>
                .{' '}
                <button
                  type="button"
                  className="font-semibold text-crimson cursor-pointer"
                  onClick={() => openComposer({ space: 'research', title: `New paper: ${paper.title}`, body: (paper.abstract ?? '').slice(0, 600), link_kind: 'paper', link_ref: paper.id })}
                >
                  Share with the community
                </button>
              </Alert>
            )}
          </div>
        )}
      </div>
      <ConfirmModal isOpen={deleting} title="Delete this paper?" description="The paper, its PDF and its public page are removed." confirmLabel="Delete" danger onConfirm={remove} onCancel={() => setDeleting(false)} />
    </Drawer>
  );
}
