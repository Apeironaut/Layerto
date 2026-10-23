import { useEffect, useMemo, useState } from 'react';
import { errorMessage } from '@layerto/api-client';
import type { Experiment, Finding, Paper } from '@layerto/types';
import { Button, Card, ConfirmModal, EmptyState, Icon, Input, Markdown, Modal, Reveal, Select, Skeleton, cn, useNotify, useResource } from '@layerto/ui';
import { api } from '../../lib/api';
import { useHub } from '../../hub/HubContext';
import { timeAgo } from '../home/util';
import { AreaTag, Pills, SearchBox, TextArea, areaOptions, useResearch } from './shared';

const CONF: Record<Finding['confidence'], { label: string; bars: number; cls: string }> = {
  low: { label: 'Low confidence', bars: 1, cls: 'bg-amber-500' },
  medium: { label: 'Medium confidence', bars: 2, cls: 'bg-sky-500' },
  high: { label: 'High confidence', bars: 3, cls: 'bg-emerald-500' },
};

const STATUS: Record<Finding['status'], { label: string; cls: string }> = {
  open: { label: 'Open', cls: 'bg-page text-ink-secondary' },
  confirmed: { label: 'Confirmed', cls: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300' },
  refuted: { label: 'Refuted', cls: 'bg-crimson-tint text-crimson' },
};

/** Claims your work supports (or refutes), each with its evidence and how sure you are. */
export function FindingsView() {
  const { area, canWrite } = useResearch();
  const { openComposer } = useHub();
  const findings = useResource(() => api.findings({ area }), `findings-${area}`);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<'all' | Finding['status']>('all');
  const [open, setOpen] = useState<Partial<Finding> | null>(() => (new URLSearchParams(window.location.search).get('new') ? {} : null));
  const list = useMemo(() => {
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    return (findings.data ?? []).filter((f) => (status === 'all' || f.status === status) && words.every((w) => `${f.title} ${f.body}`.toLowerCase().includes(w)));
  }, [findings.data, q, status]);

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <SearchBox value={q} onChange={setQ} placeholder="Search findings" />
          <Pills
            value={status}
            onChange={setStatus}
            items={[
              { value: 'all', label: 'All' },
              { value: 'open', label: 'Open' },
              { value: 'confirmed', label: 'Confirmed' },
              { value: 'refuted', label: 'Refuted' },
            ]}
          />
        </div>
        {canWrite() && (
          <Button icon="plus" onClick={() => setOpen({ area_id: area || null, confidence: 'medium', status: 'open', evidence: [] })}>
            New finding
          </Button>
        )}
      </div>
      {findings.loading ? (
        <Skeleton className="h-60" />
      ) : list.length === 0 ? (
        <Card>
          <EmptyState
            icon="sparkles"
            title={(findings.data ?? []).length ? 'Nothing matches' : 'No findings yet'}
            description="Write down what your experiments show, link the evidence and mark how confident you are. Confirmed findings can appear on your portfolio."
            action={canWrite() && <Button icon="plus" onClick={() => setOpen({ area_id: area || null, confidence: 'medium', status: 'open', evidence: [] })}>New finding</Button>}
          />
        </Card>
      ) : (
        <div className="columns-1 gap-4 md:columns-2 2xl:columns-3 [&>*]:mb-4">
          {list.map((f, i) => (
            <Reveal key={f.id} index={i % 6}>
              <article className="break-inside-avoid rounded-l2 border border-line bg-card p-5 shadow-l1 transition-shadow hover:shadow-l2">
                <div className="flex items-center gap-2">
                  <span className={cn('rounded-pill px-2 py-0.5 text-[11px] font-semibold', STATUS[f.status].cls)}>{STATUS[f.status].label}</span>
                  <span className="flex items-end gap-0.5" title={CONF[f.confidence].label} aria-label={CONF[f.confidence].label}>
                    {[1, 2, 3].map((b) => (
                      <span key={b} className={cn('w-1 rounded-sm', b <= CONF[f.confidence].bars ? CONF[f.confidence].cls : 'bg-line')} style={{ height: 4 + b * 3 }} />
                    ))}
                  </span>
                  <span className="ml-auto">
                    <AreaTag id={f.area_id} />
                  </span>
                </div>
                <button type="button" onClick={() => setOpen(f)} className="mt-3 block text-left text-lg font-semibold leading-snug hover:text-crimson cursor-pointer">
                  {f.title}
                </button>
                {f.body && <Markdown text={f.body} compact className="mt-2 line-clamp-6 text-sm text-ink-secondary" />}
                {f.evidence.length > 0 && (
                  <ul className="mt-3 flex flex-wrap gap-1.5">
                    {f.evidence.map((e, j) => (
                      <li key={j} className="inline-flex items-center gap-1 rounded-pill border border-line px-2 py-0.5 text-[11px] text-muted">
                        <Icon name={e.type === 'experiment' ? 'flask' : e.type === 'paper' ? 'file' : 'link'} size={11} />
                        {e.label || e.ref}
                      </li>
                    ))}
                  </ul>
                )}
                <div className="mt-4 flex items-center justify-between text-[11px] text-muted">
                  <span>
                    @{f.owner} · {timeAgo(f.updated_at)}
                  </span>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 hover:text-crimson cursor-pointer"
                    onClick={() => openComposer({ space: 'research', title: f.title, body: f.body.slice(0, 3000) })}
                  >
                    <Icon name="share" size={12} /> Share
                  </button>
                </div>
              </article>
            </Reveal>
          ))}
        </div>
      )}
      <FindingModal
        finding={open}
        onClose={() => setOpen(null)}
        onSaved={() => {
          setOpen(null);
          void findings.reload();
        }}
      />
    </>
  );
}

function FindingModal({ finding, onClose, onSaved }: { finding: Partial<Finding> | null; onClose: () => void; onSaved: () => void }) {
  const notify = useNotify();
  const { areas, canWrite } = useResearch();
  const exps = useResource(() => (finding ? api.experiments() : Promise.resolve([] as Experiment[])), finding ? 'experiments-' : null);
  const papers = useResource(() => (finding ? api.papers() : Promise.resolve([] as Paper[])), finding ? 'papers-' : null);
  const [f, setF] = useState<Partial<Finding>>({});
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [evType, setEvType] = useState<'experiment' | 'paper' | 'url'>('experiment');
  const [evRef, setEvRef] = useState('');
  const [preview, setPreview] = useState(false);
  useEffect(() => {
    if (finding) setF({ evidence: [], confidence: 'medium', status: 'open', ...finding });
    setPreview(false);
  }, [finding]);
  const isNew = !finding?.id;
  const editable = canWrite(finding?.area_id);
  const set = (p: Partial<Finding>) => setF((x) => ({ ...x, ...p }));

  const addEvidence = () => {
    if (!evRef.trim()) return;
    const label = evType === 'experiment' ? exps.data?.find((e) => e.id === evRef)?.name : evType === 'paper' ? papers.data?.find((p) => p.id === evRef)?.title : evRef;
    set({ evidence: [...(f.evidence ?? []), { type: evType, ref: evRef.trim(), label: label ?? evRef }].slice(0, 20) });
    setEvRef('');
  };
  const save = async () => {
    setBusy(true);
    try {
      const body = { title: f.title?.trim(), body: f.body ?? '', evidence: f.evidence ?? [], confidence: f.confidence, status: f.status, area_id: f.area_id ?? '' };
      if (isNew) await api.researchCreate('findings', body);
      else await api.researchUpdate('findings', finding!.id!, body);
      notify('Finding saved', 'success');
      onSaved();
    } catch (err) {
      notify(errorMessage(err, "Couldn't save."), 'error');
    } finally {
      setBusy(false);
    }
  };
  const remove = async () => {
    try {
      await api.researchDelete('findings', finding!.id!);
      setDeleting(false);
      onSaved();
    } catch (err) {
      notify(errorMessage(err, "Couldn't delete."), 'error');
    }
  };
  return (
    <Modal isOpen={finding !== null} onClose={onClose} title={isNew ? 'New finding' : 'Finding'} size="xl">
      <div className="space-y-4">
        <Input label="Claim" value={f.title ?? ''} maxLength={200} placeholder="Mosaic augmentation adds +3 mAP on objects under 32 px" onChange={(e) => set({ title: e.target.value })} disabled={!editable} />
        <div className="grid gap-4 sm:grid-cols-3">
          <Select label="Status" value={f.status ?? 'open'} onChange={(e) => set({ status: e.target.value as Finding['status'] })} options={Object.entries(STATUS).map(([value, s]) => ({ value, label: s.label }))} disabled={!editable} />
          <Select label="Confidence" value={f.confidence ?? 'medium'} onChange={(e) => set({ confidence: e.target.value as Finding['confidence'] })} options={Object.entries(CONF).map(([value, s]) => ({ value, label: s.label }))} disabled={!editable} />
          <Select label="Research area" value={f.area_id ?? ''} onChange={(e) => set({ area_id: e.target.value || null })} options={areaOptions(areas)} disabled={!editable} />
        </div>
        <div>
          <div className="mb-1.5 flex justify-end">
            <button type="button" className="text-xs text-crimson cursor-pointer" onClick={() => setPreview((v) => !v)}>
              {preview ? 'Edit' : 'Preview'}
            </button>
          </div>
          {preview ? (
            <div className="min-h-32 rounded-control border border-line bg-page p-3">
              <Markdown text={f.body || '_Nothing yet_'} />
            </div>
          ) : (
            <TextArea label="Details" value={f.body ?? ''} onChange={(body) => set({ body })} rows={6} maxLength={10000} placeholder="What you observed, under which conditions, and caveats. Markdown works." />
          )}
        </div>
        <div>
          <span className="mb-1.5 block text-sm font-medium">Evidence</span>
          <ul className="mb-2 space-y-1.5">
            {(f.evidence ?? []).map((e, i) => (
              <li key={i} className="flex items-center gap-2 rounded-control bg-page px-3 py-2 text-sm">
                <Icon name={e.type === 'experiment' ? 'flask' : e.type === 'paper' ? 'file' : 'link'} size={14} className="text-muted" />
                <span className="flex-1 truncate">{e.label || e.ref}</span>
                {editable && (
                  <button type="button" aria-label="Remove evidence" className="text-muted hover:text-crimson cursor-pointer" onClick={() => set({ evidence: (f.evidence ?? []).filter((_, j) => j !== i) })}>
                    <Icon name="close" size={13} />
                  </button>
                )}
              </li>
            ))}
          </ul>
          {editable && (
            <div className="flex flex-wrap gap-2">
              <select value={evType} onChange={(e) => (setEvType(e.target.value as typeof evType), setEvRef(''))} className="h-9 rounded-control border border-line-strong bg-card px-2 text-sm" aria-label="Evidence type">
                <option value="experiment">Experiment</option>
                <option value="paper">Paper</option>
                <option value="url">Link</option>
              </select>
              {evType === 'url' ? (
                <input value={evRef} onChange={(e) => setEvRef(e.target.value)} placeholder="https://…" className="h-9 min-w-48 flex-1 rounded-control border border-line-strong bg-card px-3 text-sm" />
              ) : (
                <select value={evRef} onChange={(e) => setEvRef(e.target.value)} className="h-9 min-w-48 flex-1 rounded-control border border-line-strong bg-card px-2 text-sm" aria-label="Evidence">
                  <option value="">Choose…</option>
                  {(evType === 'experiment' ? (exps.data ?? []).map((x) => ({ id: x.id, t: x.name })) : (papers.data ?? []).map((x) => ({ id: x.id, t: x.title }))).map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.t}
                    </option>
                  ))}
                </select>
              )}
              <Button size="sm" variant="secondary" onClick={addEvidence} disabled={!evRef}>
                Add
              </Button>
            </div>
          )}
        </div>
        {editable && (
          <div className="flex items-center justify-between border-t border-line pt-4">
            {!isNew ? (
              <Button variant="ghost" icon="trash" onClick={() => setDeleting(true)}>
                Delete
              </Button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <Button variant="secondary" onClick={onClose}>
                Cancel
              </Button>
              <Button loading={busy} disabled={!f.title?.trim()} onClick={save}>
                Save
              </Button>
            </div>
          </div>
        )}
      </div>
      <ConfirmModal isOpen={deleting} title="Delete this finding?" description="This cannot be undone." confirmLabel="Delete" danger onConfirm={remove} onCancel={() => setDeleting(false)} />
    </Modal>
  );
}
