import { useState } from 'react';
import { Icon } from '@layerto/ui';
import { useAreaVault } from './ResearchAreaBoundary';
import { useHub } from '../../hub/HubContext';
import { OverviewNotebookTab } from './tabs/OverviewNotebookTab';
import { DataSpecimenVaultTab } from './tabs/DataSpecimenVaultTab';
import { ExperimentsArenaTab } from './tabs/ExperimentsArenaTab';
import { TechCollaborationTab } from './tabs/TechCollaborationTab';
import { PublicationsMonetizationTab } from './tabs/PublicationsMonetizationTab';
import { AreaVaultSettingsTab } from './tabs/AreaVaultSettingsTab';

const WORKSPACE_TABS = [
  { id: 'overview', label: 'Overview & Lab Notebook', icon: 'overview' },
  { id: 'specimens', label: 'Data & Specimen Vault', icon: 'camera' },
  { id: 'experiments', label: 'Experiments & Visual Arena', icon: 'flask' },
  { id: 'collaboration', label: 'Tech Collaboration Hub', icon: 'team' },
  { id: 'publications', label: 'Publications & Monetization', icon: 'coins' },
  { id: 'settings', label: 'Area Vault Settings', icon: 'settings' },
] as const;

type WorkspaceTabId = (typeof WORKSPACE_TABS)[number]['id'];

interface AreaWorkspaceProps {
  initialTab?: string;
}

export function AreaWorkspace({ initialTab }: AreaWorkspaceProps) {
  const { area, viewMode, setViewMode, isScopedCollaborator } = useAreaVault();
  const { navigate } = useHub();

  const [activeTab, setActiveTab] = useState<WorkspaceTabId>(() => {
    const valid = WORKSPACE_TABS.some((t) => t.id === initialTab);
    return valid ? (initialTab as WorkspaceTabId) : 'overview';
  });

  const handleBackToDashboard = () => {
    navigate('/research');
  };

  const handleTabChange = (tabId: WorkspaceTabId) => {
    setActiveTab(tabId);
    navigate(`/research/area/${area.id}/${tabId}`);
  };

  const disciplineTitle =
    area.discipline === 'zoology'
      ? 'Zoology & Wildlife Conservation'
      : area.discipline === 'ecology'
      ? 'Ecology & Field Science'
      : area.discipline === 'cv_ai'
      ? 'Computer Vision & AI'
      : area.discipline === 'biomedical'
      ? 'Biomedical & Pathology'
      : 'Interdisciplinary Studio';

  return (
    <div className="space-y-6 w-full">
      {/* Level 2 Scoped Vault Header */}
      <div className="relative overflow-hidden rounded-l3 border border-line bg-card p-5 sm:p-7 shadow-l1">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-20 -top-20 size-80 rounded-full blur-3xl opacity-20"
          style={{ background: area.color || 'var(--color-crimson)' }}
        />

        <div className="relative space-y-4">
          {/* Top navigation row */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* If scoped collaborator view is active, hide back button to isolate view */}
            {!isScopedCollaborator ? (
              <button
                type="button"
                onClick={handleBackToDashboard}
                className="group inline-flex items-center gap-2 rounded-control border border-line bg-page px-3 py-1.5 text-xs font-semibold text-muted hover:border-line-strong hover:text-ink hover:bg-card transition-all cursor-pointer"
              >
                <Icon name="arrowLeft" size={14} className="group-hover:-translate-x-0.5 transition-transform" />
                <span>Research Dashboard</span>
              </button>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-pill bg-indigo-500/10 px-3 py-1 text-xs font-semibold text-indigo-700 dark:text-indigo-300">
                <Icon name="shield" size={13} />
                Scoped Collaborator Mode: Area ID {area.id.slice(0, 8)}
              </span>
            )}

            {/* Adaptive View Mode Switcher */}
            <div className="inline-flex rounded-control border border-line bg-page p-1 text-xs font-semibold shadow-inner">
              <button
                type="button"
                onClick={() => setViewMode('domain')}
                className={`rounded-control px-3 py-1.5 transition-all flex items-center gap-1.5 cursor-pointer ${
                  viewMode === 'domain'
                    ? 'bg-card text-ink shadow-sm font-bold ring-1 ring-line'
                    : 'text-muted hover:text-ink hover:bg-card/50'
                }`}
              >
                <span>🌿</span>
                <span>Domain View</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('tech')}
                className={`rounded-control px-3 py-1.5 transition-all flex items-center gap-1.5 cursor-pointer ${
                  viewMode === 'tech'
                    ? 'bg-card text-ink shadow-sm font-bold ring-1 ring-line'
                    : 'text-muted hover:text-ink hover:bg-card/50'
                }`}
              >
                <span>⚡</span>
                <span>Tech Workbench</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('unified')}
                className={`rounded-control px-3 py-1.5 transition-all flex items-center gap-1.5 cursor-pointer ${
                  viewMode === 'unified'
                    ? 'bg-card text-ink shadow-sm font-bold ring-1 ring-line'
                    : 'text-muted hover:text-ink hover:bg-card/50'
                }`}
              >
                <span>Unified</span>
              </button>
            </div>
          </div>

          {/* Area Meta Info */}
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className="size-3 rounded-full shrink-0"
                  style={{ background: area.color || 'var(--color-crimson)' }}
                />
                <span className="rounded-pill bg-page px-2 py-0.5 text-[11px] font-semibold text-muted border border-line">
                  {disciplineTitle}
                </span>
                <span className="rounded-pill bg-emerald-500/10 px-2 py-0.5 text-[10px] font-mono font-bold text-emerald-600 dark:text-emerald-400">
                  AIR-GAPPED VAULT
                </span>
              </div>
              <h1 className="mt-2 text-2xl sm:text-3xl font-extrabold tracking-tight text-ink">
                {area.name}
              </h1>
              <p className="mt-1 max-w-3xl text-xs sm:text-sm text-muted leading-relaxed">
                {area.description || 'Dedicated zero-trust research workspace.'}
              </p>
            </div>

            <div className="flex items-center gap-3 text-xs font-mono text-muted">
              <div className="text-right">
                <span className="block text-[10px] uppercase text-muted">Storage Quota</span>
                <span className="font-bold text-ink">
                  {(area.storage_bytes_used / (1024 * 1024 * 1024)).toFixed(1)}{' '}
                  {area.storage_quota_bytes > 0
                    ? `/ ${(area.storage_quota_bytes / (1024 * 1024 * 1024)).toFixed(0)} GB`
                    : 'GB (Free Pool)'}
                </span>
              </div>
              <div className="h-6 w-px bg-line" />
              <div className="text-right">
                <span className="block text-[10px] uppercase text-muted">GPU Credits</span>
                <span className="font-bold text-ink">
                  {(area.gpu_credits_used ?? Math.round((area.gpu_seconds_used || 0) / 36)).toLocaleString()}{' '}
                  {area.gpu_credits_budget > 0
                    ? `/ ${area.gpu_credits_budget.toLocaleString()} cr`
                    : 'cr (Free Pool)'}
                </span>
              </div>
            </div>
          </div>

          {/* 6 Tab Switcher Bar */}
          <div className="flex gap-2 overflow-x-auto pt-2 border-t border-line/60">
            {WORKSPACE_TABS.map((t) => {
              const isActive = activeTab === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => handleTabChange(t.id)}
                  className={`flex shrink-0 items-center gap-2 rounded-control px-3.5 py-2 text-xs font-semibold cursor-pointer transition-all duration-150 ${
                    isActive
                      ? 'bg-crimson text-white shadow-sm ring-1 ring-crimson'
                      : 'bg-page text-muted hover:bg-card hover:text-ink hover:border-line-strong border border-line/60'
                  }`}
                >
                  <Icon name={t.icon as any} size={14} />
                  <span>{t.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Active Tab Panel */}
      <div className="min-h-[450px]">
        {activeTab === 'overview' && <OverviewNotebookTab />}
        {activeTab === 'specimens' && <DataSpecimenVaultTab />}
        {activeTab === 'experiments' && <ExperimentsArenaTab />}
        {activeTab === 'collaboration' && <TechCollaborationTab />}
        {activeTab === 'publications' && <PublicationsMonetizationTab />}
        {activeTab === 'settings' && <AreaVaultSettingsTab />}
      </div>
    </div>
  );
}
