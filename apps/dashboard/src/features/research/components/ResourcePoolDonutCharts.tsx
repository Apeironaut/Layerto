import { useState, useMemo } from 'react';
import { calculatePieSlices } from '../../../lib/chartCalculations';

interface ResourcePoolDonutChartsProps {
  storageUsedBytes: number;
  storageAllocatedBytes: number;
  storageLimitBytes: number;
  gpuCreditsUsed: number;
  gpuCreditsAllocated: number;
  gpuCreditsLimit: number;
}

export function ResourcePoolDonutCharts({
  storageUsedBytes,
  storageAllocatedBytes,
  storageLimitBytes,
  gpuCreditsUsed,
  gpuCreditsAllocated,
  gpuCreditsLimit,
}: ResourcePoolDonutChartsProps) {
  const [hoveredStorageIdx, setHoveredStorageIdx] = useState<number | null>(null);
  const [hoveredGpuIdx, setHoveredGpuIdx] = useState<number | null>(null);

  // Storage calculations in GB
  const storageTotalGB = Math.max(1, storageLimitBytes / (1024 * 1024 * 1024));
  const storageUsedGB = storageUsedBytes / (1024 * 1024 * 1024);
  const storageReservedGB = Math.max(0, (storageAllocatedBytes - storageUsedBytes) / (1024 * 1024 * 1024));
  const storageFreeGB = Math.max(0, storageTotalGB - (storageAllocatedBytes / (1024 * 1024 * 1024)));

  const storageSlices = useMemo(() => {
    return calculatePieSlices([
      { label: 'Used Storage', value: Math.max(0.01, storageUsedGB), color: '#DC2626' },
      { label: 'Reserved / Allocated', value: Math.max(0.01, storageReservedGB), color: '#0D9488' },
      { label: 'Unallocated Free', value: Math.max(0.01, storageFreeGB), color: '#334155' },
    ]);
  }, [storageUsedGB, storageReservedGB, storageFreeGB]);

  // GPU Credits calculations
  const gpuTotalCredits = Math.max(1, gpuCreditsLimit);
  const gpuUsedCredits = Math.max(0, gpuCreditsUsed);
  const gpuReservedCredits = Math.max(0, gpuCreditsAllocated - gpuCreditsUsed);
  const gpuFreeCredits = Math.max(0, gpuTotalCredits - gpuCreditsAllocated);

  const gpuSlices = useMemo(() => {
    return calculatePieSlices([
      { label: 'Used Credits', value: Math.max(0.01, gpuUsedCredits), color: '#6366F1' },
      { label: 'Reserved Budget', value: Math.max(0.01, gpuReservedCredits), color: '#14B8A6' },
      { label: 'Unallocated Free', value: Math.max(0.01, gpuFreeCredits), color: '#334155' },
    ]);
  }, [gpuUsedCredits, gpuReservedCredits, gpuFreeCredits]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
      {/* Storage Donut Chart */}
      <div className="flex flex-col sm:flex-row items-center gap-5 rounded-l2 border border-line bg-card/60 p-4 shadow-sm hover:border-line-strong transition-all">
        <div className="relative shrink-0 w-36 h-36 flex items-center justify-center">
          <svg viewBox="0 0 200 200" className="w-full h-full transform -rotate-90">
            {storageSlices.map((slice, idx) => {
              const isHovered = hoveredStorageIdx === idx;
              const isDimmed = hoveredStorageIdx !== null && !isHovered;
              return (
                <path
                  key={slice.label}
                  d={slice.path}
                  fill={slice.color}
                  onMouseEnter={() => setHoveredStorageIdx(idx)}
                  onMouseLeave={() => setHoveredStorageIdx(null)}
                  className="cursor-pointer transition-all duration-150"
                  style={{
                    opacity: isDimmed ? 0.35 : 1,
                    transform: isHovered ? 'scale(1.04)' : 'scale(1)',
                    transformOrigin: '100px 100px',
                  }}
                />
              );
            })}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
            <span className="font-extrabold text-sm text-ink">{storageUsedGB.toFixed(1)} GB</span>
            <span className="text-[10px] text-muted uppercase font-medium">Storage</span>
          </div>
        </div>

        <div className="flex-1 space-y-2 text-xs w-full">
          <div className="flex items-center justify-between border-b border-line pb-1.5">
            <span className="font-bold text-ink">Storage Pool Breakdown</span>
            <span className="font-mono text-muted text-[11px]">{storageTotalGB.toFixed(0)} GB Total</span>
          </div>
          <div className="space-y-1.5 pt-1">
            <div
              className={`flex items-center justify-between rounded px-2 py-1 cursor-pointer transition-colors ${
                hoveredStorageIdx === 0 ? 'bg-page' : ''
              }`}
              onMouseEnter={() => setHoveredStorageIdx(0)}
              onMouseLeave={() => setHoveredStorageIdx(null)}
            >
              <div className="flex items-center gap-2">
                <span className="size-2.5 rounded-full bg-red-600 shrink-0" />
                <span className="text-muted">Used Storage</span>
              </div>
              <span className="font-mono font-semibold text-ink">{storageUsedGB.toFixed(1)} GB</span>
            </div>

            <div
              className={`flex items-center justify-between rounded px-2 py-1 cursor-pointer transition-colors ${
                hoveredStorageIdx === 1 ? 'bg-page' : ''
              }`}
              onMouseEnter={() => setHoveredStorageIdx(1)}
              onMouseLeave={() => setHoveredStorageIdx(null)}
            >
              <div className="flex items-center gap-2">
                <span className="size-2.5 rounded-full bg-teal-600 shrink-0" />
                <span className="text-muted">Allocated / Reserved</span>
              </div>
              <span className="font-mono font-semibold text-ink">
                {(storageAllocatedBytes / (1024 * 1024 * 1024)).toFixed(1)} GB
              </span>
            </div>

            <div
              className={`flex items-center justify-between rounded px-2 py-1 cursor-pointer transition-colors ${
                hoveredStorageIdx === 2 ? 'bg-page' : ''
              }`}
              onMouseEnter={() => setHoveredStorageIdx(2)}
              onMouseLeave={() => setHoveredStorageIdx(null)}
            >
              <div className="flex items-center gap-2">
                <span className="size-2.5 rounded-full bg-slate-600 shrink-0" />
                <span className="text-muted">Unallocated Free</span>
              </div>
              <span className="font-mono font-semibold text-emerald-500">{storageFreeGB.toFixed(1)} GB</span>
            </div>
          </div>
        </div>
      </div>

      {/* GPU Credits Donut Chart */}
      <div className="flex flex-col sm:flex-row items-center gap-5 rounded-l2 border border-line bg-card/60 p-4 shadow-sm hover:border-line-strong transition-all">
        <div className="relative shrink-0 w-36 h-36 flex items-center justify-center">
          <svg viewBox="0 0 200 200" className="w-full h-full transform -rotate-90">
            {gpuSlices.map((slice, idx) => {
              const isHovered = hoveredGpuIdx === idx;
              const isDimmed = hoveredGpuIdx !== null && !isHovered;
              return (
                <path
                  key={slice.label}
                  d={slice.path}
                  fill={slice.color}
                  onMouseEnter={() => setHoveredGpuIdx(idx)}
                  onMouseLeave={() => setHoveredGpuIdx(null)}
                  className="cursor-pointer transition-all duration-150"
                  style={{
                    opacity: isDimmed ? 0.35 : 1,
                    transform: isHovered ? 'scale(1.04)' : 'scale(1)',
                    transformOrigin: '100px 100px',
                  }}
                />
              );
            })}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
            <span className="font-extrabold text-sm text-ink">{gpuUsedCredits.toLocaleString()}</span>
            <span className="text-[10px] text-muted uppercase font-medium">Credits</span>
          </div>
        </div>

        <div className="flex-1 space-y-2 text-xs w-full">
          <div className="flex items-center justify-between border-b border-line pb-1.5">
            <span className="font-bold text-ink">GPU Credits Breakdown</span>
            <span className="font-mono text-muted text-[11px]">{gpuTotalCredits.toLocaleString()} Total</span>
          </div>
          <div className="space-y-1.5 pt-1">
            <div
              className={`flex items-center justify-between rounded px-2 py-1 cursor-pointer transition-colors ${
                hoveredGpuIdx === 0 ? 'bg-page' : ''
              }`}
              onMouseEnter={() => setHoveredGpuIdx(0)}
              onMouseLeave={() => setHoveredGpuIdx(null)}
            >
              <div className="flex items-center gap-2">
                <span className="size-2.5 rounded-full bg-indigo-500 shrink-0" />
                <span className="text-muted">Used Credits</span>
              </div>
              <span className="font-mono font-semibold text-ink">{gpuUsedCredits.toLocaleString()} cr</span>
            </div>

            <div
              className={`flex items-center justify-between rounded px-2 py-1 cursor-pointer transition-colors ${
                hoveredGpuIdx === 1 ? 'bg-page' : ''
              }`}
              onMouseEnter={() => setHoveredGpuIdx(1)}
              onMouseLeave={() => setHoveredGpuIdx(null)}
            >
              <div className="flex items-center gap-2">
                <span className="size-2.5 rounded-full bg-teal-500 shrink-0" />
                <span className="text-muted">Reserved Budget</span>
              </div>
              <span className="font-mono font-semibold text-ink">{gpuCreditsAllocated.toLocaleString()} cr</span>
            </div>

            <div
              className={`flex items-center justify-between rounded px-2 py-1 cursor-pointer transition-colors ${
                hoveredGpuIdx === 2 ? 'bg-page' : ''
              }`}
              onMouseEnter={() => setHoveredGpuIdx(2)}
              onMouseLeave={() => setHoveredGpuIdx(null)}
            >
              <div className="flex items-center gap-2">
                <span className="size-2.5 rounded-full bg-slate-600 shrink-0" />
                <span className="text-muted">Unallocated Free</span>
              </div>
              <span className="font-mono font-semibold text-emerald-500">{gpuFreeCredits.toLocaleString()} cr</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
