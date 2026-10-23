import { useState } from 'react';
import { Button, Icon } from '@layerto/ui';
import type { MethodologyStep, MethodologyStepStatus, ResearchArea } from '@layerto/types';
import { useAreaVault } from '../ResearchAreaBoundary';

interface StepEditForm {
  title: string;
  description: string;
  protocol_notes: string;
}

export function MethodologyPipeline() {
  const { area, scopedClient, updateAreaLocally } = useAreaVault();
  const [saving, setSaving] = useState(false);
  const [expandedStepId, setExpandedStepId] = useState<string | null>(null);

  // Modal states
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingStep, setEditingStep] = useState<MethodologyStep | null>(null);
  const [deletingStepId, setDeletingStepId] = useState<string | null>(null);

  const [formData, setFormData] = useState<StepEditForm>({
    title: '',
    description: '',
    protocol_notes: '',
  });

  const steps: MethodologyStep[] = Array.isArray(area.methodology_steps) && area.methodology_steps.length > 0
    ? (area.methodology_steps as MethodologyStep[])
    : [
        {
          id: 'step-1',
          step_number: 1,
          title: 'Problem Definition & Hypothesis Formulation',
          description: area.hypothesis || 'Articulate core research questions and expected quantitative boundaries.',
          status: 'completed',
          protocol_notes: 'Formalize scientific hypothesis and reproducibility conditions.',
        },
        {
          id: 'step-2',
          step_number: 2,
          title: 'Literature Review & Prior Art Synthesis',
          description: 'Survey academic literature, baseline models, and empirical methodologies.',
          status: 'completed',
          protocol_notes: 'Catalog peer-reviewed papers in Reference Vault.',
        },
        {
          id: 'step-3',
          step_number: 3,
          title: 'Empirical Data & Observation Collection',
          description: 'Acquire field specimens, sensory readings, or corpus records under ethics protocols.',
          status: 'in_progress',
          protocol_notes: 'Structure schema in Observations & Datasets Manager.',
        },
        {
          id: 'step-4',
          step_number: 4,
          title: 'Experimental Analysis & Model Validation',
          description: 'Execute quantitative ablation studies, inference benchmarks, or statistical tests.',
          status: 'pending',
          protocol_notes: 'Calculate confidence intervals and error bounds.',
        },
        {
          id: 'step-5',
          step_number: 5,
          title: 'Manuscript Synthesis & Peer-Reviewed Publishing',
          description: 'Assemble findings, format citations, and publish reproducibility package.',
          status: 'pending',
          protocol_notes: 'Distribute via AI Paper Writer & Publishing Studio.',
        },
      ];

  const completedCount = steps.filter((s) => s.status === 'completed').length;
  const inProgressCount = steps.filter((s) => s.status === 'in_progress').length;
  const progressPercent = steps.length > 0 ? Math.round((completedCount / steps.length) * 100) : 0;

  const persistSteps = async (nextSteps: MethodologyStep[]) => {
    // Re-index step numbers
    const indexed = nextSteps.map((s, idx) => ({ ...s, step_number: idx + 1 }));
    setSaving(true);
    try {
      await scopedClient.updateArea(area.id, {
        methodology_steps: indexed,
      } as Partial<ResearchArea>);
      updateAreaLocally({ methodology_steps: indexed });
    } catch (err) {
      console.error('Failed to save methodology steps', err);
    } finally {
      setSaving(false);
    }
  };

  const handleCycleStatus = (stepId: string) => {
    const nextSteps = steps.map((s) => {
      if (s.id !== stepId) return s;
      const nextStatus: MethodologyStepStatus =
        s.status === 'pending'
          ? 'in_progress'
          : s.status === 'in_progress'
          ? 'completed'
          : 'pending';
      return { ...s, status: nextStatus, updated_at: new Date().toISOString() };
    });
    persistSteps(nextSteps);
  };

  const handleOpenAdd = () => {
    setFormData({ title: '', description: '', protocol_notes: '' });
    setIsAddModalOpen(true);
  };

  const handleOpenEdit = (step: MethodologyStep) => {
    setEditingStep(step);
    setFormData({
      title: step.title,
      description: step.description,
      protocol_notes: step.protocol_notes || '',
    });
  };

  const handleSaveStepForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim()) return;

    if (editingStep) {
      const nextSteps = steps.map((s) =>
        s.id === editingStep.id
          ? {
              ...s,
              title: formData.title.trim(),
              description: formData.description.trim(),
              protocol_notes: formData.protocol_notes.trim(),
              updated_at: new Date().toISOString(),
            }
          : s,
      );
      persistSteps(nextSteps);
      setEditingStep(null);
    } else {
      const newStep: MethodologyStep = {
        id: `step-${Date.now()}`,
        step_number: steps.length + 1,
        title: formData.title.trim(),
        description: formData.description.trim(),
        status: 'pending',
        protocol_notes: formData.protocol_notes.trim(),
        updated_at: new Date().toISOString(),
      };
      persistSteps([...steps, newStep]);
      setIsAddModalOpen(false);
    }
  };

  const handleDeleteStep = (stepId: string) => {
    const nextSteps = steps.filter((s) => s.id !== stepId);
    persistSteps(nextSteps);
    setDeletingStepId(null);
    if (expandedStepId === stepId) setExpandedStepId(null);
  };

  const handleMoveStep = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= steps.length) return;
    const reordered = [...steps];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(targetIndex, 0, moved);
    persistSteps(reordered);
  };

  return (
    <div className="relative rounded-l3 border border-line bg-card p-5 sm:p-6 shadow-xs space-y-5">
      {/* Header & Progress Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded-control bg-crimson/10 text-crimson">
              <Icon name="overview" size={15} />
            </span>
            <h3 className="text-sm font-bold text-ink">Scientific Methodology Pipeline</h3>
            <span className="rounded-pill bg-page px-2 py-0.5 text-[10px] font-mono font-bold text-muted border border-line">
              {completedCount}/{steps.length} Completed
            </span>
          </div>
          <p className="text-xs text-muted mt-1">
            Sequential empirical protocol guiding this research area from hypothesis to peer-reviewed publication.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            icon="plus"
            onClick={handleOpenAdd}
            className="cursor-pointer text-xs"
          >
            Add Stage
          </Button>
        </div>
      </div>

      {/* Progress Metric Bar */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs font-mono">
          <span className="text-muted">Protocol Progress</span>
          <span className="font-bold text-ink">{progressPercent}%</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-page border border-line">
          <div
            className="h-full bg-gradient-to-r from-crimson to-emerald-500 transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        <div className="flex items-center gap-4 text-[11px] text-muted pt-1">
          <span className="flex items-center gap-1">
            <span className="size-2 rounded-full bg-emerald-500 inline-block" />
            {completedCount} Completed
          </span>
          <span className="flex items-center gap-1">
            <span className="size-2 rounded-full bg-indigo-500 inline-block animate-pulse" />
            {inProgressCount} In Progress
          </span>
          <span className="flex items-center gap-1">
            <span className="size-2 rounded-full bg-muted/40 inline-block" />
            {steps.length - completedCount - inProgressCount} Pending
          </span>
          {saving && <span className="text-[10px] text-muted italic ml-auto">Syncing...</span>}
        </div>
      </div>

      {/* Step Cards List */}
      <div className="space-y-3 pt-1">
        {steps.map((step, idx) => {
          const isExpanded = expandedStepId === step.id;
          const isCompleted = step.status === 'completed';
          const isInProgress = step.status === 'in_progress';

          return (
            <div
              key={step.id}
              className={`rounded-l2 border transition-all ${
                isCompleted
                  ? 'border-emerald-500/30 bg-emerald-500/[0.02]'
                  : isInProgress
                  ? 'border-indigo-500/40 bg-indigo-500/[0.03] shadow-xs'
                  : 'border-line bg-page/50'
              }`}
            >
              <div className="p-3.5 sm:p-4 flex items-start gap-3">
                {/* Status Toggle Button */}
                <button
                  type="button"
                  title="Click to cycle status (Pending -> In Progress -> Completed)"
                  onClick={() => handleCycleStatus(step.id)}
                  className={`mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-transform hover:scale-110 cursor-pointer ${
                    isCompleted
                      ? 'bg-emerald-500 text-white shadow-xs'
                      : isInProgress
                      ? 'border-2 border-indigo-500 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400'
                      : 'border-2 border-line bg-page text-muted hover:border-line-strong'
                  }`}
                >
                  {isCompleted ? '✓' : isInProgress ? '•' : step.step_number}
                </button>

                {/* Step Body */}
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[10px] font-bold text-muted">
                        STAGE 0{step.step_number}
                      </span>
                      <h4
                        className={`text-xs sm:text-sm font-bold truncate ${
                          isCompleted ? 'text-ink line-through opacity-80' : 'text-ink'
                        }`}
                      >
                        {step.title}
                      </h4>
                    </div>

                    {/* Status Badge */}
                    <span
                      onClick={() => handleCycleStatus(step.id)}
                      className={`cursor-pointer rounded-pill px-2 py-0.5 text-[10px] font-semibold border ${
                        isCompleted
                          ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                          : isInProgress
                          ? 'border-indigo-500/30 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400'
                          : 'border-line bg-card text-muted'
                      }`}
                    >
                      {isCompleted ? 'Completed' : isInProgress ? 'In Progress' : 'Pending'}
                    </span>
                  </div>

                  <p className="text-xs text-muted leading-relaxed">{step.description}</p>

                  {/* Expanded Protocol Details */}
                  {isExpanded && step.protocol_notes && (
                    <div className="mt-2.5 rounded-l1 border border-line bg-card p-3 text-xs space-y-1 animate-in fade-in duration-100">
                      <div className="font-semibold text-ink flex items-center gap-1.5 text-[11px]">
                        <Icon name="file" size={12} />
                        Protocol Specification & Notes
                      </div>
                      <p className="text-muted leading-relaxed font-mono text-[11px] whitespace-pre-wrap">
                        {step.protocol_notes}
                      </p>
                    </div>
                  )}

                  {/* Step Action Bar */}
                  <div className="flex items-center justify-between pt-2 text-[11px]">
                    <button
                      type="button"
                      onClick={() => setExpandedStepId(isExpanded ? null : step.id)}
                      className="text-muted hover:text-ink flex items-center gap-1 font-medium cursor-pointer"
                    >
                      <span>{isExpanded ? 'Hide Protocol' : 'Protocol Notes'}</span>
                      <span className="text-[10px]">{isExpanded ? '▲' : '▼'}</span>
                    </button>

                    <div className="flex items-center gap-1">
                      {/* Reorder Buttons */}
                      <button
                        type="button"
                        disabled={idx === 0}
                        onClick={() => handleMoveStep(idx, 'up')}
                        title="Move Up"
                        className="rounded p-1 text-muted hover:text-ink disabled:opacity-30 cursor-pointer"
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        disabled={idx === steps.length - 1}
                        onClick={() => handleMoveStep(idx, 'down')}
                        title="Move Down"
                        className="rounded p-1 text-muted hover:text-ink disabled:opacity-30 cursor-pointer"
                      >
                        ↓
                      </button>

                      {/* Edit Button */}
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(step)}
                        title="Edit Stage"
                        className="rounded p-1 text-muted hover:text-ink cursor-pointer ml-1"
                      >
                        <Icon name="pen" size={12} />
                      </button>

                      {/* Delete Button */}
                      <button
                        type="button"
                        onClick={() => setDeletingStepId(step.id)}
                        title="Delete Stage"
                        className="rounded p-1 text-muted hover:text-rose-600 cursor-pointer"
                      >
                        <Icon name="trash" size={12} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Delete Confirmation Modal */}
      {deletingStepId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="rounded-l2 border border-line bg-card p-5 max-w-sm w-full space-y-4 shadow-xl">
            <div className="flex items-center gap-2 text-rose-600 font-bold text-sm">
              <Icon name="trash" size={16} />
              Confirm Delete Stage
            </div>
            <p className="text-xs text-muted leading-relaxed">
              Are you sure you want to remove this methodology stage from this Research Area?
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <Button variant="secondary" size="sm" onClick={() => setDeletingStepId(null)} className="cursor-pointer">
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => handleDeleteStep(deletingStepId)}
                className="bg-rose-600 hover:bg-rose-700 text-white cursor-pointer"
              >
                Delete Stage
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Stage Modal */}
      {(isAddModalOpen || editingStep) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="rounded-l3 border border-line bg-card p-6 max-w-md w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <h4 className="text-sm font-bold text-ink">
                {editingStep ? `Edit Stage 0${editingStep.step_number}` : 'Add Methodology Stage'}
              </h4>
              <button
                type="button"
                onClick={() => {
                  setIsAddModalOpen(false);
                  setEditingStep(null);
                }}
                className="text-muted hover:text-ink cursor-pointer"
              >
                <Icon name="close" size={14} />
              </button>
            </div>

            <form onSubmit={handleSaveStepForm} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-ink mb-1">Stage Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Field Transect & Botanical Sampling"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full rounded-control border border-line bg-page px-3 py-2 text-xs text-ink placeholder:text-muted focus:border-crimson focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-ink mb-1">Description</label>
                <textarea
                  rows={2}
                  placeholder="Brief summary of this experimental or empirical phase..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full rounded-control border border-line bg-page px-3 py-2 text-xs text-ink placeholder:text-muted focus:border-crimson focus:outline-hidden resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-ink mb-1">Protocol Notes (Optional)</label>
                <textarea
                  rows={3}
                  placeholder="Detailed scientific guidelines, instrumentation parameters, or IRB considerations..."
                  value={formData.protocol_notes}
                  onChange={(e) => setFormData({ ...formData, protocol_notes: e.target.value })}
                  className="w-full rounded-control border border-line bg-page px-3 py-2 text-xs text-ink placeholder:text-muted focus:border-crimson focus:outline-hidden resize-none font-mono text-[11px]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-line">
                <Button
                  variant="secondary"
                  size="sm"
                  type="button"
                  onClick={() => {
                    setIsAddModalOpen(false);
                    setEditingStep(null);
                  }}
                  className="cursor-pointer"
                >
                  Cancel
                </Button>
                <Button variant="primary" size="sm" type="submit" className="cursor-pointer">
                  {editingStep ? 'Update Stage' : 'Save Stage'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
