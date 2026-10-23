import { useState, useMemo } from 'react';
import { Button, Icon, Modal } from '@layerto/ui';
import { api } from '../../../lib/api';
import type { ResearchArea, ResearchOverview, AreaAllocationInput } from '@layerto/types';

interface ManageResourceAllocationsModalProps {
  isOpen: boolean;
  onClose: () => void;
  areas: ResearchArea[];
  overview?: ResearchOverview | null;
  onSaved: () => void;
}

export function ManageResourceAllocationsModal({
  isOpen,
  onClose,
  areas,
  overview,
  onSaved,
}: ManageResourceAllocationsModalProps) {
  // Global pool limits
  const totalStorageGB = Math.max(1, Math.round((overview?.storage_limit_bytes ?? 53687091200) / (1024 * 1024 * 1024)));
  const totalGpuCredits = Math.max(1, overview?.gpu_credits_limit || Math.round((overview?.gpu_hours || 24.5) * 100) || 2450);

  // Local state for each area: storage in GB, GPU in credits
  const [allocations, setAllocations] = useState<Record<string, { storageGB: number; gpuCredits: number }>>(() => {
    const initial: Record<string, { storageGB: number; gpuCredits: number }> = {};
    for (const a of areas) {
      initial[a.id] = {
        storageGB: a.storage_quota_bytes > 0 ? Math.round(a.storage_quota_bytes / (1024 * 1024 * 1024)) : 0,
        gpuCredits: a.gpu_credits_budget > 0 ? a.gpu_credits_budget : 0,
      };
    }
    return initial;
  });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Calculate live totals across all areas
  const currentTotalAllocatedStorageGB = useMemo(() => {
    return Object.values(allocations).reduce((sum, item) => sum + (Number(item.storageGB) || 0), 0);
  }, [allocations]);

  const currentTotalAllocatedGpuCredits = useMemo(() => {
    return Object.values(allocations).reduce((sum, item) => sum + (Number(item.gpuCredits) || 0), 0);
  }, [allocations]);

  const freeStorageGB = Math.max(0, totalStorageGB - currentTotalAllocatedStorageGB);
  const freeGpuCredits = Math.max(0, totalGpuCredits - currentTotalAllocatedGpuCredits);

  const handleStorageChange = (areaId: string, val: number) => {
    const safeVal = Math.max(0, Math.min(totalStorageGB, val));
    setAllocations((prev) => ({
      ...prev,
      [areaId]: {
        ...prev[areaId],
        storageGB: safeVal,
      },
    }));
  };

  const handleGpuChange = (areaId: string, val: number) => {
    const safeVal = Math.max(0, Math.min(totalGpuCredits, val));
    setAllocations((prev) => ({
      ...prev,
      [areaId]: {
        ...prev[areaId],
        gpuCredits: safeVal,
      },
    }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (currentTotalAllocatedStorageGB > totalStorageGB) {
      setError(`Allocated storage (${currentTotalAllocatedStorageGB} GB) exceeds total pool of ${totalStorageGB} GB.`);
      return;
    }
    if (currentTotalAllocatedGpuCredits > totalGpuCredits) {
      setError(`Allocated GPU credits (${currentTotalAllocatedGpuCredits}) exceeds total pool of ${totalGpuCredits} credits.`);
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const payload: AreaAllocationInput[] = areas.map((a) => {
        const item = allocations[a.id] || { storageGB: 0, gpuCredits: 0 };
        return {
          area_id: a.id,
          storage_quota_bytes: item.storageGB * 1024 * 1024 * 1024,
          gpu_credits_budget: item.gpuCredits,
        };
      });

      await api.updateAreaAllocations(payload);
      onSaved();
      onClose();
    } catch (err: any) {
      console.error('Failed to update allocations', err);
      setError(err?.message || 'Failed to save resource allocations. Please verify values.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Manage Shared Resource Allocations" size="xl">
      <form onSubmit={handleSave} className="space-y-6 text-xs">
        {/* Pool Summary Dashboard */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 rounded-l2 border border-line bg-page p-4">
          {/* Storage Summary */}
          <div className="space-y-1.5 border-b sm:border-b-0 sm:border-r border-line pb-3 sm:pb-0 sm:pr-4">
            <div className="flex items-center justify-between">
              <span className="font-bold text-ink flex items-center gap-1.5">
                <Icon name="database" size={14} className="text-crimson" />
                <span>Global Storage Pool</span>
              </span>
              <span className="font-mono font-bold text-ink">{totalStorageGB} GB Total</span>
            </div>
            <div className="flex items-center justify-between text-[11px] text-muted">
              <span>Allocated: {currentTotalAllocatedStorageGB} GB</span>
              <span className="font-bold text-emerald-500">{freeStorageGB} GB Free to Allocate</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-line">
              <div
                className={`h-full transition-all duration-300 ${
                  currentTotalAllocatedStorageGB > totalStorageGB ? 'bg-red-500' : 'bg-crimson'
                }`}
                style={{ width: `${Math.min(100, (currentTotalAllocatedStorageGB / totalStorageGB) * 100)}%` }}
              />
            </div>
          </div>

          {/* GPU Credits Summary */}
          <div className="space-y-1.5 sm:pl-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-ink flex items-center gap-1.5">
                <Icon name="cpu" size={14} className="text-indigo-400" />
                <span>Global GPU Credits Pool</span>
              </span>
              <span className="font-mono font-bold text-ink">{totalGpuCredits.toLocaleString()} Credits</span>
            </div>
            <div className="flex items-center justify-between text-[11px] text-muted">
              <span>Allocated: {currentTotalAllocatedGpuCredits.toLocaleString()} cr</span>
              <span className="font-bold text-emerald-500">{freeGpuCredits.toLocaleString()} cr Free to Allocate</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-line">
              <div
                className={`h-full transition-all duration-300 ${
                  currentTotalAllocatedGpuCredits > totalGpuCredits ? 'bg-red-500' : 'bg-indigo-500'
                }`}
                style={{ width: `${Math.min(100, (currentTotalAllocatedGpuCredits / totalGpuCredits) * 100)}%` }}
              />
            </div>
          </div>
        </div>

        {error && (
          <div className="rounded-l1 border border-red-500/40 bg-red-500/10 p-3 text-red-500 font-semibold text-xs">
            {error}
          </div>
        )}

        <div className="text-[11px] text-muted bg-card/60 border border-line rounded p-2.5">
          💡 <strong>Allocations are optional:</strong> Research areas with 0 GB or 0 GPU credits will draw dynamically from the unallocated floating pool. Reducing resources in one area instantly frees them for other areas.
        </div>

        {/* Per-Area Allocation Sliders and Controls */}
        <div className="space-y-4 max-h-[50vh] overflow-y-auto pr-1">
          {areas.map((a) => {
            const currentItem = allocations[a.id] || { storageGB: 0, gpuCredits: 0 };
            const usedStorageGB = (a.storage_bytes_used / (1024 * 1024 * 1024)).toFixed(1);
            const maxStorageAvailableForThisArea = currentItem.storageGB + freeStorageGB;
            const maxGpuAvailableForThisArea = currentItem.gpuCredits + freeGpuCredits;

            return (
              <div
                key={a.id}
                className="rounded-l2 border border-line bg-card p-4 space-y-3.5 shadow-sm hover:border-line-strong transition-all"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-2">
                  <div className="flex items-center gap-2">
                    <span className="size-2.5 rounded-full" style={{ background: a.color || 'var(--color-crimson)' }} />
                    <span className="font-bold text-sm text-ink">{a.name}</span>
                    <span className="rounded-pill bg-page px-2 py-0.5 text-[10px] text-muted border border-line">
                      {a.discipline}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-[11px] text-muted">
                    <span>Used Storage: <strong className="text-ink">{usedStorageGB} GB</strong></span>
                    <span>•</span>
                    <span>Used GPU: <strong className="text-ink">{(a.gpu_credits_used || 0).toLocaleString()} cr</strong></span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 pt-1">
                  {/* Storage Allocation Slider */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="font-semibold text-muted text-[11px]">Storage Allocation (GB)</label>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="number"
                          min={0}
                          max={totalStorageGB}
                          value={currentItem.storageGB}
                          onChange={(e) => handleStorageChange(a.id, parseInt(e.target.value, 10) || 0)}
                          className="w-16 rounded border border-line bg-page px-2 py-0.5 text-right font-mono font-bold text-xs text-ink"
                        />
                        <span className="text-muted text-[11px]">GB</span>
                      </div>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={maxStorageAvailableForThisArea}
                      value={currentItem.storageGB}
                      onChange={(e) => handleStorageChange(a.id, parseInt(e.target.value, 10) || 0)}
                      className="w-full cursor-pointer accent-crimson"
                    />
                    <div className="flex justify-between text-[10px] text-muted">
                      <span>0 GB (Free Pool)</span>
                      <span>Max available: {maxStorageAvailableForThisArea} GB</span>
                    </div>
                  </div>

                  {/* GPU Credits Budget Slider */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="font-semibold text-muted text-[11px]">GPU Credits Budget</label>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="number"
                          min={0}
                          max={totalGpuCredits}
                          value={currentItem.gpuCredits}
                          onChange={(e) => handleGpuChange(a.id, parseInt(e.target.value, 10) || 0)}
                          className="w-20 rounded border border-line bg-page px-2 py-0.5 text-right font-mono font-bold text-xs text-ink"
                        />
                        <span className="text-muted text-[11px]">cr</span>
                      </div>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={maxGpuAvailableForThisArea}
                      value={currentItem.gpuCredits}
                      onChange={(e) => handleGpuChange(a.id, parseInt(e.target.value, 10) || 0)}
                      className="w-full cursor-pointer accent-indigo-500"
                    />
                    <div className="flex justify-between text-[10px] text-muted">
                      <span>0 cr (No GPUs)</span>
                      <span>Max available: {maxGpuAvailableForThisArea.toLocaleString()} cr</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-line">
          <Button variant="ghost" size="md" onClick={onClose} type="button">
            Cancel
          </Button>
          <Button variant="primary" size="md" loading={saving} type="submit" icon="check">
            Save Allocations
          </Button>
        </div>
      </form>
    </Modal>
  );
}
