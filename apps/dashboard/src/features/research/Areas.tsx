import { useState } from 'react';
import { errorMessage } from '@layerto/api-client';
import type { ResearchArea } from '@layerto/types';
import { Button, Card, Chip, ConfirmModal, EmptyState, Icon, Input, Modal, Reveal, Select, Switch, cn, useNotify, useResource } from '@layerto/ui';
import { api } from '../../lib/api';
import { AREA_COLORS, useResearch } from './shared';
import { timeAgo } from '../home/util';

/** Research areas: separate lines of research, each with its own papers, experiments and team. */
export function AreasView() {
  const { areas, reloadAreas, setArea, go, area } = useResearch();
  const notify = useNotify();
  const [editing, setEditing] = useState<Partial<ResearchArea> | null>(() => (new URLSearchParams(window.location.search).get('new') ? {} : null));
  const [deleting, setDeleting] = useState<ResearchArea | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const visible = areas.filter((a) => showArchived || a.status !== 'archived');

  const remove = async () => {
    if (!deleting) return;
    try {
      await api.deleteArea(deleting.id);
      if (area === deleting.id) setArea('');
      notify('Area deleted. Its items stay in your workspace without an area.', 'success');
      await reloadAreas();
    } catch (err) {
      notify(errorMessage(err, "Couldn't delete the area."), 'error');
    } finally {
      setDeleting(null);
    }
  };

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-sm text-muted">
          Areas keep separate lines of research apart, for example “Small-object detection” and “Crop disease”. Share an area with a team to work on it together.
        </p>
        <div className="flex items-center gap-3">
          <Switch checked={showArchived} onChange={setShowArchived} label="Show archived" />
          <Button icon="plus" onClick={() => setEditing({})}>
            New area
          </Button>
        </div>
      </div>
      {visible.length === 0 ? (
        <Card>
          <EmptyState icon="compass" title="No research areas yet" description="Create your first area to group papers, experiments and findings." action={<Button icon="plus" onClick={() => setEditing({})}>New area</Button>} />
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {visible.map((a, i) => {
            const color = a.color || AREA_COLORS[i % AREA_COLORS.length];
            return (
              <Reveal key={a.id} index={i}>
                <div className={cn('group relative h-full overflow-hidden rounded-l2 border border-line bg-card p-5 shadow-l1 transition-all hover:shadow-l2', a.status === 'archived' && 'opacity-60')}>
                  <div aria-hidden className="absolute inset-x-0 top-0 h-1.5" style={{ background: color }} />
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="text-lg font-semibold">{a.name}</h3>
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        {a.status !== 'active' && <Chip variant="neutral">{a.status}</Chip>}
                        {a.team_name && <Chip variant="brand">{a.team_name}</Chip>}
                        {a.role !== 'owner' && <Chip variant="neutral">{a.role}</Chip>}
                        {a.is_public && <Chip variant="active">On portfolio</Chip>}
                      </div>
                    </div>
                    {a.role !== 'viewer' && (
                      <button type="button" aria-label="Edit area" className="rounded-control p-1.5 text-muted hover:bg-page hover:text-ink cursor-pointer" onClick={() => setEditing(a)}>
                        <Icon name="pen" size={15} />
                      </button>
                    )}
                  </div>
                  <p className="mt-2 line-clamp-3 min-h-10 text-sm text-muted">{a.description || 'No description'}</p>
                  <div className="mt-4 grid grid-cols-5 gap-1 text-center">
                    {[
                      ['Papers', a.papers],
                      ['Exps', a.experiments],
                      ['Findings', a.findings],
                      ['Notes', a.notes],
                      ['Tasks', a.open_tasks],
                    ].map(([k, v]) => (
                      <div key={k} className="rounded-control bg-page py-1.5">
                        <div className="text-sm font-bold">{v}</div>
                        <div className="text-[10px] text-muted">{k}</div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 flex items-center justify-between">
                    <span className="text-[11px] text-muted">
                      @{a.owner} · updated {timeAgo(a.updated_at)}
                    </span>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        setArea(a.id);
                        go('overview');
                      }}
                    >
                      Open
                    </Button>
                  </div>
                </div>
              </Reveal>
            );
          })}
        </div>
      )}
      <AreaModal
        area={editing}
        onClose={() => setEditing(null)}
        onSaved={async (a, created) => {
          setEditing(null);
          await reloadAreas();
          if (created) setArea(a.id);
        }}
        onDelete={(a) => {
          setEditing(null);
          setDeleting(a);
        }}
      />
      <ConfirmModal
        isOpen={deleting !== null}
        title={`Delete “${deleting?.name ?? ''}”?`}
        description="Papers, experiments, findings and notes in this area are kept and move to “no area”."
        confirmLabel="Delete area"
        danger
        onConfirm={remove}
        onCancel={() => setDeleting(null)}
      />
    </>
  );
}

function AreaModal({
  area,
  onClose,
  onSaved,
  onDelete,
}: {
  area: Partial<ResearchArea> | null;
  onClose: () => void;
  onSaved: (a: ResearchArea, created: boolean) => void;
  onDelete: (a: ResearchArea) => void;
}) {
  const notify = useNotify();
  const teams = useResource(() => api.teams(), 'teams');
  const [form, setForm] = useState<Partial<ResearchArea>>({});
  const [key, setKey] = useState<Partial<ResearchArea> | null>(null);
  if (area !== key) {
    setKey(area);
    setForm(area ? { color: AREA_COLORS[0], status: 'active', ...area } : {});
  }
  const [busy, setBusy] = useState(false);
  const isNew = !area?.id;
  const owner = isNew || area?.role === 'owner';
  const save = async () => {
    setBusy(true);
    try {
      const body = { name: form.name?.trim(), description: form.description ?? '', color: form.color, status: form.status, is_public: form.is_public ?? false, ...(owner ? { team_id: form.team_id ?? '' } : {}) };
      const a = isNew ? await api.createArea(body) : await api.updateArea(area!.id!, body);
      onSaved(a, isNew);
    } catch (err) {
      notify(errorMessage(err, "Couldn't save the area."), 'error');
    } finally {
      setBusy(false);
    }
  };
  const myTeams = (teams.data ?? []).filter((t) => t.my_status === 'active' && t.my_role !== 'viewer');
  return (
    <Modal isOpen={area !== null} onClose={onClose} title={isNew ? 'New research area' : 'Edit area'} size="lg">
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <Input label="Name" value={form.name ?? ''} onChange={(e) => setForm({ ...form, name: e.target.value })} maxLength={80} required autoFocus />
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium">Description</span>
          <textarea
            value={form.description ?? ''}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            maxLength={2000}
            rows={3}
            placeholder="The question this line of research tries to answer"
            className="w-full rounded-control border border-line-strong bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-focus"
          />
        </label>
        <div>
          <span className="mb-1.5 block text-sm font-medium">Colour</span>
          <div className="flex flex-wrap gap-2">
            {AREA_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                aria-label={`Colour ${c}`}
                onClick={() => setForm({ ...form, color: c })}
                className={cn('size-8 rounded-full border-2 transition-transform cursor-pointer hover:scale-110', form.color === c ? 'border-ink scale-110' : 'border-transparent')}
                style={{ background: c }}
              />
            ))}
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Select
            label="Status"
            value={form.status ?? 'active'}
            onChange={(e) => setForm({ ...form, status: e.target.value as ResearchArea['status'] })}
            options={[
              { value: 'active', label: 'Active' },
              { value: 'paused', label: 'Paused' },
              { value: 'archived', label: 'Archived' },
            ]}
          />
          {owner && (
            <Select
              label="Team"
              value={form.team_id ?? ''}
              onChange={(e) => setForm({ ...form, team_id: e.target.value || null })}
              options={[{ value: '', label: 'Only me' }, ...myTeams.map((t) => ({ value: t.id, label: t.name }))]}
            />
          )}
        </div>
        <Switch checked={form.is_public ?? false} onChange={(v) => setForm({ ...form, is_public: v })} label="Show findings on my portfolio site" description="Only findings marked confirmed are shown." />
        <div className="flex items-center justify-between gap-2">
          {!isNew && area?.role === 'owner' ? (
            <Button type="button" variant="ghost" icon="trash" onClick={() => onDelete(area as ResearchArea)}>
              Delete
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" loading={busy} disabled={!form.name?.trim()}>
              {isNew ? 'Create area' : 'Save'}
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
