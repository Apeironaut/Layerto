import { useState, useEffect } from 'react';
import { Button, Icon } from '@layerto/ui';
import { getDisciplineMeta } from '../templates';
import { EthicsPermitVaultDrawer } from './EthicsPermitVaultDrawer';
import type { LayertoClient } from '@layerto/api-client';
import type { ResearchArea, ResearchMilestone } from '@layerto/types';

interface ResearchAreaPulseProps {
  area: ResearchArea;
  scopedClient: LayertoClient;
  onReload: () => Promise<void>;
}

const DEFAULT_MILESTONES: ResearchMilestone[] = [
  {
    id: 'm1',
    label: 'Protocol Registration & Ethics IRB Approval',
    category: 'Ethics & Compliance',
    completed: true,
    completed_at: '2026-10-21',
  },
  {
    id: 'm2',
    label: 'Data Acquisition & Split Leakage Integrity Audit',
    category: 'Data Engineering',
    completed: true,
    completed_at: '2026-10-22',
  },
  {
    id: 'm3',
    label: 'Baseline Neural Architecture Benchmark Training',
    category: 'Model Benchmarking',
    completed: false,
  },
  {
    id: 'm4',
    label: 'Human-in-the-Loop Domain Expert Verification Queue',
    category: 'Active Validation',
    completed: false,
  },
  {
    id: 'm5',
    label: 'Cryptographic Checkpoint Sealing & Peer-Review Publication',
    category: 'Reproducibility',
    completed: false,
  },
];

export function ResearchAreaPulse({ area, scopedClient, onReload }: ResearchAreaPulseProps) {
  const meta = getDisciplineMeta(area.discipline);
  const [editingHypothesis, setEditingHypothesis] = useState(false);
  const [hypothesisText, setHypothesisText] = useState(area.hypothesis || '');
  const [savingHypothesis, setSavingHypothesis] = useState(false);
  const [permitDrawerOpen, setPermitDrawerOpen] = useState(false);

  // Milestone checklist state stored per research area
  const [milestones, setMilestones] = useState<ResearchMilestone[]>(() => {
    try {
      const saved = localStorage.getItem(`layerto_milestones_${area.id}`);
      if (saved) return JSON.parse(saved);
    } catch {
      // fallback
    }
    return DEFAULT_MILESTONES;
  });

  useEffect(() => {
    setHypothesisText(area.hypothesis || '');
  }, [area.hypothesis]);

  const toggleMilestone = (id: string) => {
    setMilestones((prev) => {
      const updated = prev.map((m) =>
        m.id === id
          ? {
              ...m,
              completed: !m.completed,
              completed_at: !m.completed ? new Date().toISOString().slice(0, 10) : undefined,
            }
          : m,
      );
      try {
        localStorage.setItem(`layerto_milestones_${area.id}`, JSON.stringify(updated));
      } catch {
        // ignore
      }
      return updated;
    });
  };

  const completedCount = milestones.filter((m) => m.completed).length;
  const progressPct = Math.round((completedCount / milestones.length) * 100);

  const handleSaveHypothesis = async () => {
    setSavingHypothesis(true);
    try {
      await scopedClient.updateArea(area.id, {
        hypothesis: hypothesisText,
      } as any);
      await onReload();
      setEditingHypothesis(false);
    } catch (err) {
      console.error('Failed to update hypothesis', err);
    } finally {
      setSavingHypothesis(false);
    }
  };

  const shieldType = area.privacy_shield_config?.shield_type || meta.defaultPrivacyShield.shield_type;
  const shieldLabel =
    shieldType === 'hipaa_dicom'
      ? 'HIPAA Safe Harbor De-ID Active'
      : shieldType === 'nlp_pii'
      ? 'Informant PII Redaction Active'
      : shieldType === 'nda_watermark'
      ? 'Forensic Watermarking & NDA Active'
      : '±10km Conservation Geo-Blur Active';

  return (
    <div className="space-y-6">
      {/* 1. RESEARCH HYPOTHESIS & OBJECTIVE CARD */}
      <div className="rounded-l2 border border-line bg-card p-5 shadow-l1 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded-control bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <Icon name="sparkles" size={15} />
            </span>
            <div>
              <h3 className="text-sm font-bold text-ink">Research Hypothesis & Core Objective</h3>
              <p className="text-[11px] text-muted">Primary scientific proposition tested in this isolated vault</p>
            </div>
          </div>
          {!editingHypothesis && (
            <Button
              variant="ghost"
              size="sm"
              icon="pen"
              onClick={() => setEditingHypothesis(true)}
              className="cursor-pointer text-xs"
            >
              Edit
            </Button>
          )}
        </div>

        {editingHypothesis ? (
          <div className="space-y-3 pt-1">
            <textarea
              rows={3}
              value={hypothesisText}
              onChange={(e) => setHypothesisText(e.target.value)}
              className="w-full rounded-control border border-line bg-page p-3 text-xs text-ink focus:outline-none focus:ring-2 focus:ring-focus leading-relaxed"
              placeholder="State the primary scientific or technical hypothesis tested in this area..."
            />
            <div className="flex justify-end gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setEditingHypothesis(false)}
                className="cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                loading={savingHypothesis}
                onClick={handleSaveHypothesis}
                className="cursor-pointer"
              >
                Save Hypothesis
              </Button>
            </div>
          </div>
        ) : (
          <div className="rounded-control border border-line/60 bg-page/60 p-3.5 space-y-2">
            <p className="text-xs text-ink leading-relaxed italic">
              &quot;{area.hypothesis || 'No explicit hypothesis recorded yet. Click edit to define the core hypothesis for this research area.'}&quot;
            </p>
            {area.custom_metrics && area.custom_metrics.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-line/50">
                <span className="text-[10px] uppercase font-semibold text-muted">Target Metrics:</span>
                {area.custom_metrics.map((cm) => (
                  <span
                    key={cm.key}
                    className="rounded-pill bg-card px-2 py-0.5 text-[10px] font-mono border border-line text-ink flex items-center gap-1"
                  >
                    <span>{cm.label}</span>
                    <span className="text-muted">({cm.unit})</span>
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 3. DOMAIN & PRIVACY SHIELD STATUS BADGE */}
      <div className="rounded-l2 border border-line bg-card p-4 shadow-l1 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-control bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <Icon name="shield" size={18} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-ink">{shieldLabel}</span>
              <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-mono font-bold text-emerald-700 dark:text-emerald-300">
                ACTIVE
              </span>
            </div>
            <p className="text-[11px] text-muted mt-0.5">
              Zero-Trust Air-Gapped Vault • {meta.label} Domain
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setPermitDrawerOpen(true)}
          className="cursor-pointer inline-flex items-center gap-1.5 rounded-control border border-teal-500/30 bg-teal-500/10 px-2.5 py-1.5 text-xs font-semibold text-teal-700 dark:text-teal-300 hover:bg-teal-500/20 transition-all shadow-xs"
        >
          <span>📜</span>
          <span>{meta.complianceVaultTitle || 'Ethics & Permit Vault'}</span>
        </button>
      </div>

      {/* 4. INTERDISCIPLINARY MILESTONE CHECKLIST */}
      <div className="rounded-l2 border border-line bg-card p-5 shadow-l1 space-y-3.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded-control bg-blue-500/10 text-blue-600 dark:text-blue-400">
              <Icon name="check" size={15} />
            </span>
            <div>
              <h3 className="text-sm font-bold text-ink">Interdisciplinary Milestone Checklist</h3>
              <p className="text-[11px] text-muted">
                {completedCount} of {milestones.length} Research Stage Gates Completed ({progressPct}%)
              </p>
            </div>
          </div>
          <span className="font-mono text-xs font-bold text-blue-600 dark:text-blue-400">
            {progressPct}%
          </span>
        </div>

        {/* Progress bar */}
        <div className="h-1.5 w-full bg-line rounded-full overflow-hidden">
          <div
            className="h-full bg-blue-600 dark:bg-blue-500 transition-all duration-300 rounded-full"
            style={{ width: `${progressPct}%` }}
          />
        </div>

        {/* Checklist items */}
        <div className="space-y-2 pt-1">
          {milestones.map((m) => (
            <div
              key={m.id}
              onClick={() => toggleMilestone(m.id)}
              className={`flex items-start gap-3 p-2.5 rounded-control border transition-all cursor-pointer ${
                m.completed
                  ? 'border-emerald-500/30 bg-emerald-500/5 text-ink'
                  : 'border-line/70 bg-page/40 hover:border-line hover:bg-page text-muted'
              }`}
            >
              <input
                type="checkbox"
                checked={m.completed}
                onChange={() => {}}
                className="mt-0.5 size-4 rounded border-line text-emerald-600 focus:ring-emerald-500 cursor-pointer"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={`text-xs font-semibold ${
                      m.completed ? 'text-ink line-through opacity-85' : 'text-ink'
                    }`}
                  >
                    {m.label}
                  </span>
                  <span className="text-[10px] font-mono text-muted shrink-0">
                    {m.category}
                  </span>
                </div>
                {m.completed_at && (
                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-mono mt-0.5 block">
                    Completed on {m.completed_at}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Drawer */}
      <EthicsPermitVaultDrawer
        open={permitDrawerOpen}
        onClose={() => setPermitDrawerOpen(false)}
        areaId={area.id}
        areaName={area.name}
        scopedClient={scopedClient}
        customTitle={meta.complianceVaultTitle}
      />
    </div>
  );
}
