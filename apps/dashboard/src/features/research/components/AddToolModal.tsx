import { useState } from 'react';
import { Button, Icon } from '@layerto/ui';
import type { OptionalModuleId, ResearchArea } from '@layerto/types';
import { useAreaVault } from '../ResearchAreaBoundary';

interface ModuleDef {
  id: OptionalModuleId;
  name: string;
  category: string;
  icon: 'sparkles' | 'team' | 'flask';
  badgeColor: string;
  tagline: string;
  description: string;
  features: string[];
}

export const AVAILABLE_MODULES: ModuleDef[] = [
  {
    id: 'gpu_compute',
    name: 'GPU Compute & Model Hub',
    category: 'High-Performance ML & Hardware',
    icon: 'sparkles',
    badgeColor: 'border-purple-500/30 text-purple-600 dark:text-purple-400 bg-purple-500/10',
    tagline: 'Rent on-demand GPU clusters and manage neural model checkpoints.',
    description:
      'Provides dedicated GPU compute leasing (NVIDIA T4, L4, RTX 4090, A100), automated checkpoint versioning, training metrics logging, and model-dataset binding.',
    features: [
      'On-demand GPU hardware leasing (hourly compute pool)',
      'PyTorch / Safetensors model checkpoint registry',
      'Loss, F1, and latency convergence monitoring',
      'Isolated sandbox execution with resource quotas',
    ],
  },
  {
    id: 'tech_collaboration',
    name: 'Tech Collaboration Hub',
    category: 'Interdisciplinary Talent & Contracts',
    icon: 'team',
    badgeColor: 'border-blue-500/30 text-blue-600 dark:text-blue-400 bg-blue-500/10',
    tagline: 'Contract ML engineers and tech co-authors under air-gapped locks.',
    description:
      'Seamlessly invite machine learning engineers and tech teams under formal CRediT taxonomy roles, royalty revenue splits, or fixed-fee bounties with compute-only data locks.',
    features: [
      'Three legal compensation models: Co-Authorship, Royalty %, Paid Bounty',
      'Air-gapped compute_only sandbox lock (zero raw data download)',
      'Collaborator contract governance & credential verification',
      'Granular code-audit and checkpoint handoff tracking',
    ],
  },
  {
    id: 'statistical_charts',
    name: 'Statistical & Chart Builder',
    category: 'Quantitative Analytics & Visualization',
    icon: 'flask',
    badgeColor: 'border-emerald-500/30 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10',
    tagline: 'Generate publication-ready plots directly from observation data.',
    description:
      'Interactive plot designer that dynamically pulls columns from your Structured Observations Table. Render Bar charts, Scatter plots, Histograms, Box plots, and Time-series with live summary statistics.',
    features: [
      'Dynamic X/Y axis binding from custom observation columns',
      'Automatic biostatistical calculations (Mean, Median, Std Dev, Pearson r)',
      '1-Click SVG/PNG export formatted for peer-reviewed manuscripts',
      'Category grouping, confidence intervals, and trendlines',
    ],
  },
];

interface AddToolModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectTab?: (tabId: string) => void;
}

export function AddToolModal({ isOpen, onClose, onSelectTab }: AddToolModalProps) {
  const { area, scopedClient, updateAreaLocally } = useAreaVault();
  const [updatingId, setUpdatingId] = useState<OptionalModuleId | null>(null);
  const [uninstallConfirmId, setUninstallConfirmId] = useState<OptionalModuleId | null>(null);

  if (!isOpen) return null;

  const currentModules: OptionalModuleId[] = Array.isArray(area.enabled_modules)
    ? (area.enabled_modules as OptionalModuleId[])
    : [];

  const handleToggleModule = async (moduleId: OptionalModuleId, install: boolean) => {
    setUpdatingId(moduleId);
    try {
      let nextModules: OptionalModuleId[];
      if (install) {
        nextModules = Array.from(new Set([...currentModules, moduleId]));
      } else {
        nextModules = currentModules.filter((m) => m !== moduleId);
      }

      await scopedClient.updateArea(area.id, {
        enabled_modules: nextModules,
      } as Partial<ResearchArea>);

      updateAreaLocally({ enabled_modules: nextModules });
      setUninstallConfirmId(null);

      // If just installed, offer to switch to the new tool tab
      if (install && onSelectTab) {
        onSelectTab(moduleId);
        onClose();
      }
    } catch (err) {
      console.error('Failed to update area modules', err);
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="relative w-full max-w-3xl overflow-hidden rounded-l3 border border-line bg-card shadow-2xl flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-line px-6 py-4 bg-page/40">
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-control bg-crimson/10 text-crimson">
              <Icon name="sparkles" size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-ink">Modular Tool Catalog</h3>
                <span className="rounded-pill bg-page px-2 py-0.5 text-[10px] font-mono font-bold text-muted border border-line">
                  {currentModules.length} of {AVAILABLE_MODULES.length} Installed
                </span>
              </div>
              <p className="text-xs text-muted">
                Plug in optional computational, collaboration, or statistical tools into this isolated Research Area on demand.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-control p-1.5 text-muted hover:bg-page hover:text-ink transition-colors cursor-pointer"
          >
            <Icon name="close" size={16} />
          </button>
        </div>

        {/* Catalog Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {AVAILABLE_MODULES.map((mod) => {
            const isInstalled = currentModules.includes(mod.id);
            const isBusy = updatingId === mod.id;
            const isConfirmingUninstall = uninstallConfirmId === mod.id;

            return (
              <div
                key={mod.id}
                className={`group relative overflow-hidden rounded-l2 border p-5 transition-all ${
                  isInstalled
                    ? 'border-indigo-500/40 bg-indigo-500/[0.02] shadow-xs'
                    : 'border-line bg-card hover:border-line-strong'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                  {/* Left info */}
                  <div className="space-y-2 max-w-xl">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="flex size-7 items-center justify-center rounded-control bg-page border border-line text-ink">
                        <Icon name={mod.icon} size={15} />
                      </div>
                      <h4 className="text-sm font-bold text-ink">{mod.name}</h4>
                      <span className={`rounded-pill border px-2 py-0.5 text-[10px] font-semibold ${mod.badgeColor}`}>
                        {mod.category}
                      </span>
                      {isInstalled && (
                        <span className="inline-flex items-center gap-1 rounded-pill bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                          <Icon name="check" size={10} /> Active
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-ink/90 font-medium">{mod.tagline}</p>
                    <p className="text-xs text-muted leading-relaxed">{mod.description}</p>

                    {/* Features list */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-2">
                      {mod.features.map((feat, idx) => (
                        <div key={idx} className="flex items-center gap-1.5 text-[11px] text-muted">
                          <span className="text-crimson font-bold">✓</span>
                          <span>{feat}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Right Action Button */}
                  <div className="shrink-0 flex flex-col items-end justify-start pt-1">
                    {isConfirmingUninstall ? (
                      <div className="flex flex-col items-end gap-2 bg-rose-500/10 border border-rose-500/30 p-2.5 rounded-l2">
                        <span className="text-[11px] font-semibold text-rose-600 dark:text-rose-400">
                          Confirm uninstalling?
                        </span>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setUninstallConfirmId(null)}
                            className="rounded-control border border-line bg-page px-2 py-1 text-[11px] font-semibold text-muted hover:text-ink cursor-pointer"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => handleToggleModule(mod.id, false)}
                            className="rounded-control bg-rose-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-rose-700 cursor-pointer"
                          >
                            {isBusy ? 'Removing...' : 'Confirm'}
                          </button>
                        </div>
                      </div>
                    ) : isInstalled ? (
                      <div className="flex items-center gap-2">
                        {onSelectTab && (
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => {
                              onSelectTab(mod.id);
                              onClose();
                            }}
                            className="cursor-pointer text-xs"
                          >
                            Open Tab
                          </Button>
                        )}
                        <button
                          type="button"
                          onClick={() => setUninstallConfirmId(mod.id)}
                          className="rounded-control border border-line bg-page px-3 py-1.5 text-xs font-semibold text-muted hover:text-rose-600 hover:border-rose-300 dark:hover:border-rose-800 transition-colors cursor-pointer"
                        >
                          Uninstall
                        </button>
                      </div>
                    ) : (
                      <Button
                        variant="primary"
                        size="sm"
                        loading={isBusy}
                        icon="plus"
                        onClick={() => handleToggleModule(mod.id, true)}
                        className="cursor-pointer text-xs"
                      >
                        Install Module
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between border-t border-line px-6 py-3.5 bg-page/60 text-xs text-muted">
          <span>Non-installed tools remain completely hidden, keeping the workspace clutter-free.</span>
          <Button variant="secondary" size="sm" onClick={onClose} className="cursor-pointer">
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
