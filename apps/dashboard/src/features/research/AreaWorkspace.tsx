import { useEffect, useState, useMemo } from 'react';
import { Button, Icon } from '@layerto/ui';
import type { OptionalModuleId } from '@layerto/types';
import { useAreaVault } from './ResearchAreaBoundary';
import { useHub } from '../../hub/HubContext';
import { OverviewNotebookTab } from './tabs/OverviewNotebookTab';
import { LiteratureVaultTab } from './tabs/LiteratureVaultTab';
import { ObservationsDatasetsTab } from './tabs/ObservationsDatasetsTab';
import { PaperWriterPublishingTab } from './tabs/PaperWriterPublishingTab';
import { GpuModelHubTab } from './tabs/GpuModelHubTab';
import { TechCollaborationTab } from './tabs/TechCollaborationTab';
import { StatisticalChartBuilderTab } from './tabs/StatisticalChartBuilderTab';
import { AreaVaultSettingsTab } from './tabs/AreaVaultSettingsTab';
import { AddToolModal } from './components/AddToolModal';
import { getDisciplineMeta } from './templates';

export interface TabDef {
  id: string;
  label: string;
  icon: 'overview' | 'book' | 'camera' | 'pen' | 'sparkles' | 'team' | 'flask' | 'settings';
  isModule?: boolean;
}

export const CORE_WORKSPACE_TABS: TabDef[] = [
  { id: 'overview', label: 'Methodology & Lab Notebook', icon: 'overview' },
  { id: 'literature', label: 'Reference Papers & Literature', icon: 'book' },
  { id: 'observations', label: 'Observations & Datasets', icon: 'camera' },
  { id: 'writer', label: 'AI Paper Co-Pilot & Publishing', icon: 'pen' },
];

interface AreaWorkspaceProps {
  initialTab?: string;
}

export function AreaWorkspace({ initialTab }: AreaWorkspaceProps) {
  const { area, viewMode, setViewMode, isScopedCollaborator } = useAreaVault();
  const { navigate } = useHub();
  const [isAddToolModalOpen, setIsAddToolModalOpen] = useState(false);

  // Compute enabled optional modules
  const enabledModules: OptionalModuleId[] = useMemo(() => {
    return Array.isArray(area.enabled_modules) ? (area.enabled_modules as OptionalModuleId[]) : [];
  }, [area.enabled_modules]);

  // Combine Core tabs + Installed Module tabs + Settings tab
  const visibleTabs = useMemo<TabDef[]>(() => {
    const list: TabDef[] = [...CORE_WORKSPACE_TABS];

    if (enabledModules.includes('gpu_compute')) {
      list.push({ id: 'gpu_compute', label: 'GPU Compute & Models', icon: 'sparkles', isModule: true });
    }
    if (enabledModules.includes('tech_collaboration')) {
      list.push({ id: 'tech_collaboration', label: 'Tech Collaboration', icon: 'team', isModule: true });
    }
    if (enabledModules.includes('statistical_charts')) {
      list.push({ id: 'statistical_charts', label: 'Statistical Charts', icon: 'flask', isModule: true });
    }

    list.push({ id: 'settings', label: 'Vault Settings', icon: 'settings' });
    return list;
  }, [enabledModules]);

  // Map legacy / alias tab IDs
  const resolveTabId = (tabKey?: string): string => {
    if (!tabKey) return 'overview';
    if (tabKey === 'specimens') return 'observations';
    if (tabKey === 'publications') return 'writer';
    if (tabKey === 'collaboration') return 'tech_collaboration';
    if (tabKey === 'experiments') return enabledModules.includes('gpu_compute') ? 'gpu_compute' : 'overview';
    return tabKey;
  };

  const [activeTab, setActiveTab] = useState<string>(() => {
    const resolved = resolveTabId(initialTab);
    return visibleTabs.some((t) => t.id === resolved) ? resolved : 'overview';
  });

  useEffect(() => {
    if (initialTab) {
      const resolved = resolveTabId(initialTab);
      if (visibleTabs.some((t) => t.id === resolved)) {
        setActiveTab(resolved);
      }
    }
  }, [initialTab, visibleTabs]);

  const handleBackToDashboard = () => {
    navigate('/research');
  };

  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId);
    navigate(`/research/area/${area.id}/${tabId}`);
  };

  const meta = getDisciplineMeta(area.discipline);
  const disciplineTitle = meta.label;
  const domainLabel =
    meta.category === 'Medical & Clinical Research'
      ? '🩺 Clinical View'
      : meta.category === 'Language, Humanities & Social Sciences'
      ? '📜 Linguistic View'
      : meta.category === 'Physical Sciences & Engineering'
      ? '🔭 Lab View'
      : '🌿 Domain View';

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
            {!isScopedCollaborator ? (
              <button
                type="button"
                onClick={handleBackToDashboard}
                className="group inline-flex items-center gap-2 rounded-control border border-line bg-page px-3 py-1.5 text-xs font-semibold text-muted hover:border-line-strong hover:text-ink hover:bg-card transition-all cursor-pointer"
              >
                <Icon name="arrowLeft" size={14} className="group-hover:-translate-x-0.5 transition-transform" />
                <span>Research Areas Dashboard</span>
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
                <span>{domainLabel}</span>
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
                {enabledModules.length > 0 && (
                  <span className="rounded-pill bg-purple-500/10 px-2 py-0.5 text-[10px] font-mono font-bold text-purple-600 dark:text-purple-400 border border-purple-500/20">
                    {enabledModules.length} Modular Tool{enabledModules.length > 1 ? 's' : ''} Active
                  </span>
                )}
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

          {/* Tab Switcher Bar + Add Tool Button */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-line/60">
            {/* Tabs List */}
            <div className="flex gap-2 overflow-x-auto py-1">
              {visibleTabs.map((t) => {
                const isActive = activeTab === t.id;
                return (
                  <button
                    key={t.id}
                    data-testid={`workspace-tab-${t.id}`}
                    type="button"
                    onClick={() => handleTabChange(t.id)}
                    className={`flex shrink-0 items-center gap-2 rounded-control px-3.5 py-2 text-xs font-semibold cursor-pointer transition-all duration-150 ${
                      isActive
                        ? 'bg-crimson text-white shadow-sm ring-1 ring-crimson'
                        : t.isModule
                        ? 'bg-purple-500/5 text-purple-700 dark:text-purple-300 hover:bg-purple-500/10 border border-purple-500/30'
                        : 'bg-page text-muted hover:bg-card hover:text-ink hover:border-line-strong border border-line/60'
                    }`}
                  >
                    <Icon name={t.icon as any} size={14} />
                    <span>{t.label}</span>
                    {t.isModule && (
                      <span className="rounded bg-purple-500/20 px-1 py-0.2 text-[9px] font-mono font-bold text-purple-800 dark:text-purple-200">
                        TOOL
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Modular Tool Catalog Button */}
            <div className="flex items-center gap-2 shrink-0">
              <Button
                variant="secondary"
                size="sm"
                icon="plus"
                onClick={() => setIsAddToolModalOpen(true)}
                className="cursor-pointer text-xs font-semibold border-purple-500/40 text-purple-700 dark:text-purple-300 hover:bg-purple-500/10"
              >
                + Add Tool / Module
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Active Tab Panel */}
      <div className="min-h-[450px]">
        {activeTab === 'overview' && <OverviewNotebookTab />}
        {activeTab === 'literature' && <LiteratureVaultTab />}
        {activeTab === 'observations' && <ObservationsDatasetsTab />}
        {activeTab === 'writer' && <PaperWriterPublishingTab />}
        {activeTab === 'gpu_compute' && <GpuModelHubTab />}
        {activeTab === 'tech_collaboration' && <TechCollaborationTab />}
        {activeTab === 'statistical_charts' && <StatisticalChartBuilderTab />}
        {activeTab === 'settings' && <AreaVaultSettingsTab />}
      </div>

      {/* Modal Tool Catalog */}
      <AddToolModal
        isOpen={isAddToolModalOpen}
        onClose={() => setIsAddToolModalOpen(false)}
        onSelectTab={(tabId) => handleTabChange(tabId)}
      />
    </div>
  );
}
