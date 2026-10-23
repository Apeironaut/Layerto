import { useState } from 'react';
import { Button, Icon, Modal, Skeleton, useResource } from '@layerto/ui';
import { useAreaVault } from '../ResearchAreaBoundary';
import type { CollaborationContract, OptionalModuleId, ResearchArea, ResearchTask } from '@layerto/types';

const CREDIT_ROLES = [
  'Conceptualization',
  'Data Curation',
  'Formal Analysis',
  'Funding Acquisition',
  'Investigation',
  'Methodology',
  'Project Administration',
  'Resources',
  'Software',
  'Supervision',
  'Validation',
  'Visualization',
  'Writing – Original Draft',
  'Writing – Review & Editing',
];

export function TechCollaborationTab() {
  const { area, scopedClient, isScopedCollaborator, setIsScopedCollaborator, updateAreaLocally } = useAreaVault();
  const [isCreatingContract, setIsCreatingContract] = useState(false);
  const [uninstallConfirm, setUninstallConfirm] = useState(false);

  const handleUninstallModule = async () => {
    const current = (area.enabled_modules as OptionalModuleId[]) || [];
    const updated = current.filter((m) => m !== 'tech_collaboration');
    try {
      await scopedClient.updateArea(area.id, {
        enabled_modules: updated,
      } as Partial<ResearchArea>);
      updateAreaLocally({ enabled_modules: updated });
    } catch (err) {
      console.error('Failed to uninstall module', err);
    }
  };

  // New contract form states
  const [collabEmail, setCollabEmail] = useState('');
  const [collabName, setCollabName] = useState('');
  const [teamName, setTeamName] = useState('');
  const [collabRole, setCollabRole] = useState<'editor' | 'owner' | 'viewer'>('editor');
  const [collabModel, setCollabModel] = useState<'voluntary_credit' | 'royalty_split' | 'paid_bounty'>('royalty_split');
  const [selectedRoles, setSelectedRoles] = useState<string[]>(['Methodology', 'Software', 'Validation']);
  const [royaltyPct, setRoyaltyPct] = useState('30.0');
  const [bountyDollars, setBountyDollars] = useState('1500');
  const [sandboxPerm, setSandboxPerm] = useState<'compute_only' | 'download_permitted'>('compute_only');
  const [collabGpuCap, setCollabGpuCap] = useState('500');
  const [collabGrantDollars, setCollabGrantDollars] = useState('1000');
  const [savingContract, setSavingContract] = useState(false);

  // Quota guardrail modal state
  const [editingQuotaContract, setEditingQuotaContract] = useState<CollaborationContract | null>(null);
  const [editGpuCap, setEditGpuCap] = useState('500');
  const [editGrantDollars, setEditGrantDollars] = useState('1000');
  const [savingQuota, setSavingQuota] = useState(false);

  // Role action states
  const [roleUpdatingId, setRoleUpdatingId] = useState<string | null>(null);
  const [roleError, setRoleError] = useState<string | null>(null);

  // New task form state
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [savingTask, setSavingTask] = useState(false);

  // Fetch collaboration contracts from PostgreSQL
  const contractsResource = useResource<CollaborationContract[]>(
    () => scopedClient.collaborationContracts({ area: area.id }),
    `contracts-${area.id}`,
  );

  // Fetch collaboration tasks/milestones from PostgreSQL
  const tasksResource = useResource<ResearchTask[]>(
    () => scopedClient.tasks({ area: area.id }),
    `tasks-${area.id}`,
  );

  const contracts = contractsResource.data || [];
  const tasks = tasksResource.data || [];

  const handleRoleToggle = (role: string) => {
    setSelectedRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role],
    );
  };

  const handleUpdateRole = async (contractId: string, newRole: 'owner' | 'editor' | 'viewer') => {
    setRoleError(null);
    setRoleUpdatingId(contractId);
    try {
      await scopedClient.researchUpdate('collaboration-contracts', contractId, { role: newRole });
      contractsResource.reload();
    } catch (err: any) {
      console.error('Failed to update collaborator role', err);
      setRoleError(err?.message || 'Failed to update role. Only the permanent creator can demote co-owners.');
    } finally {
      setRoleUpdatingId(null);
    }
  };

  const handleRemoveCollaborator = async (contractId: string) => {
    if (!confirm('Are you sure you want to remove this collaborator from this air-gapped vault?')) return;
    setRoleError(null);
    setRoleUpdatingId(contractId);
    try {
      await scopedClient.researchDelete('collaboration-contracts', contractId);
      contractsResource.reload();
    } catch (err: any) {
      console.error('Failed to remove collaborator', err);
      setRoleError(err?.message || 'Failed to remove collaborator. Only the permanent creator can remove co-owners.');
    } finally {
      setRoleUpdatingId(null);
    }
  };

  const handleCreateContract = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!collabEmail.trim() || !collabName.trim()) return;

    setSavingContract(true);
    setRoleError(null);
    try {
      await scopedClient.createCollaborationContract({
        area_id: area.id,
        collaborator_email: collabEmail.trim(),
        collaborator_name: collabName.trim(),
        team_name: teamName.trim(),
        collaboration_model: collabModel,
        credit_roles: selectedRoles,
        royalty_percentage: collabModel === 'royalty_split' ? parseFloat(royaltyPct) || 0 : 0,
        bounty_amount_cents: collabModel === 'paid_bounty' ? Math.round(parseFloat(bountyDollars) * 100) : 0,
        bounty_status: collabModel === 'paid_bounty' ? 'escrow_funded' : 'pending',
        data_sandbox_permission: sandboxPerm,
        role: collabRole,
        gpu_credit_cap: parseInt(collabGpuCap) || 500,
        grant_budget_cents: Math.round(parseFloat(collabGrantDollars) * 100),
        status: 'active',
      } as any);
      setIsCreatingContract(false);
      setCollabEmail('');
      setCollabName('');
      setTeamName('');
      setCollabRole('editor');
      contractsResource.reload();
    } catch (err: any) {
      console.error('Failed to create collaboration contract', err);
      setRoleError(err?.message || 'Failed to create collaboration contract');
    } finally {
      setSavingContract(false);
    }
  };

  const handleOpenEditQuota = (c: CollaborationContract) => {
    setEditingQuotaContract(c);
    setEditGpuCap(String((c as any).gpu_credit_cap || 500));
    setEditGrantDollars(String((((c as any).grant_budget_cents || 100000) / 100).toFixed(0)));
  };

  const handleSaveQuota = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingQuotaContract) return;
    setSavingQuota(true);
    try {
      await scopedClient.researchUpdate('collaboration-contracts', editingQuotaContract.id, {
        gpu_credit_cap: parseInt(editGpuCap) || 500,
        grant_budget_cents: Math.round(parseFloat(editGrantDollars) * 100),
      } as any);
      setEditingQuotaContract(null);
      contractsResource.reload();
    } catch (err) {
      console.error('Failed to update quota', err);
    } finally {
      setSavingQuota(false);
    }
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;

    setSavingTask(true);
    try {
      await scopedClient.researchCreate('tasks', {
        area_id: area.id,
        title: newTaskTitle.trim(),
        kind: 'task',
        done: false,
      });
      setNewTaskTitle('');
      tasksResource.reload();
    } catch (err) {
      console.error('Failed to create task', err);
    } finally {
      setSavingTask(false);
    }
  };

  const handleToggleTask = async (task: ResearchTask) => {
    try {
      await scopedClient.researchUpdate('tasks', task.id, {
        done: !task.done,
      });
      tasksResource.reload();
    } catch (err) {
      console.error('Failed to update task', err);
    }
  };

  return (
    <div className="space-y-8">
      {/* Collaboration Hub Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded-control bg-blue-500/10 text-blue-600 dark:text-blue-400">
              <Icon name="team" size={16} />
            </span>
            <h3 className="text-base font-bold text-ink">
              Interdisciplinary Tech Collaboration Hub
            </h3>
          </div>
          <p className="mt-1 text-xs text-muted max-w-2xl">
            Invite AI & Software Engineering teams into this isolated vault without leaking datasets or models outside the area.
            Configure academic CRediT roles, revenue-share royalty splits, and grant bounties.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Scoped Collaborator View Toggle */}
          <button
            type="button"
            onClick={() => setIsScopedCollaborator(!isScopedCollaborator)}
            className={`cursor-pointer rounded-control border px-3 py-1.5 text-xs font-medium transition-all ${
              isScopedCollaborator
                ? 'border-indigo-500 bg-indigo-500/10 text-indigo-700 dark:text-indigo-300'
                : 'border-line bg-card text-muted hover:border-line-strong hover:text-ink'
            }`}
            title="Simulate view for invited tech collaborator with access to this area only"
          >
            {isScopedCollaborator ? 'Scoped Collaborator View (Active)' : 'Preview Collaborator View'}
          </button>

          <Button
            variant="primary"
            size="sm"
            icon="plus"
            onClick={() => setIsCreatingContract(true)}
            className="cursor-pointer"
          >
            Invite Tech Team / New Contract
          </Button>

          {uninstallConfirm ? (
            <div className="flex items-center gap-1.5 bg-rose-500/10 border border-rose-500/30 p-1.5 rounded-control">
              <span className="text-[11px] font-semibold text-rose-600">Uninstall tool?</span>
              <button
                type="button"
                onClick={() => setUninstallConfirm(false)}
                className="rounded border border-line bg-page px-1.5 py-0.5 text-[10px] text-muted cursor-pointer"
              >
                No
              </button>
              <button
                type="button"
                onClick={handleUninstallModule}
                className="rounded bg-rose-600 px-2 py-0.5 text-[10px] font-bold text-white cursor-pointer"
              >
                Yes
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setUninstallConfirm(true)}
              className="rounded-control border border-line bg-card px-3 py-1.5 text-xs text-muted hover:text-rose-600 transition-colors cursor-pointer"
            >
              Uninstall Module
            </button>
          )}
        </div>
      </div>

      {/* FOUNDING CREATOR & ROOT OWNER CARD */}
      <div className="rounded-l2 border border-line bg-card p-4 sm:p-5 shadow-l1 relative overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-control bg-crimson/10 text-crimson font-bold text-sm">
              <Icon name="shield" size={20} />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-bold text-ink">Founding Vault Creator & Permanent Owner</h4>
                <span className="rounded-pill bg-crimson/10 px-2 py-0.5 text-[10px] font-mono font-bold text-crimson border border-crimson/20">
                  ROOT CREATOR (IMMUTABLE)
                </span>
              </div>
              <p className="text-xs text-muted mt-0.5">
                The original creator of this research vault. Ownership is permanently anchored and cannot be removed or demoted by co-owners.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="rounded-pill bg-emerald-500/10 px-2.5 py-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5 border border-emerald-500/20">
              <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Root Governance & Resource Authority
            </span>
          </div>
        </div>
      </div>

      {/* Role Action Error Notice */}
      {roleError && (
        <div className="rounded-control border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-600 dark:text-red-400 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Icon name="alert" size={14} />
            <span>{roleError}</span>
          </div>
          <button type="button" onClick={() => setRoleError(null)} className="cursor-pointer text-muted hover:text-ink">
            <Icon name="close" size={14} />
          </button>
        </div>
      )}

      {/* ========================================================= */}
      {/* 50% / 50% X-AXIS RESPONSIVE GRID SPLIT                    */}
      {/* ========================================================= */}
      <div className="grid grid-cols-12 gap-6 items-start">
        {/* ========================================================= */}
        {/* LEFT 50% (col-span-12 lg:col-span-6): Team, CRediT & Locks */}
        {/* ========================================================= */}
        <div className="col-span-12 lg:col-span-6 space-y-4">
          {/* FOUNDING CREATOR & ROOT OWNER CARD */}
          <div className="rounded-l2 border border-line bg-card p-4 sm:p-5 shadow-l1 relative overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="flex size-10 items-center justify-center rounded-control bg-crimson/10 text-crimson font-bold text-sm">
                  <Icon name="shield" size={20} />
                </span>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-bold text-ink">Founding Vault Creator</h4>
                    <span className="rounded-pill bg-crimson/10 px-2 py-0.5 text-[10px] font-mono font-bold text-crimson border border-crimson/20">
                      ROOT CREATOR (IMMUTABLE)
                    </span>
                  </div>
                  <p className="text-xs text-muted mt-0.5">
                    Ownership permanently anchored to creator. Cannot be removed or demoted by co-owners.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="rounded-pill bg-emerald-500/10 px-2.5 py-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5 border border-emerald-500/20">
                  <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Root Authority
                </span>
              </div>
            </div>
          </div>

          {/* Active Collaboration Contracts List */}
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-line pb-2">
              <h4 className="text-sm font-bold text-ink">Scoped Collaborators & CRediT Roles</h4>
              <span className="text-xs text-muted font-mono">{contracts.length} agreements</span>
            </div>

            {contractsResource.loading ? (
              <Skeleton className="h-44 rounded-l2" />
            ) : contracts.length === 0 ? (
              <div className="rounded-l2 border border-line bg-card p-6 text-center text-xs text-muted">
                No external tech teams currently collaborating in this research vault.
              </div>
            ) : (
              <div className="space-y-3">
                {contracts.map((c) => {
                  const isOwner = c.role === 'owner';
                  const isViewer = c.role === 'viewer';
                  return (
                    <div
                      key={c.id}
                      className="rounded-l2 border border-line bg-card p-4 shadow-xs space-y-3 hover:border-line-strong transition-all duration-150"
                    >
                      <div>
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-1.5">
                              <h5 className="text-sm font-bold text-ink">{c.collaborator_name}</h5>
                              {isOwner && (
                                <span className="rounded-pill bg-amber-500/15 border border-amber-500/30 px-1.5 py-0.2 text-[9px] font-bold text-amber-700 dark:text-amber-300">
                                  👑 CO-OWNER
                                </span>
                              )}
                              {isViewer && (
                                <span className="rounded-pill bg-page border border-line px-1.5 py-0.2 text-[9px] font-semibold text-muted">
                                  VIEWER
                                </span>
                              )}
                              {!isOwner && !isViewer && (
                                <span className="rounded-pill bg-blue-500/10 border border-blue-500/20 px-1.5 py-0.2 text-[9px] font-semibold text-blue-700 dark:text-blue-300">
                                  COLLABORATOR
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-muted font-mono">{c.collaborator_email}</p>
                          </div>
                          <span
                            className={`rounded-pill px-2 py-0.5 text-[10px] font-semibold uppercase ${
                              c.collaboration_model === 'royalty_split'
                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                : c.collaboration_model === 'paid_bounty'
                                ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                                : 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                            }`}
                          >
                            {c.collaboration_model === 'royalty_split'
                              ? `${c.royalty_percentage}% Royalty`
                              : c.collaboration_model === 'paid_bounty'
                              ? `$${(c.bounty_amount_cents / 100).toLocaleString()} Bounty`
                              : 'Academic Co-Author'}
                          </span>
                        </div>

                        {c.team_name && (
                          <div className="mt-1 text-xs text-muted">
                            Affiliation: <span className="font-medium text-ink">{c.team_name}</span>
                          </div>
                        )}

                        {/* CRediT Taxonomy Badges */}
                        <div className="mt-3 space-y-1">
                          <span className="text-[10px] uppercase font-semibold text-muted block">
                            CRediT Roles:
                          </span>
                          <div className="flex flex-wrap gap-1">
                            {c.credit_roles?.map((role) => (
                              <span
                                key={role}
                                className="rounded bg-page px-1.5 py-0.5 text-[10px] font-medium text-ink-secondary border border-line"
                              >
                                {role}
                              </span>
                            ))}
                          </div>
                        </div>

                        {/* Compute & Grant Quota Meter */}
                        <div className="mt-3 pt-2 border-t border-line/60 space-y-1.5">
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="font-semibold text-muted flex items-center gap-1">
                              <Icon name="cpu" size={12} className="text-crimson" />
                              Compute Quota Cap:
                            </span>
                            <span className="font-mono font-bold text-ink">
                              {((c as any).gpu_credits_consumed ?? 120)} / {((c as any).gpu_credit_cap ?? 500)} cr
                            </span>
                          </div>
                          <div className="h-1.5 w-full rounded-full bg-line overflow-hidden">
                            <div
                              className="h-full bg-crimson transition-all"
                              style={{
                                width: `${Math.min(
                                  100,
                                  Math.round(
                                    (((c as any).gpu_credits_consumed ?? 120) /
                                      Math.max((c as any).gpu_credit_cap ?? 500, 1)) *
                                      100,
                                  ),
                                )}%`,
                              }}
                            />
                          </div>
                          <div className="flex items-center justify-between text-[10px] text-muted font-mono">
                            <span>Grant Budget: ${(((c as any).grant_budget_cents ?? 100000) / 100).toLocaleString()}</span>
                            <button
                              type="button"
                              onClick={() => handleOpenEditQuota(c)}
                              className="cursor-pointer text-indigo-600 dark:text-indigo-400 hover:underline font-semibold"
                            >
                              Adjust Quota
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Governance & Role Management Controls */}
                      <div className="pt-2 border-t border-line/60 space-y-2">
                        <div className="flex flex-wrap items-center justify-between gap-1.5">
                          <div className="flex items-center gap-1.5">
                            {isOwner ? (
                              <button
                                type="button"
                                onClick={() => handleUpdateRole(c.id, 'editor')}
                                disabled={roleUpdatingId === c.id}
                                className="cursor-pointer text-[10px] font-semibold text-muted hover:text-ink px-2 py-1 rounded border border-line bg-page hover:bg-card transition-all"
                                title="Demote this co-owner to a standard collaborator"
                              >
                                Demote to Member
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleUpdateRole(c.id, 'owner')}
                                disabled={roleUpdatingId === c.id}
                                className="cursor-pointer text-[10px] font-semibold text-amber-700 dark:text-amber-300 hover:text-amber-800 px-2 py-1 rounded border border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 transition-all flex items-center gap-1"
                                title="Grant Co-Owner privileges to manage this research area"
                              >
                                <span>👑</span>
                                <span>Make Co-Owner</span>
                              </button>
                            )}
                          </div>

                          <button
                            type="button"
                            onClick={() => handleRemoveCollaborator(c.id)}
                            disabled={roleUpdatingId === c.id}
                            className="cursor-pointer text-[10px] font-semibold text-red-600 dark:text-red-400 hover:text-red-700 px-2 py-1 rounded border border-red-500/30 bg-red-500/10 hover:bg-red-500/20 transition-all"
                            title="Remove and kick collaborator out of this vault"
                          >
                            Kick Out
                          </button>
                        </div>

                        {/* Sandbox Permissions & Security */}
                        <div className="flex items-center justify-between text-[11px] text-muted pt-1">
                          <span className="flex items-center gap-1 font-mono text-[10px]">
                            <Icon name="shield" size={12} className="text-teal-500" />
                            {c.data_sandbox_permission === 'compute_only'
                              ? 'In-Platform Compute Only'
                              : 'Download Permitted'}
                          </span>
                          <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-bold text-emerald-600">
                            AIR-GAPPED
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* ========================================================= */}
        {/* RIGHT 50% (col-span-12 lg:col-span-6): Bounty & Milestones */}
        {/* ========================================================= */}
        <div className="col-span-12 lg:col-span-6 space-y-4">
          {/* Tech Collaboration Request & Bounty Callout */}
          <div className="rounded-l2 border border-line bg-card p-5 shadow-l1 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h4 className="text-sm font-bold text-ink">Post Bounty / Invite Tech Team</h4>
                <p className="text-xs text-muted mt-0.5">
                  Engage AI researchers under Voluntary Co-Authorship, Revenue-Share Royalties, or Escrow-Funded Bounties.
                </p>
              </div>
              <Button
                variant="primary"
                size="sm"
                icon="plus"
                onClick={() => setIsCreatingContract(true)}
                className="cursor-pointer"
              >
                + Post Bounty / Agreement
              </Button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 text-[11px]">
              <div className="rounded border border-line bg-page p-2.5 space-y-1">
                <span className="font-bold text-ink block">1. Co-Authorship</span>
                <p className="text-[10px] text-muted">Formal CRediT roles on future publications.</p>
              </div>
              <div className="rounded border border-line bg-page p-2.5 space-y-1">
                <span className="font-bold text-ink block">2. Royalty Split</span>
                <p className="text-[10px] text-muted">Automated % payout from dataset & paper downloads.</p>
              </div>
              <div className="rounded border border-line bg-page p-2.5 space-y-1">
                <span className="font-bold text-ink block">3. Paid Bounty</span>
                <p className="text-[10px] text-muted">Fixed milestone grant held in secure escrow.</p>
              </div>
            </div>
          </div>

          {/* Interdisciplinary Milestone & Deliverables Board */}
          <div className="rounded-l2 border border-line bg-card p-5 shadow-l1 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-3">
              <div>
                <h4 className="text-sm font-bold text-ink">Interdisciplinary Deliverables & Milestones</h4>
                <p className="text-xs text-muted mt-0.5">
                  Coordinate field data preparation, model training milestones, and manuscript figures.
                </p>
              </div>
              <span className="rounded bg-page px-2 py-0.5 text-xs font-mono text-muted border border-line">
                {tasks.filter((t) => t.done).length} / {tasks.length} Completed
              </span>
            </div>

            {/* Add task inline */}
            <form onSubmit={handleCreateTask} className="flex gap-2">
              <input
                type="text"
                required
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
                placeholder="e.g. Clean 5,000 specimen annotations, Train re-ID baseline..."
                className="flex-1 rounded-control border border-line bg-page px-3 py-2 text-xs text-ink"
              />
              <Button variant="primary" size="sm" icon="plus" loading={savingTask} className="cursor-pointer">
                Add Deliverable
              </Button>
            </form>

            {/* Task List */}
            {tasksResource.loading ? (
              <Skeleton className="h-28 rounded-l1" />
            ) : tasks.length === 0 ? (
              <div className="text-center text-xs text-muted py-4">No milestones or deliverables tracked yet.</div>
            ) : (
              <div className="space-y-1.5">
                {tasks.map((t) => (
                  <div
                    key={t.id}
                    onClick={() => handleToggleTask(t)}
                    className="group flex cursor-pointer items-center justify-between rounded-control border border-line/60 bg-page/50 p-2.5 text-xs hover:border-line-strong transition-all"
                  >
                    <div className="flex items-center gap-2.5">
                      <div
                        className={`flex size-4.5 items-center justify-center rounded border transition-colors ${
                          t.done
                            ? 'border-emerald-500 bg-emerald-500 text-white'
                            : 'border-line-strong group-hover:border-ink'
                        }`}
                      >
                        {t.done && <Icon name="check" size={12} />}
                      </div>
                      <span className={`${t.done ? 'line-through text-muted' : 'text-ink font-medium'}`}>{t.title}</span>
                    </div>
                    <span className="text-[10px] font-mono text-muted uppercase">{t.kind}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* MODAL: Collaboration Contract & Invite Builder */}
      {isCreatingContract && (
        <Modal
          open={isCreatingContract}
          onClose={() => setIsCreatingContract(false)}
          title="Create Tech Collaboration Contract"
          size="lg"
        >
          <form onSubmit={handleCreateContract} className="space-y-4 text-xs">
            <div className="rounded-control bg-blue-500/10 p-3 text-xs text-blue-700 dark:text-blue-300">
              <span className="font-semibold">Zero-Trust Sandbox Guarantee:</span> Invited
              collaborators gain access strictly to Research Area <strong>"{area.name}"</strong>.
              They cannot query or see any other research areas or datasets on your account.
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="font-semibold text-ink block mb-1">Collaborator Email *</label>
                <input
                  type="email"
                  required
                  value={collabEmail}
                  onChange={(e) => setCollabEmail(e.target.value)}
                  placeholder="tech-lead@university.edu"
                  className="w-full rounded-control border border-line bg-page px-3 py-2 text-xs text-ink"
                />
              </div>

              <div>
                <label className="font-semibold text-ink block mb-1">Collaborator / Team Name *</label>
                <input
                  type="text"
                  required
                  value={collabName}
                  onChange={(e) => setCollabName(e.target.value)}
                  placeholder="e.g. Oxford DeepVision AI Lab"
                  className="w-full rounded-control border border-line bg-page px-3 py-2 text-xs text-ink"
                />
              </div>
            </div>

            <div>
              <label className="font-semibold text-ink block mb-1">Institution / Org</label>
              <input
                type="text"
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
                placeholder="Department of Engineering Science"
                className="w-full rounded-control border border-line bg-page px-3 py-2 text-xs text-ink"
              />
            </div>

            {/* Vault Membership & Ownership Role */}
            <div className="space-y-2 pt-2 border-t border-line">
              <label className="font-semibold text-ink block">
                Vault Membership & Ownership Role *
              </label>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                <button
                  type="button"
                  onClick={() => setCollabRole('editor')}
                  className={`rounded-control border p-3 text-left transition-all cursor-pointer ${
                    collabRole === 'editor'
                      ? 'border-blue-500 bg-blue-500/10 font-bold text-ink ring-1 ring-blue-500'
                      : 'border-line bg-page text-muted hover:border-line-strong hover:text-ink hover:bg-card/40'
                  }`}
                >
                  <div className="font-semibold text-xs">Collaborator (Editor)</div>
                  <p className="text-[10px] text-muted mt-1">Upload data, run ablations, build models</p>
                </button>

                <button
                  type="button"
                  onClick={() => setCollabRole('owner')}
                  className={`rounded-control border p-3 text-left transition-all cursor-pointer ${
                    collabRole === 'owner'
                      ? 'border-amber-500 bg-amber-500/10 font-bold text-ink ring-1 ring-amber-500'
                      : 'border-line bg-page text-muted hover:border-line-strong hover:text-ink hover:bg-card/40'
                  }`}
                >
                  <div className="font-semibold text-xs flex items-center gap-1 text-amber-700 dark:text-amber-300">
                    <span>👑 Co-Owner</span>
                  </div>
                  <p className="text-[10px] text-muted mt-1">Co-manage area settings & invite members</p>
                </button>

                <button
                  type="button"
                  onClick={() => setCollabRole('viewer')}
                  className={`rounded-control border p-3 text-left transition-all cursor-pointer ${
                    collabRole === 'viewer'
                      ? 'border-crimson bg-crimson/5 font-bold text-ink ring-1 ring-crimson'
                      : 'border-line bg-page text-muted hover:border-line-strong hover:text-ink hover:bg-card/40'
                  }`}
                >
                  <div className="font-semibold text-xs">Viewer (Read-Only)</div>
                  <p className="text-[10px] text-muted mt-1">Inspect papers and published artifacts only</p>
                </button>
              </div>
            </div>

            {/* Compensation & Collaboration Model */}
            <div className="space-y-2 pt-2 border-t border-line">
              <label className="font-semibold text-ink block">
                Collaboration & Compensation Model
              </label>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                <button
                  type="button"
                  onClick={() => setCollabModel('voluntary_credit')}
                  className={`rounded-control border p-3 text-left transition-all cursor-pointer ${
                    collabModel === 'voluntary_credit'
                      ? 'border-blue-500 bg-blue-500/10 font-bold text-ink ring-1 ring-blue-500'
                      : 'border-line bg-page text-muted hover:border-line-strong hover:text-ink hover:bg-card/40'
                  }`}
                >
                  <div className="font-semibold">Voluntary / Academic</div>
                  <p className="text-[10px] text-muted mt-1">Formal CRediT authorship roles</p>
                </button>

                <button
                  type="button"
                  onClick={() => setCollabModel('royalty_split')}
                  className={`rounded-control border p-3 text-left transition-all cursor-pointer ${
                    collabModel === 'royalty_split'
                      ? 'border-emerald-500 bg-emerald-500/10 font-bold text-ink ring-1 ring-emerald-500'
                      : 'border-line bg-page text-muted hover:border-line-strong hover:text-ink hover:bg-card/40'
                  }`}
                >
                  <div className="font-semibold">Revenue-Share Royalty (%)</div>
                  <p className="text-[10px] text-muted mt-1">Split future paper & dataset earnings</p>
                </button>

                <button
                  type="button"
                  onClick={() => setCollabModel('paid_bounty')}
                  className={`rounded-control border p-3 text-left transition-all cursor-pointer ${
                    collabModel === 'paid_bounty'
                      ? 'border-amber-500 bg-amber-500/10 font-bold text-ink ring-1 ring-amber-500'
                      : 'border-line bg-page text-muted hover:border-line-strong hover:text-ink hover:bg-card/40'
                  }`}
                >
                  <div className="font-semibold">Paid Grant Bounty</div>
                  <p className="text-[10px] text-muted mt-1">Fixed milestone bounty (Escrow Ready)</p>
                </button>
              </div>
            </div>

            {/* Model-specific inputs */}
            {collabModel === 'royalty_split' && (
              <div>
                <label className="font-semibold text-ink block mb-1">
                  Collaborator Royalty Share Percentage (%)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="1"
                    max="99"
                    step="0.5"
                    value={royaltyPct}
                    onChange={(e) => setRoyaltyPct(e.target.value)}
                    className="w-32 rounded-control border border-line bg-page px-3 py-1.5 text-xs font-mono font-bold text-ink"
                  />
                  <span className="text-muted text-xs">% of all future area publications</span>
                </div>
              </div>
            )}

            {collabModel === 'paid_bounty' && (
              <div>
                <label className="font-semibold text-ink block mb-1">
                  Grant / Milestone Bounty Amount ($ USD)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="10"
                    step="50"
                    value={bountyDollars}
                    onChange={(e) => setBountyDollars(e.target.value)}
                    className="w-32 rounded-control border border-line bg-page px-3 py-1.5 text-xs font-mono font-bold text-ink"
                  />
                  <span className="text-muted text-xs font-mono">
                    Escrow Ready (Held safely until milestones are accepted)
                  </span>
                </div>
              </div>
            )}

            {/* Formal Academic CRediT Taxonomy Selector */}
            <div className="space-y-1.5 pt-2 border-t border-line">
              <label className="font-semibold text-ink block">
                Assign Formal Academic CRediT Taxonomy Roles:
              </label>
              <div className="flex flex-wrap gap-1.5">
                {CREDIT_ROLES.map((role) => {
                  const isChecked = selectedRoles.includes(role);
                  return (
                    <button
                      key={role}
                      type="button"
                      onClick={() => handleRoleToggle(role)}
                      className={`cursor-pointer rounded-pill px-2.5 py-1 text-[11px] font-medium transition-all ${
                        isChecked
                          ? 'bg-blue-600 text-white shadow-sm ring-1 ring-blue-600'
                          : 'border border-line bg-page text-muted hover:border-line-strong hover:text-ink hover:bg-card/50'
                      }`}
                    >
                      {role}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Granular Data Sandbox Permission */}
            <div className="space-y-1.5 pt-2 border-t border-line">
              <label className="font-semibold text-ink block">
                Granular Data Sandbox Permissions
              </label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer text-muted hover:text-ink">
                  <input
                    type="radio"
                    name="sandboxPerm"
                    checked={sandboxPerm === 'compute_only'}
                    onChange={() => setSandboxPerm('compute_only')}
                    className="accent-crimson cursor-pointer"
                  />
                  <span>In-Platform Compute Only (No Raw Data Download)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-muted hover:text-ink">
                  <input
                    type="radio"
                    name="sandboxPerm"
                    checked={sandboxPerm === 'download_permitted'}
                    onChange={() => setSandboxPerm('download_permitted')}
                    className="accent-crimson cursor-pointer"
                  />
                  <span>Dataset Download Permitted</span>
                </label>
              </div>
            </div>

            {/* Scoped Compute & Grant Quota Guardrails */}
            <div className="space-y-3 pt-2 border-t border-line">
              <label className="font-semibold text-ink block">
                Scoped Compute & Grant Quota Guardrails
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] text-muted block mb-1">Max GPU Compute Cap (Credits)</label>
                  <input
                    type="number"
                    min="10"
                    step="50"
                    value={collabGpuCap}
                    onChange={(e) => setCollabGpuCap(e.target.value)}
                    className="w-full rounded-control border border-line bg-page px-3 py-1.5 text-xs font-mono font-bold text-ink"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-muted block mb-1">Grant Budget Cap ($ USD)</label>
                  <input
                    type="number"
                    min="50"
                    step="100"
                    value={collabGrantDollars}
                    onChange={(e) => setCollabGrantDollars(e.target.value)}
                    className="w-full rounded-control border border-line bg-page px-3 py-1.5 text-xs font-mono font-bold text-ink"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-line">
              <Button variant="secondary" onClick={() => setIsCreatingContract(false)} className="cursor-pointer">
                Cancel
              </Button>
              <Button variant="primary" loading={savingContract} icon="mail" className="cursor-pointer">
                Issue Air-Gapped Collaboration Contract
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* MODAL: Adjust Collaborator Compute & Grant Quota */}
      {editingQuotaContract && (
        <Modal
          open={!!editingQuotaContract}
          onClose={() => setEditingQuotaContract(null)}
          title={`Adjust Compute & Grant Quota: ${editingQuotaContract.collaborator_name}`}
          size="md"
        >
          <form onSubmit={handleSaveQuota} className="space-y-4 text-xs">
            <div className="rounded-control bg-purple-500/10 border border-purple-500/30 p-3 text-purple-800 dark:text-purple-200">
              <span className="font-bold">Area Owner Quota Safeguard:</span> Enforce strict usage limits
              on GPU inference jobs and grant funds to protect your research allocation.
            </div>

            <div>
              <label className="font-semibold text-ink block mb-1">
                GPU Credit Cap (Credits)
              </label>
              <input
                type="number"
                min="0"
                step="50"
                value={editGpuCap}
                onChange={(e) => setEditGpuCap(e.target.value)}
                className="w-full rounded-control border border-line bg-page px-3 py-2 text-xs font-mono font-bold text-ink"
              />
              <span className="text-[11px] text-muted mt-1 block">
                Collaborator will be throttled when reaching this cap.
              </span>
            </div>

            <div>
              <label className="font-semibold text-ink block mb-1">
                Grant Budget Allocation ($ USD)
              </label>
              <input
                type="number"
                min="0"
                step="50"
                value={editGrantDollars}
                onChange={(e) => setEditGrantDollars(e.target.value)}
                className="w-full rounded-control border border-line bg-page px-3 py-2 text-xs font-mono font-bold text-ink"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-line">
              <Button variant="secondary" onClick={() => setEditingQuotaContract(null)}>
                Cancel
              </Button>
              <Button variant="primary" loading={savingQuota}>
                Update Guardrails
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
