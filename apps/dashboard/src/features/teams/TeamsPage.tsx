import { useState } from 'react';
import { errorMessage } from '@layerto/api-client';
import type { Team } from '@layerto/types';
import { Avatar, Button, Card, Chip, ConfirmModal, EmptyState, Icon, Input, Modal, PageHeader, Reveal, Skeleton, useNotify, useResource } from '@layerto/ui';
import { api } from '../../lib/api';
import { useHub } from '../../hub/HubContext';
import { Locked } from '../../hub/Locked';
import { timeAgo } from '../home/util';

/** Teams: invite collaborators by username and share projects and research areas with them. */
export function TeamsPage({ id }: { id?: string }) {
  if (id) return <TeamDetail id={id} />;
  return <TeamsList />;
}

function TeamsList() {
  const { navigate, has } = useHub();
  const notify = useNotify();
  const teams = useResource(() => api.teams(), 'teams');
  const [creating, setCreating] = useState(false);
  const invites = (teams.data ?? []).filter((t) => t.my_status === 'invited');
  const mine = (teams.data ?? []).filter((t) => t.my_status === 'active');
  const respond = async (t: Team, accept: boolean, me: string) => {
    try {
      if (accept) await api.acceptInvite(t.id);
      else await api.removeMember(t.id, me);
      notify(accept ? `You joined ${t.name}` : 'Invite declined', 'success');
      void teams.reload();
    } catch (err) {
      notify(errorMessage(err, "Couldn't respond to the invite."), 'error');
    }
  };
  const { user } = useHub();

  return (
    <>
      <PageHeader
        title="Teams"
        description="Work together: share projects and research areas, with editor and viewer roles and a shared activity log."
        actions={
          has('teams') && (
            <Button icon="plus" onClick={() => setCreating(true)}>
              New team
            </Button>
          )
        }
      />
      {invites.length > 0 && (
        <Reveal index={0}>
          <Card title="Invitations" className="border-crimson-border">
            <ul className="divide-y divide-line">
              {invites.map((t) => (
                <li key={t.id} className="flex flex-wrap items-center gap-3 py-3">
                  <Avatar name={t.name} size={36} />
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold">{t.name}</div>
                    <div className="text-xs text-muted">
                      @{t.owner} invited you as {t.members.find((m) => m.user_id === user.id)?.role ?? 'member'}
                    </div>
                  </div>
                  <Button size="sm" onClick={() => void respond(t, true, user.id)}>
                    Accept
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => void respond(t, false, user.id)}>
                    Decline
                  </Button>
                </li>
              ))}
            </ul>
          </Card>
        </Reveal>
      )}
      {teams.loading ? (
        <Skeleton className="h-48" />
      ) : mine.length === 0 ? (
        has('teams') ? (
          <Card>
            <EmptyState icon="team" title="No teams yet" description="Create a team for your lab, company or study group, then invite people by their Layerto username." action={<Button icon="plus" onClick={() => setCreating(true)}>New team</Button>} />
          </Card>
        ) : (
          <Locked feature="teams" />
        )
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {mine.map((t, i) => (
            <Reveal key={t.id} index={i}>
              <button type="button" onClick={() => navigate(`/teams/${t.id}`)} className="group h-full w-full rounded-l2 border border-line bg-card p-5 text-left shadow-l1 transition-all hover:-translate-y-0.5 hover:shadow-l2 cursor-pointer">
                <div className="flex items-center gap-3">
                  <Avatar name={t.name} size={40} />
                  <div className="min-w-0">
                    <h3 className="truncate font-semibold group-hover:text-crimson">{t.name}</h3>
                    <p className="text-xs text-muted">
                      {t.my_role} · owner @{t.owner}
                    </p>
                  </div>
                </div>
                <p className="mt-3 line-clamp-2 min-h-10 text-sm text-muted">{t.description || 'No description'}</p>
                <div className="mt-4 flex items-center justify-between">
                  <div className="flex -space-x-2">
                    {t.members
                      .filter((m) => m.status === 'active')
                      .slice(0, 6)
                      .map((m) => (
                        <span key={m.user_id} className="rounded-full ring-2 ring-card">
                          <Avatar name={m.username} size={26} />
                        </span>
                      ))}
                  </div>
                  <span className="text-xs text-muted">
                    {t.projects.length} projects · {t.areas.length} areas
                  </span>
                </div>
              </button>
            </Reveal>
          ))}
        </div>
      )}
      <CreateTeamModal
        open={creating}
        onClose={() => setCreating(false)}
        onCreated={(t) => {
          setCreating(false);
          navigate(`/teams/${t.id}`);
        }}
      />
    </>
  );
}

function CreateTeamModal({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (t: Team) => void }) {
  const notify = useNotify();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true);
    try {
      const t = await api.createTeam({ name: name.trim(), description: description.trim() });
      setName('');
      setDescription('');
      onCreated(t);
    } catch (err) {
      notify(errorMessage(err, "Couldn't create the team."), 'error');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal isOpen={open} onClose={onClose} title="New team">
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <Input label="Name" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} placeholder="Vision Lab, University of Moratuwa" required autoFocus />
        <Input label="Description" value={description} maxLength={500} onChange={(e) => setDescription(e.target.value)} />
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={busy} disabled={!name.trim()}>
            Create team
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function TeamDetail({ id }: { id: string }) {
  const { navigate, user } = useHub();
  const notify = useNotify();
  const team = useResource(() => api.team(id), `team-${id}`);
  const activity = useResource(() => api.activity({ team: id }), `activity-team-${id}`);
  const [username, setUsername] = useState('');
  const [role, setRole] = useState<'editor' | 'viewer'>('editor');
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<'leave' | 'delete' | null>(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ name: '', description: '' });
  const t = team.data;
  if (team.error) {
    return (
      <Card>
        <EmptyState icon="team" title="Team not found" action={<Button onClick={() => navigate('/teams')}>All teams</Button>} />
      </Card>
    );
  }
  if (!t) return <Skeleton className="h-96" />;
  const owner = t.my_role === 'owner';
  const active = t.members.filter((m) => m.status === 'active').length;

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true);
    try {
      await fn();
      notify(ok, 'success');
      await team.reload();
    } catch (err) {
      notify(errorMessage(err, 'Something went wrong.'), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button type="button" className="inline-flex items-center gap-1 text-sm text-muted hover:text-crimson cursor-pointer" onClick={() => navigate('/teams')}>
        <Icon name="arrowLeft" size={14} /> Teams
      </button>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <Avatar name={t.name} size={56} />
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{t.name}</h1>
            <p className="text-sm text-muted">{t.description || 'No description'}</p>
          </div>
        </div>
        <div className="flex gap-2">
          {owner ? (
            <>
              <Button
                variant="secondary"
                icon="pen"
                onClick={() => {
                  setForm({ name: t.name, description: t.description });
                  setEditing(true);
                }}
              >
                Edit
              </Button>
              <Button variant="ghost" icon="trash" onClick={() => setConfirm('delete')}>
                Delete
              </Button>
            </>
          ) : (
            <Button variant="ghost" icon="logout" onClick={() => setConfirm('leave')}>
              Leave team
            </Button>
          )}
        </div>
      </div>
      <div className="grid gap-4 xl:grid-cols-3">
        <div className="space-y-4 xl:col-span-2">
          <Card title="Members" subtitle={`${active} of ${t.seats} seats used`} padded={false}>
            <ul className="divide-y divide-line">
              {t.members.map((m) => (
                <li key={m.user_id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                  <Avatar name={m.username} size={32} />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium">
                      {m.name || m.username} {m.user_id === user.id && <span className="text-muted">(you)</span>}
                    </div>
                    <div className="text-xs text-muted">
                      @{m.username}
                      {m.status === 'invited' && ' · invite pending'}
                    </div>
                  </div>
                  {owner && m.role !== 'owner' ? (
                    <>
                      <select
                        value={m.role}
                        onChange={(e) => void run(() => api.setMemberRole(t.id, m.user_id, e.target.value as 'editor' | 'viewer'), 'Role updated')}
                        aria-label={`Role of ${m.username}`}
                        className="h-8 rounded-control border border-line bg-card px-2 text-xs"
                      >
                        <option value="editor">Editor</option>
                        <option value="viewer">Viewer</option>
                      </select>
                      <button type="button" aria-label={`Remove ${m.username}`} onClick={() => void run(() => api.removeMember(t.id, m.user_id), 'Member removed')} className="p-1.5 text-muted hover:text-crimson cursor-pointer">
                        <Icon name="close" size={15} />
                      </button>
                    </>
                  ) : (
                    <Chip variant={m.role === 'owner' ? 'brand' : 'neutral'}>{m.role}</Chip>
                  )}
                </li>
              ))}
            </ul>
            {owner && (
              <form
                className="flex flex-wrap gap-2 border-t border-line p-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!username.trim()) return;
                  void run(() => api.inviteMember(t.id, username.trim().replace(/^@/, ''), role), `Invited @${username.trim().replace(/^@/, '')}`).then(() => setUsername(''));
                }}
              >
                <input
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Invite by username"
                  aria-label="Username to invite"
                  className="h-10 min-w-48 flex-1 rounded-control border border-line-strong bg-card px-3 text-sm focus:outline-none focus:ring-2 focus:ring-focus"
                />
                <select value={role} onChange={(e) => setRole(e.target.value as 'editor' | 'viewer')} aria-label="Role" className="h-10 rounded-control border border-line-strong bg-card px-2 text-sm">
                  <option value="editor">Editor: can add and change</option>
                  <option value="viewer">Viewer: read only</option>
                </select>
                <Button type="submit" icon="mail" loading={busy} disabled={!username.trim() || active >= t.seats}>
                  Invite
                </Button>
                {active >= t.seats && <p className="w-full text-xs text-crimson">All seats are used. A bigger plan adds more seats.</p>}
              </form>
            )}
          </Card>
          <Card title="Activity">
            {activity.loading ? (
              <Skeleton className="h-24" />
            ) : (activity.data ?? []).length === 0 ? (
              <p className="text-sm text-muted">Nothing yet.</p>
            ) : (
              <ol className="space-y-3">
                {(activity.data ?? []).slice(0, 20).map((a) => (
                  <li key={a.id} className="flex gap-3 text-sm">
                    <Avatar name={a.actor} size={22} />
                    <div>
                      <span className="font-semibold">@{a.actor}</span> <span className="text-ink-secondary">{a.summary}</span>
                      <div className="text-[11px] text-muted">{timeAgo(a.created_at)}</div>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </Card>
        </div>
        <div className="space-y-4">
          <Card title="Shared projects">
            {t.projects.length === 0 ? (
              <p className="text-sm text-muted">Share a project from its Settings tab.</p>
            ) : (
              <ul className="space-y-1">
                {t.projects.map((p) => (
                  <li key={p.id}>
                    <button type="button" onClick={() => navigate(`/projects/${p.id}`)} className="flex w-full items-center gap-2 rounded-control px-2 py-1.5 text-left text-sm hover:bg-page cursor-pointer">
                      <Icon name="folder" size={15} className="text-muted" /> {p.name}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card title="Shared research areas">
            {t.areas.length === 0 ? (
              <p className="text-sm text-muted">Share an area from Research → Areas.</p>
            ) : (
              <ul className="space-y-1">
                {t.areas.map((a) => (
                  <li key={a.id}>
                    <button type="button" onClick={() => navigate('/research/areas')} className="flex w-full items-center gap-2 rounded-control px-2 py-1.5 text-left text-sm hover:bg-page cursor-pointer">
                      <Icon name="compass" size={15} className="text-muted" /> {a.name}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card title="Roles">
            <ul className="space-y-2 text-xs text-muted">
              <li>
                <strong className="text-ink">Owner</strong> manages members and sharing, and pays for seats.
              </li>
              <li>
                <strong className="text-ink">Editor</strong> adds datasets, labels, runs training and edits research items.
              </li>
              <li>
                <strong className="text-ink">Viewer</strong> sees everything shared, changes nothing.
              </li>
            </ul>
          </Card>
        </div>
      </div>
      <Modal isOpen={editing} onClose={() => setEditing(false)} title="Edit team">
        <div className="space-y-4">
          <Input label="Name" value={form.name} maxLength={80} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <Input label="Description" value={form.description} maxLength={500} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setEditing(false)}>
              Cancel
            </Button>
            <Button loading={busy} onClick={() => void run(() => api.updateTeam(t.id, form), 'Team updated').then(() => setEditing(false))}>
              Save
            </Button>
          </div>
        </div>
      </Modal>
      <ConfirmModal
        isOpen={confirm !== null}
        title={confirm === 'delete' ? `Delete ${t.name}?` : `Leave ${t.name}?`}
        description={confirm === 'delete' ? 'Shared projects and areas go back to their owners. Nothing is deleted.' : "You lose access to the team's shared projects and areas."}
        confirmLabel={confirm === 'delete' ? 'Delete team' : 'Leave'}
        danger
        onConfirm={async () => {
          try {
            if (confirm === 'delete') await api.deleteTeam(t.id);
            else await api.removeMember(t.id, user.id);
            navigate('/teams');
          } catch (err) {
            notify(errorMessage(err, 'Something went wrong.'), 'error');
          } finally {
            setConfirm(null);
          }
        }}
        onCancel={() => setConfirm(null)}
      />
    </>
  );
}
