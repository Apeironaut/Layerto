import { useState, useId } from 'react';
import type { DayActivity } from '../../lib/dailyActivity';

export interface ActivityBarLineChartProps {
  data: DayActivity[];
  className?: string;
}

export function ActivityBarLineChart({ data, className = '' }: ActivityBarLineChartProps) {
  const gradientId = useId();
  const [chartMode, setChartMode] = useState<'bar' | 'line'>('bar');
  const [hoveredDay, setHoveredDay] = useState<DayActivity | null>(null);

  if (data.length === 0) {
    return (
      <div className={`flex flex-col items-center justify-center py-10 text-center ${className}`}>
        <p className="text-xs text-muted font-medium">No activity in this period</p>
      </div>
    );
  }

  const maxRequests = Math.max(1, ...data.map((d) => d.requests));
  const activeDay = hoveredDay ?? data[data.length - 1];

  // SVG dimensions
  const svgWidth = 500;
  const svgHeight = 160;
  const paddingX = 16;
  const paddingTop = 14;
  const paddingBottom = 24;

  const innerW = svgWidth - paddingX * 2;
  const innerH = svgHeight - paddingTop - paddingBottom;

  const points = data.map((d, i) => {
    const x = paddingX + (data.length > 1 ? (i / (data.length - 1)) * innerW : innerW / 2);
    const y = paddingTop + innerH - (d.requests / maxRequests) * innerH;
    return { x, y, d };
  });

  // Polyline points
  const pointsStr = points.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');

  // Closed path for area gradient under line
  const areaPathStr = points.length > 0
    ? `M ${points[0].x.toFixed(1)},${(paddingTop + innerH).toFixed(1)} ` +
      points.map((p) => `L ${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ') +
      ` L ${points[points.length - 1].x.toFixed(1)},${(paddingTop + innerH).toFixed(1)} Z`
    : '';

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Readout and Bar/Line toggle */}
      <div className="flex items-center justify-between gap-2 text-xs">
        <div aria-live="polite" className="text-muted min-h-[1.25rem] flex items-center gap-2">
          {activeDay && (
            <>
              <span className="font-mono text-ink font-semibold">{activeDay.date}</span>
              <span>·</span>
              <span className="font-semibold text-ink">{activeDay.requests}</span> {activeDay.requests === 1 ? 'call' : 'calls'}
              <span>·</span>
              <span className="font-mono text-crimson font-medium">{activeDay.charge}</span>
            </>
          )}
        </div>

        {/* View Toggle */}
        <div className="flex items-center p-0.5 rounded-control bg-page border border-line shrink-0">
          <button
            type="button"
            onClick={() => setChartMode('bar')}
            className={`px-2 py-0.5 rounded-sm font-medium text-[11px] transition-colors cursor-pointer ${
              chartMode === 'bar' ? 'bg-card text-ink shadow-xs font-semibold' : 'text-muted hover:text-ink'
            }`}
            aria-label="Bar chart view"
          >
            Bars
          </button>
          <button
            type="button"
            onClick={() => setChartMode('line')}
            className={`px-2 py-0.5 rounded-sm font-medium text-[11px] transition-colors cursor-pointer ${
              chartMode === 'line' ? 'bg-card text-ink shadow-xs font-semibold' : 'text-muted hover:text-ink'
            }`}
            aria-label="Line chart view"
          >
            Line
          </button>
        </div>
      </div>

      {/* Chart Canvas */}
      {chartMode === 'bar' ? (
        <div
          className="h-40 flex items-end gap-[3px] border-b border-line pt-2"
          role="list"
          aria-label="Requests per day"
        >
          {data.map((d) => {
            const h = d.requests === 0 ? 3 : Math.max(6, (d.requests / maxRequests) * 100);
            const isActive = activeDay?.date === d.date;
            return (
              <div
                key={d.date}
                role="listitem"
                tabIndex={0}
                aria-label={`${d.date}: ${d.requests} requests, ${d.charge}`}
                onMouseEnter={() => setHoveredDay(d)}
                onMouseLeave={() => setHoveredDay(null)}
                onFocus={() => setHoveredDay(d)}
                onBlur={() => setHoveredDay(null)}
                className="flex-1 h-full flex items-end cursor-pointer focus-visible:outline-2 focus-visible:outline-focus rounded-t-sm"
              >
                <div
                  className={`w-full rounded-t-sm transition-all duration-150 ${
                    isActive
                      ? 'bg-crimson shadow-xs'
                      : d.requests === 0
                        ? 'bg-line/40'
                        : 'bg-crimson/70 hover:bg-crimson'
                  }`}
                  style={{ height: `${h}%` }}
                />
              </div>
            );
          })}
        </div>
      ) : (
        <div className="h-40 w-full relative">
          <svg
            viewBox={`0 0 ${svgWidth} ${svgHeight}`}
            preserveAspectRatio="none"
            className="w-full h-full overflow-visible"
            role="img"
            aria-label="Requests trend line"
          >
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--color-crimson)" stopOpacity="0.28" />
                <stop offset="100%" stopColor="var(--color-crimson)" stopOpacity="0.0" />
              </linearGradient>
            </defs>

            {/* Baseline */}
            <line
              x1={paddingX}
              y1={paddingTop + innerH}
              x2={svgWidth - paddingX}
              y2={paddingTop + innerH}
              stroke="var(--color-line)"
              strokeWidth="1"
            />

            {/* Area under line */}
            {areaPathStr && (
              <path d={areaPathStr} fill={`url(#${gradientId})`} />
            )}

            {/* Main Trend Line */}
            <polyline
              fill="none"
              stroke="var(--color-crimson)"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              points={pointsStr}
            />

            {/* Data points */}
            {points.map((p) => {
              const isSelected = activeDay?.date === p.d.date;
              return (
                <g key={p.d.date}>
                  {/* Invisible hit target for smooth hover */}
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r="9"
                    fill="transparent"
                    className="cursor-pointer"
                    onMouseEnter={() => setHoveredDay(p.d)}
                    onMouseLeave={() => setHoveredDay(null)}
                    tabIndex={0}
                    aria-label={`${p.d.date}: ${p.d.requests} requests`}
                  />
                  {/* Visual dot */}
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r={isSelected ? '5' : '3'}
                    fill={isSelected ? 'var(--color-card)' : 'var(--color-crimson)'}
                    stroke="var(--color-crimson)"
                    strokeWidth={isSelected ? '2.5' : '1.5'}
                    className="pointer-events-none transition-all duration-150"
                  />
                </g>
              );
            })}
          </svg>
        </div>
      )}

      {/* Axis dates */}
      <div className="flex items-center justify-between text-[11px] font-mono text-muted">
        <span>{data[0]?.date}</span>
        {data.length > 2 && <span>{data[Math.floor(data.length / 2)]?.date}</span>}
        <span>{data[data.length - 1]?.date}</span>
      </div>
    </div>
  );
}
