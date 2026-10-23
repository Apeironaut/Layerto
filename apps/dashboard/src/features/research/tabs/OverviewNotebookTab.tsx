import { Button, Icon, useResource } from '@layerto/ui';
import { useAreaVault } from '../ResearchAreaBoundary';
import { ResearchAreaPulse } from '../components/ResearchAreaPulse';
import { MethodologyPipeline } from '../components/MethodologyPipeline';
import { LabNotebookScratchpad } from '../components/LabNotebookScratchpad';
import type { DomainInsight } from '@layerto/types';

export function OverviewNotebookTab() {
  const { area, scopedClient, reloadArea } = useAreaVault();

  // Load domain insight widgets pushed by the Tech Team
  const insightsResource = useResource<DomainInsight[]>(
    () => scopedClient.domainInsights({ area: area.id }),
    `domain-insights-${area.id}`,
  );

  const handleToggleLock = async () => {
    try {
      await scopedClient.updateArea(area.id, {
        reproducibility_lock: !area.reproducibility_lock,
      } as any);
      await reloadArea();
    } catch (err) {
      console.error('Failed to toggle reproducibility lock', err);
    }
  };

  const insights = insightsResource.data || [];

  return (
    <div className="space-y-6">
      {/* Reproducibility Lock & Air-Gapped Status Banner */}
      <div
        className={`flex flex-wrap items-center justify-between gap-4 rounded-l2 border p-4 transition-all ${
          area.reproducibility_lock
            ? 'border-indigo-500/40 bg-indigo-500/5 dark:border-indigo-500/20 dark:bg-indigo-500/10'
            : 'border-line bg-card'
        }`}
      >
        <div className="flex items-center gap-3">
          <div
            className={`flex size-9 items-center justify-center rounded-control ${
              area.reproducibility_lock
                ? 'bg-indigo-500/20 text-indigo-600 dark:text-indigo-400'
                : 'bg-page text-muted'
            }`}
          >
            <Icon name={area.reproducibility_lock ? 'lock' : 'shield'} size={18} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-ink">
                Zero-Trust Air-Gapped Vault:{' '}
                <span className="font-mono text-xs text-muted">ID-{area.id.slice(0, 8)}</span>
              </h3>
              <span className="rounded-pill bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                Active Isolation
              </span>
            </div>
            <p className="text-xs text-muted mt-0.5">
              {area.reproducibility_lock
                ? 'Reproducibility Lock ENABLED: Datasets, checkpoints, and model weights in this area are cryptographically sealed for academic peer review.'
                : 'Standard Workspace: Code, notebooks, and models are editable by area collaborators.'}
            </p>
          </div>
        </div>

        <Button
          variant={area.reproducibility_lock ? 'secondary' : 'primary'}
          size="sm"
          icon={area.reproducibility_lock ? 'lock' : 'shield'}
          onClick={handleToggleLock}
          className="cursor-pointer"
        >
          {area.reproducibility_lock ? 'Unlock Area' : 'Engage Reproducibility Lock'}
        </Button>
      </div>

      {/* 50% / 50% X-AXIS SPLIT (12-Column Responsive Grid) */}
      <div className="grid grid-cols-12 gap-6 items-start">
        {/* Left Half (50% on desktop: col-span-12 lg:col-span-6) -> Pulse & Methodology Pipeline */}
        <div className="col-span-12 lg:col-span-6 space-y-6">
          <ResearchAreaPulse
            area={area}
            scopedClient={scopedClient}
            onReload={reloadArea}
          />

          {/* Scientific Methodology Pipeline */}
          <MethodologyPipeline />

          {/* Domain Insight Widgets Bridge */}
          {insights.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="flex size-6 items-center justify-center rounded-control bg-blue-500/10 text-blue-600 dark:text-blue-400">
                    <Icon name="sparkles" size={14} />
                  </span>
                  <h3 className="text-sm font-bold text-ink">
                    Verified Insights & Bridge Feed
                  </h3>
                </div>
                <span className="text-[11px] text-muted">
                  Tech team findings published to Domain Lead
                </span>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {insights.map((ins) => (
                  <div
                    key={ins.id}
                    className="rounded-l2 border border-line bg-card p-4 shadow-l1 space-y-2 hover:border-line-strong transition-all"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-ink flex items-center gap-1.5">
                        <Icon name="sparkles" size={13} className="text-blue-500" />
                        {ins.title}
                      </span>
                      <span className="rounded-pill bg-blue-100 px-2 py-0.5 text-[10px] font-semibold text-blue-800 dark:bg-blue-950 dark:text-blue-300">
                        {ins.insight_type.replace(/_/g, ' ')}
                      </span>
                    </div>
                    <p className="text-xs text-ink-secondary leading-relaxed line-clamp-3">{ins.content}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Half (50% on desktop: col-span-12 lg:col-span-6) -> Lab Notebook & Field Scratchpad */}
        <div className="col-span-12 lg:col-span-6">
          <LabNotebookScratchpad
            areaId={area.id}
            areaName={area.name}
            scopedClient={scopedClient}
          />
        </div>
      </div>
    </div>
  );
}
