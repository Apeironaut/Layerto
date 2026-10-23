import { useEffect, useMemo, useState } from 'react';
import { errorMessage } from '@layerto/api-client';
import type { Reference } from '@layerto/types';
import { Button, Card, ConfirmModal, EmptyState, Icon, Input, Modal, Select, Skeleton, cn, useNotify, useResource } from '@layerto/ui';
import { api } from '../../lib/api';
import { AreaTag, Pills, SearchBox, TextArea, areaOptions, useResearch } from './shared';

const STATUS: { value: Reference['status']; label: string; icon: 'bookmark' | 'book' | 'check' }[] = [
  { value: 'to_read', label: 'To read', icon: 'bookmark' },
  { value: 'reading', label: 'Reading', icon: 'book' },
  { value: 'read', label: 'Read', icon: 'check' },
];

/** Reading list: references with status, rating and notes; import a whole .bib file at once. */
export function LibraryView() {
  const { area, canWrite } = useResearch();
  const notify = useNotify();
  const refs = useResource(() => api.literature({ area }), `literature-${area}`);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<'all' | Reference['status']>('all');
  const [open, setOpen] = useState<Partial<Reference> | null>(() => (new URLSearchParams(window.location.search).get('new') ? { status: 'to_read' } : null));
  const [importing, setImporting] = useState(false);
  const list = useMemo(() => {
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    return (refs.data ?? []).filter((r) => (status === 'all' || r.status === status) && words.every((w) => `${r.title} ${r.authors} ${r.venue} ${r.year ?? ''}`.toLowerCase().includes(w)));
  }, [refs.data, q, status]);

  const quick = async (r: Reference, patch: Partial<Reference>) => {
    try {
      await api.researchUpdate('literature', r.id, patch as Record<string, unknown>);
      void refs.reload();
    } catch (err) {
      notify(errorMessage(err, "Couldn't update."), 'error');
    }
  };

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <SearchBox value={q} onChange={setQ} placeholder="Search references" />
          <Pills
            value={status}
            onChange={setStatus}
            items={[{ value: 'all', label: 'All', count: refs.data?.length }, ...STATUS.map((s) => ({ value: s.value, label: s.label, count: (refs.data ?? []).filter((r) => r.status === s.value).length }))]}
          />
        </div>
        {canWrite() && (
          <div className="flex gap-2">
            <Button variant="secondary" icon="upload" onClick={() => setImporting(true)}>
              Import BibTeX
            </Button>
            <Button icon="plus" onClick={() => setOpen({ status: 'to_read', area_id: area || null })}>
              Add reference
            </Button>
          </div>
        )}
      </div>
      {refs.loading ? (
        <Skeleton className="h-64" />
      ) : list.length === 0 ? (
        <Card>
          <EmptyState
            icon="book"
            title={(refs.data ?? []).length ? 'Nothing matches' : 'Your reading list is empty'}
            description="Add papers you want to read or cite. Paste a .bib export from Zotero, Mendeley or Google Scholar to bring in many at once."
            action={canWrite() && <Button icon="upload" onClick={() => setImporting(true)}>Import BibTeX</Button>}
          />
        </Card>
      ) : (
        <Card padded={false}>
          <ul className="divide-y divide-line">
            {list.map((r) => (
              <li key={r.id} className="group flex items-start gap-3 px-5 py-4">
                <button
                  type="button"
                  aria-label={`Status: ${r.status}`}
                  disabled={!canWrite(r.area_id)}
                  onClick={() => void quick(r, { status: r.status === 'to_read' ? 'reading' : r.status === 'reading' ? 'read' : 'to_read' })}
                  className={cn(
                    'mt-0.5 grid size-8 shrink-0 place-items-center rounded-control border transition-colors cursor-pointer',
                    r.status === 'read' ? 'border-emerald-500 bg-emerald-500 text-white' : r.status === 'reading' ? 'border-sky-500 text-sky-500' : 'border-line text-muted',
                  )}
                  title="Click to change status"
                >
                  <Icon name={STATUS.find((s) => s.value === r.status)!.icon} size={15} />
                </button>
                <div className="min-w-0 flex-1">
                  <button type="button" onClick={() => setOpen(r)} className="text-left font-medium leading-snug hover:text-crimson cursor-pointer">
                    {r.title}
                  </button>
                  <div className="mt-0.5 truncate text-xs text-muted">
                    {r.authors}
                    {r.venue && ` · ${r.venue}`}
                    {r.year && ` ${r.year}`}
                  </div>
                  {r.notes && <p className="mt-1 line-clamp-2 text-xs text-ink-secondary">{r.notes}</p>}
                  <div className="mt-1.5 flex flex-wrap items-center gap-2">
                    <AreaTag id={r.area_id} />
                    {r.url && (
                      <a href={r.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[11px] text-crimson hover:underline">
                        <Icon name="external" size={11} /> Open
                      </a>
                    )}
                    {r.doi && (
                      <a href={`https://doi.org/${r.doi}`} target="_blank" rel="noreferrer" className="text-[11px] text-muted hover:text-crimson">
                        doi:{r.doi}
                      </a>
                    )}
                  </div>
                </div>
                <Stars value={r.rating} onChange={canWrite(r.area_id) ? (rating) => void quick(r, { rating }) : undefined} />
              </li>
            ))}
          </ul>
        </Card>
      )}
      <ReferenceModal
        reference={open}
        onClose={() => setOpen(null)}
        onSaved={() => {
          setOpen(null);
          void refs.reload();
        }}
      />
      <BibtexModal
        open={importing}
        onClose={() => setImporting(false)}
        onDone={() => {
          setImporting(false);
          void refs.reload();
        }}
      />
    </>
  );
}

function Stars({ value, onChange }: { value: number; onChange?: (v: number) => void }) {
  return (
    <div className="flex shrink-0" aria-label={`Rating ${value} of 5`}>
      {[1, 2, 3, 4, 5].map((s) => (
        <button
          key={s}
          type="button"
          disabled={!onChange}
          onClick={() => onChange?.(s === value ? 0 : s)}
          className={cn('p-0.5 transition-colors', onChange && 'cursor-pointer hover:scale-110', s <= value ? 'text-amber-500' : 'text-line-strong')}
          aria-label={`${s} stars`}
        >
          <Icon name="star" size={14} />
        </button>
      ))}
    </div>
  );
}

function ReferenceModal({ reference, onClose, onSaved }: { reference: Partial<Reference> | null; onClose: () => void; onSaved: () => void }) {
  const notify = useNotify();
  const { areas, canWrite } = useResearch();
  const [f, setF] = useState<Partial<Reference>>({});
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState(false);
  useEffect(() => {
    if (reference) setF({ status: 'to_read', rating: 0, ...reference });
  }, [reference]);
  const isNew = !reference?.id;
  const editable = canWrite(reference?.area_id);
  const set = (p: Partial<Reference>) => setF((x) => ({ ...x, ...p }));
  const save = async () => {
    setBusy(true);
    try {
      const body = {
        title: f.title?.trim(),
        authors: f.authors ?? '',
        year: f.year || null,
        venue: f.venue ?? '',
        url: f.url ?? '',
        doi: f.doi ?? '',
        status: f.status,
        rating: f.rating ?? 0,
        notes: f.notes ?? '',
        area_id: f.area_id ?? '',
      };
      if (isNew) await api.researchCreate('literature', body);
      else await api.researchUpdate('literature', reference!.id!, body);
      onSaved();
    } catch (err) {
      notify(errorMessage(err, "Couldn't save."), 'error');
    } finally {
      setBusy(false);
    }
  };
  const remove = async () => {
    try {
      await api.researchDelete('literature', reference!.id!);
      setDeleting(false);
      onSaved();
    } catch (err) {
      notify(errorMessage(err, "Couldn't delete."), 'error');
    }
  };
  return (
    <Modal isOpen={reference !== null} onClose={onClose} title={isNew ? 'Add reference' : 'Reference'} size="lg">
      <div className="space-y-4">
        <Input label="Title" value={f.title ?? ''} maxLength={400} onChange={(e) => set({ title: e.target.value })} disabled={!editable} />
        <Input label="Authors" value={f.authors ?? ''} maxLength={1000} placeholder="He, K. and Gkioxari, G. and …" onChange={(e) => set({ authors: e.target.value })} disabled={!editable} />
        <div className="grid gap-4 sm:grid-cols-3">
          <Input label="Venue" value={f.venue ?? ''} maxLength={300} onChange={(e) => set({ venue: e.target.value })} disabled={!editable} />
          <Input label="Year" type="number" value={f.year ?? ''} onChange={(e) => set({ year: e.target.value ? Number(e.target.value) : null })} disabled={!editable} />
          <Select label="Status" value={f.status ?? 'to_read'} onChange={(e) => set({ status: e.target.value as Reference['status'] })} options={STATUS.map((s) => ({ value: s.value, label: s.label }))} disabled={!editable} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="URL" value={f.url ?? ''} maxLength={500} onChange={(e) => set({ url: e.target.value })} disabled={!editable} />
          <Input label="DOI" value={f.doi ?? ''} maxLength={200} onChange={(e) => set({ doi: e.target.value })} disabled={!editable} />
        </div>
        <Select label="Research area" value={f.area_id ?? ''} onChange={(e) => set({ area_id: e.target.value || null })} options={areaOptions(areas)} disabled={!editable} />
        <TextArea label="Your notes" value={f.notes ?? ''} onChange={(notes) => set({ notes })} rows={4} maxLength={20000} placeholder="Key idea, what to borrow, weaknesses…" />
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium">Rating</span>
          <Stars value={f.rating ?? 0} onChange={editable ? (rating) => set({ rating }) : undefined} />
        </div>
        {f.bibtex && (
          <details className="rounded-control border border-line bg-page p-3 text-sm">
            <summary className="cursor-pointer font-medium">BibTeX</summary>
            <pre className="mt-2 overflow-x-auto text-[12px]">{f.bibtex}</pre>
          </details>
        )}
        {editable && (
          <div className="flex items-center justify-between border-t border-line pt-4">
            {!isNew ? (
              <Button variant="ghost" icon="trash" onClick={() => setDeleting(true)}>
                Delete
              </Button>
            ) : (
              <span />
            )}
            <Button loading={busy} disabled={!f.title?.trim()} onClick={save}>
              Save
            </Button>
          </div>
        )}
      </div>
      <ConfirmModal isOpen={deleting} title="Remove this reference?" description="It is removed from your reading list." confirmLabel="Remove" danger onConfirm={remove} onCancel={() => setDeleting(false)} />
    </Modal>
  );
}

function BibtexModal({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: () => void }) {
  const notify = useNotify();
  const { area, areas } = useResearch();
  const [text, setText] = useState('');
  const [target, setTarget] = useState(area);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (open) setTarget(area);
  }, [open, area]);
  const found = (text.match(/@\w+\s*\{/g) ?? []).length;
  const submit = async () => {
    setBusy(true);
    try {
      const r = await api.importBibtex(text, target || undefined);
      notify(`Added ${r.added} of ${r.found} references`, 'success');
      setText('');
      onDone();
    } catch (err) {
      notify(errorMessage(err, "Couldn't import."), 'error');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal isOpen={open} onClose={onClose} title="Import BibTeX" description="Paste entries or load a .bib file. Up to 500 entries at a time." size="xl">
      <div className="space-y-4">
        <TextArea label="BibTeX" value={text} onChange={setText} rows={12} mono placeholder={'@inproceedings{he2017mask,\n  title={Mask R-CNN},\n  author={He, Kaiming and ...},\n  year={2017}\n}'} />
        <div className="flex flex-wrap items-center gap-3">
          <label className="inline-flex items-center gap-2 text-sm text-crimson cursor-pointer">
            <Icon name="upload" size={15} /> Load .bib file
            <input
              type="file"
              accept=".bib,.txt,text/plain"
              hidden
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (file) setText(await file.text());
                e.target.value = '';
              }}
            />
          </label>
          <span className="text-xs text-muted">{found ? `${found} entries found` : ''}</span>
          <div className="ml-auto w-56">
            <Select label="Into area" value={target} onChange={(e) => setTarget(e.target.value)} options={areaOptions(areas)} />
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={busy} disabled={!found} onClick={submit}>
            Import {found || ''}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
