import { useState } from 'react';
import { errorMessage } from '@layerto/api-client';
import type { Project } from '@layerto/types';
import { Avatar, Button, Card, Chip, EmptyState, Icon, Input, Modal, PageHeader, Reveal, Select, Skeleton, Tabs, useNotify, useResource } from '@layerto/ui';
import { api } from '../../lib/api';
import { useHub } from '../../hub/HubContext';
import { pct, shortDate } from '../studio/lib/format';

/** All projects you own or that are shared with your teams. Each project holds its data, labeling, training runs and models. */
export function ProjectsPage() {
  const { navigate, plan } = useHub();
  const projects = useResource(() => api.studioProjects(), 'studio-projects');
  const [creating, setCreating] = useState(false);
  const [filter, setFilter] = useState<'all' | 'mine' | 'shared'>('all');
  const list = (projects.data ?? []).filter((p) => filter === 'all' || (filter === 'mine' ? p.role === 'owner' : p.role !== 'owner'));
  const limit = plan?.limits.projects;

  return (
    <>
      <PageHeader
        title="Projects"
        description="One place per piece of work: store datasets, label images, train detectors and manage the models they produce."
        actions={
          <Button icon="plus" onClick={() => setCreating(true)}>
            New project
          </Button>
        }
      />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs<'all' | 'mine' | 'shared'>
          value={filter}
          onChange={setFilter}
          items={[
            { value: 'all', label: 'All', count: projects.data?.length },
            { value: 'mine', label: 'Mine' },
            { value: 'shared', label: 'Shared with me', icon: 'team' },
          ]}
        />
        {limit !== undefined && (
          <span className="text-xs text-muted">
            {(projects.data ?? []).filter((p) => p.role === 'owner').length} of {limit} projects on your plan
          </span>
        )}
      </div>
      <Reveal index={0}>
        {projects.loading ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-44" />
            ))}
          </div>
        ) : list.length === 0 ? (
          <Card>
            <EmptyState
              icon="folder"
              title={filter === 'shared' ? 'Nothing shared with you yet' : 'No projects yet'}
              description="A project keeps one piece of work together, for example “Tea leaf disease v2”: its datasets, labels, runs and models."
              action={
                filter !== 'shared' && (
                  <Button icon="plus" onClick={() => setCreating(true)}>
                    New project
                  </Button>
                )
              }
            />
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {list.map((p) => (
              <ProjectCard key={p.id} p={p} onOpen={() => navigate(`/projects/${p.id}`)} />
            ))}
            <button
              type="button"
              onClick={() => setCreating(true)}
              className="grid min-h-44 place-items-center rounded-l2 border-2 border-dashed border-line text-muted hover:border-crimson hover:text-crimson cursor-pointer transition-colors"
            >
              <span className="flex flex-col items-center gap-2 text-sm font-medium">
                <Icon name="plus" size={22} /> New project
              </span>
            </button>
          </div>
        )}
      </Reveal>
      <CreateProjectModal
        isOpen={creating}
        onClose={() => setCreating(false)}
        onCreated={(p) => {
          setCreating(false);
          void projects.reload();
          navigate(`/projects/${p.id}`);
        }}
      />
    </>
  );
}

function ProjectCard({ p, onOpen }: { p: Project; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group relative overflow-hidden text-left rounded-l2 border border-line bg-card p-5 shadow-l1 transition-all hover:-translate-y-0.5 hover:border-crimson-border hover:shadow-l2 cursor-pointer"
    >
      <div aria-hidden className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-crimson/70 via-crimson/30 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
      <div className="flex items-start justify-between gap-3">
        <span className="grid size-10 place-items-center rounded-control bg-crimson-tint text-crimson">
          <Icon name="folder" size={20} />
        </span>
        <div className="flex flex-wrap justify-end gap-1.5">
          {p.team_name && <Chip variant="brand">{p.team_name}</Chip>}
          {p.role && p.role !== 'owner' && <Chip variant="neutral">{p.role}</Chip>}
          {p.is_public && <Chip variant="active">Public</Chip>}
        </div>
      </div>
      <h3 className="mt-3 font-semibold text-ink group-hover:text-crimson transition-colors">{p.name}</h3>
      <p className="mt-1 text-sm text-muted line-clamp-2 min-h-10">{p.description || 'No description'}</p>
      <div className="mt-4 grid grid-cols-4 gap-2 text-center">
        {[
          ['Datasets', p.datasets],
          ['Runs', p.jobs],
          ['Models', p.models],
          ['Best mAP', p.best_map != null ? pct(p.best_map) : '—'],
        ].map(([k, v]) => (
          <div key={k} className="rounded-control bg-page py-1.5">
            <div className="text-sm font-bold text-ink">{v}</div>
            <div className="text-[10px] text-muted">{k}</div>
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center gap-2 text-xs text-muted">
        <Avatar name={p.owner || '?'} size={18} />@{p.owner} · updated {shortDate(p.updated_at)}
      </div>
    </button>
  );
}

export function CreateProjectModal({ isOpen, onClose, onCreated }: { isOpen: boolean; onClose: () => void; onCreated: (p: Project) => void }) {
  const notify = useNotify();
  const { has } = useHub();
  const teams = useResource(() => api.teams(), 'teams');
  const areas = useResource(() => (has('research') ? api.areas() : Promise.resolve([])), `research-areas-${has('research')}`);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [team, setTeam] = useState('');
  const [area, setArea] = useState('');
  const [busy, setBusy] = useState(false);
  const writableTeams = (teams.data ?? []).filter((t) => t.my_status === 'active' && t.my_role !== 'viewer');
  const submit = async () => {
    setBusy(true);
    try {
      const p = await api.studioCreateProject({ name: name.trim(), description: description.trim(), team_id: team || undefined, area_id: area || undefined });
      setName('');
      setDescription('');
      onCreated(p);
    } catch (err) {
      notify(errorMessage(err, "Couldn't create the project."), 'error');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="New project">
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} required autoFocus />
        <Input label="Short description" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={300} />
        {writableTeams.length > 0 && (
          <Select label="Share with a team" value={team} onChange={(e) => setTeam(e.target.value)} options={[{ value: '', label: 'Only me' }, ...writableTeams.map((t) => ({ value: t.id, label: t.name }))]} />
        )}
        {(areas.data ?? []).length > 0 && (
          <Select
            label="Research area"
            value={area}
            onChange={(e) => setArea(e.target.value)}
            options={[{ value: '', label: 'None' }, ...(areas.data ?? []).filter((a) => a.role !== 'viewer').map((a) => ({ value: a.id, label: a.name }))]}
          />
        )}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={busy} disabled={!name.trim()}>
            Create
          </Button>
        </div>
      </form>
    </Modal>
  );
}
