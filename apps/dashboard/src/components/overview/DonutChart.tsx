import { useState } from 'react';
import type { PieSlice } from '../../lib/chartCalculations';

export interface DonutChartProps {
  slices: PieSlice[];
  totalLabel?: string;
  totalValue?: string | number;
  valueFormatter?: (val: number) => string;
  emptyMessage?: string;
  className?: string;
}

export function DonutChart({
  slices,
  totalLabel = 'Total',
  totalValue,
  valueFormatter = (v) => v.toLocaleString(),
  emptyMessage = 'No data in this period',
  className = '',
}: DonutChartProps) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  if (slices.length === 0) {
    return (
      <div className={`flex flex-col items-center justify-center py-10 text-center ${className}`}>
        <div className="w-16 h-16 rounded-full border-2 border-dashed border-line flex items-center justify-center text-muted mb-3">
          <svg className="w-6 h-6 opacity-40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 2a10 10 0 0 1 10 10" />
          </svg>
        </div>
        <p className="text-xs text-muted font-medium">{emptyMessage}</p>
      </div>
    );
  }

  const activeSlice = hoveredIdx !== null ? slices[hoveredIdx] : null;

  return (
    <div className={`flex flex-col sm:flex-row items-center gap-6 ${className}`}>
      {/* Donut graphic */}
      <div className="relative shrink-0 w-48 h-48 flex items-center justify-center select-none">
        <svg
          viewBox="0 0 200 200"
          className="w-full h-full transform transition-transform duration-200"
          role="img"
          aria-label={totalLabel}
        >
          {slices.map((slice, idx) => {
            const isHovered = hoveredIdx === idx;
            const isDimmed = hoveredIdx !== null && !isHovered;
            return (
              <path
                key={slice.label}
                d={slice.path}
                fill={slice.color}
                className="cursor-pointer transition-all duration-150 focus:outline-none"
                style={{
                  opacity: isDimmed ? 0.35 : 1,
                  transform: isHovered ? 'scale(1.03)' : 'scale(1)',
                  transformOrigin: '100px 100px',
                }}
                onMouseEnter={() => setHoveredIdx(idx)}
                onMouseLeave={() => setHoveredIdx(null)}
                onFocus={() => setHoveredIdx(idx)}
                onBlur={() => setHoveredIdx(null)}
                tabIndex={0}
                aria-label={`${slice.label}: ${valueFormatter(slice.value)} (${slice.percentage}%)`}
              />
            );
          })}
        </svg>

        {/* Center Readout */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center px-4">
          <div className="text-[11px] font-semibold text-muted uppercase tracking-wider truncate max-w-[110px]">
            {activeSlice ? activeSlice.label : totalLabel}
          </div>
          <div className="text-lg font-bold text-ink tabular-nums mt-0.5">
            {activeSlice ? valueFormatter(activeSlice.value) : (totalValue ?? '')}
          </div>
          <div className="text-xs font-mono font-medium text-crimson mt-0.5">
            {activeSlice ? `${activeSlice.percentage}%` : '100%'}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex-1 w-full space-y-2 max-h-56 overflow-y-auto pr-1">
        {slices.map((slice, idx) => {
          const isHovered = hoveredIdx === idx;
          return (
            <button
              type="button"
              key={slice.label}
              onMouseEnter={() => setHoveredIdx(idx)}
              onMouseLeave={() => setHoveredIdx(null)}
              onClick={() => setHoveredIdx((cur) => (cur === idx ? null : idx))}
              className={`w-full flex items-center justify-between gap-3 px-2.5 py-1.5 rounded-control text-xs text-left transition-colors cursor-pointer ${
                isHovered ? 'bg-raised shadow-xs' : 'hover:bg-page/70'
              }`}
            >
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0 shadow-xs"
                  style={{ backgroundColor: slice.color }}
                  aria-hidden="true"
                />
                <span className="font-medium text-ink truncate max-w-[150px] sm:max-w-[170px]" title={slice.label}>
                  {slice.label}
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0 font-mono text-ink-secondary">
                <span>{valueFormatter(slice.value)}</span>
                <span className="text-[11px] px-1.5 py-0.5 rounded-pill bg-line/50 text-muted font-semibold min-w-[38px] text-right">
                  {slice.percentage}%
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
