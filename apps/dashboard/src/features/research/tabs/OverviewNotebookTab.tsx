import { useEffect, useState } from 'react';
import { Button, Icon, Skeleton, useResource } from '@layerto/ui';
import { useAreaVault } from '../ResearchAreaBoundary';
import type { DomainInsight, ResearchNote } from '@layerto/types';

export function OverviewNotebookTab() {
  const { area, scopedClient, reloadArea } = useAreaVault();
  const [editingHypothesis, setEditingHypothesis] = useState(false);
  const [hypothesisText, setHypothesisText] = useState(area.hypothesis || '');
  const [savingHypothesis, setSavingHypothesis] = useState(false);

  const [scratchpad, setScratchpad] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const [noteSavedNotice, setNoteSavedNotice] = useState(false);

  // Load domain insight widgets pushed by the Tech Team
  const insightsResource = useResource<DomainInsight[]>(
    () => scopedClient.domainInsights({ area: area.id }),
    `domain-insights-${area.id}`,
  );

  // Load lab notes
  const notesResource = useResource<ResearchNote[]>(
    () => scopedClient.notes({ area: area.id }),
    `notes-${area.id}`,
  );

  useEffect(() => {
    setHypothesisText(area.hypothesis || '');
  }, [area.hypothesis]);

  const handleSaveHypothesis = async () => {
    setSavingHypothesis(true);
    try {
      await scopedClient.updateArea(area.id, {
        hypothesis: hypothesisText,
      } as any);
      await reloadArea();
      setEditingHypothesis(false);
    } catch (err) {
      console.error('Failed to update hypothesis', err);
    } finally {
      setSavingHypothesis(false);
    }
  };

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

  const handleCreateNote = async () => {
    if (!scratchpad.trim()) return;
    setSavingNote(true);
    try {
      await scopedClient.researchCreate('notes', {
        area_id: area.id,
        title: `Observation Log — ${new Date().toLocaleDateString()}`,
        body: scratchpad,
        pinned: true,
      });
      setScratchpad('');
      setNoteSavedNotice(true);
      setTimeout(() => setNoteSavedNotice(false), 2500);
      notesResource.reload();
    } catch (err) {
      console.error('Failed to save note', err);
    } finally {
      setSavingNote(false);
    }
  };

  const insights = insightsResource.data || [];
  const notes = notesResource.data || [];

  return (
    <div className="space-y-6">
      {/* Reproducibility Lock & Status Banner */}
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
        >
          {area.reproducibility_lock ? 'Unlock Area' : 'Engage Reproducibility Lock'}
        </Button>
      </div>

      {/* Primary Area Metrics */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-l2 border border-line bg-card p-4 shadow-l1">
          <div className="flex items-center justify-between text-muted text-xs">
            <span>Storage Used</span>
            <Icon name="database" size={15} />
          </div>
          <div className="mt-2 font-mono text-xl font-bold text-ink">
            {(area.storage_bytes_used / (1024 * 1024 * 1024)).toFixed(1)} GB
          </div>
          <span className="text-[11px] text-muted">
            {area.storage_quota_bytes > 0 ? `Quota: ${(area.storage_quota_bytes / (1024 * 1024 * 1024)).toFixed(0)} GB` : 'Free Shared Pool'}
          </span>
        </div>

        <div className="rounded-l2 border border-line bg-card p-4 shadow-l1">
          <div className="flex items-center justify-between text-muted text-xs">
            <span>GPU Credits Used</span>
            <Icon name="cpu" size={15} />
          </div>
          <div className="mt-2 font-mono text-xl font-bold text-ink">
            {(area.gpu_credits_used ?? Math.round((area.gpu_seconds_used || 0) / 36)).toLocaleString()} cr
          </div>
          <span className="text-[11px] text-muted">
            {area.gpu_credits_budget > 0 ? `Budget: ${area.gpu_credits_budget.toLocaleString()} cr` : 'Free Shared Pool'}
          </span>
        </div>

        <div className="rounded-l2 border border-line bg-card p-4 shadow-l1">
          <div className="flex items-center justify-between text-muted text-xs">
            <span>Vault Specimens</span>
            <Icon name="image" size={15} />
          </div>
          <div className="mt-2 font-mono text-xl font-bold text-ink">
            {area.specimens || 4}
          </div>
          <span className="text-[11px] text-muted">Field media & observations</span>
        </div>

        <div className="rounded-l2 border border-line bg-card p-4 shadow-l1">
          <div className="flex items-center justify-between text-muted text-xs">
            <span>Model Runs</span>
            <Icon name="flask" size={15} />
          </div>
          <div className="mt-2 font-mono text-xl font-bold text-ink">
            {area.experiments || 4}
          </div>
          <span className="text-[11px] text-muted">Ablations & benchmarks</span>
        </div>
      </div>

      {/* Hypothesis Card */}
      <div className="rounded-l2 border border-line bg-card p-5 shadow-l1 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="flex size-6 items-center justify-center rounded-control bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <Icon name="sparkles" size={14} />
            </span>
            <h3 className="text-sm font-bold text-ink">Core Research Hypothesis</h3>
          </div>
          {!editingHypothesis && (
            <Button
              variant="ghost"
              size="sm"
              icon="pen"
              onClick={() => setEditingHypothesis(true)}
            >
              Edit Hypothesis
            </Button>
          )}
        </div>

        {editingHypothesis ? (
          <div className="space-y-3 pt-1">
            <textarea
              rows={3}
              value={hypothesisText}
              onChange={(e) => setHypothesisText(e.target.value)}
              className="w-full rounded-control border border-line bg-page p-3 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-focus"
              placeholder="State the primary scientific or technical hypothesis tested in this area..."
            />
            <div className="flex justify-end gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setEditingHypothesis(false)}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                loading={savingHypothesis}
                onClick={handleSaveHypothesis}
              >
                Save Hypothesis
              </Button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-ink-secondary leading-relaxed bg-page/50 p-3.5 rounded-control border border-line/50 italic">
            "{area.hypothesis || 'No explicit hypothesis recorded yet. Click edit to define the core hypothesis for this research area.'}"
          </p>
        )}
      </div>

      {/* Domain Insight Widgets Bridge */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="flex size-6 items-center justify-center rounded-control bg-blue-500/10 text-blue-600 dark:text-blue-400">
              <Icon name="spark" size={14} />
            </span>
            <h3 className="text-sm font-bold text-ink">
              Verified Insights & Bridge Feed
            </h3>
            <span className="text-xs text-muted">
              (Tech team verified findings published to Domain Lead)
            </span>
          </div>
        </div>

        {insightsResource.loading ? (
          <Skeleton className="h-28 w-full rounded-l2" />
        ) : insights.length === 0 ? (
          <div className="rounded-l2 border border-line bg-card p-6 text-center text-sm text-muted">
            No published insights in this area yet. The Tech Team can publish verified model outcomes
            directly here from the Experiments Workbench.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
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
                <p className="text-xs text-ink-secondary leading-relaxed">{ins.content}</p>
                {ins.chart_data && Object.keys(ins.chart_data).length > 0 && (
                  <div className="flex items-center gap-3 pt-2 text-[11px] font-mono text-muted border-t border-line/60">
                    {Object.entries(ins.chart_data).map(([k, v]) => (
                      <span key={k}>
                        <span className="text-muted">{k}: </span>
                        <span className="font-bold text-ink">{String(v)}</span>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Lab Notebook / Scratchpad */}
      <div className="rounded-l2 border border-line bg-card p-5 shadow-l1 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="flex size-6 items-center justify-center rounded-control bg-crimson/10 text-crimson">
              <Icon name="pen" size={14} />
            </span>
            <h3 className="text-sm font-bold text-ink">Lab Notebook & Field Scratchpad</h3>
          </div>
          {noteSavedNotice && (
            <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
              Note saved to vault!
            </span>
          )}
        </div>

        <div className="space-y-3">
          <textarea
            rows={3}
            value={scratchpad}
            onChange={(e) => setScratchpad(e.target.value)}
            placeholder="Record quick field observations, code snippets, or specimen morphometrics here..."
            className="w-full rounded-control border border-line bg-page p-3 text-xs text-ink focus:outline-none focus:ring-2 focus:ring-focus"
          />
          <div className="flex justify-end">
            <Button
              variant="secondary"
              size="sm"
              icon="plus"
              loading={savingNote}
              disabled={!scratchpad.trim()}
              onClick={handleCreateNote}
            >
              Add Entry to Lab Notebook
            </Button>
          </div>
        </div>

        {/* Existing Notes List */}
        {notes.length > 0 && (
          <div className="space-y-2 pt-2 border-t border-line">
            <span className="text-xs font-semibold text-muted">Recent Notebook Entries:</span>
            <div className="space-y-2">
              {notes.map((n) => (
                <div
                  key={n.id}
                  className="rounded-control border border-line/60 bg-page/50 p-3 text-xs space-y-1"
                >
                  <div className="flex items-center justify-between font-semibold text-ink">
                    <span>{n.title}</span>
                    <span className="text-[10px] text-muted font-mono">
                      {new Date(n.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="text-muted leading-relaxed whitespace-pre-wrap">{n.body}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
