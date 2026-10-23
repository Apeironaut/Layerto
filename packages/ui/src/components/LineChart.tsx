import { useMemo, useState } from 'react';
import { cn } from '../lib/cn';

export interface LineSeries {
  name: string;
  color?: string;
  points: { x: number; y: number }[];
}

const PALETTE = ['var(--color-crimson)', '#2563EB', '#16A34A', '#D97706', '#7C3AED', '#0891B2', '#DB2777', '#65A30D'];

/**
 * Responsive multi-series line chart (SVG, no dependencies) with a hover crosshair.
 * Used for learning curves and comparing experiments.
 */
export function LineChart({
  series,
  height = 220,
  xLabel = 'epoch',
  yFormat = (v: number) => `${(v * 100).toFixed(1)}%`,
  className,
  emptyText = 'No data yet',
}: {
  series: LineSeries[];
  height?: number;
  xLabel?: string;
  yFormat?: (v: number) => string;
  className?: string;
  emptyText?: string;
}) {
  const [hoverX, setHoverX] = useState<number | null>(null);
  const W = 640;
  const H = height;
  const pad = { l: 44, r: 12, t: 12, b: 26 };
  const all = series.flatMap((s) => s.points);
  const { x0, x1, y0, y1 } = useMemo(() => {
    if (!all.length) return { x0: 0, x1: 1, y0: 0, y1: 1 };
    const xs = all.map((p) => p.x);
    const ys = all.map((p) => p.y);
    let lo = Math.min(...ys);
    let hi = Math.max(...ys);
    if (hi - lo < 1e-6) {
      lo -= 0.05;
      hi += 0.05;
    }
    const m = (hi - lo) * 0.08;
    return { x0: Math.min(...xs), x1: Math.max(...xs) === Math.min(...xs) ? Math.min(...xs) + 1 : Math.max(...xs), y0: Math.max(0, lo - m), y1: hi + m };
  }, [all]);
  if (!all.length) {
    return <div className={cn('grid place-items-center rounded-control border border-dashed border-line text-sm text-muted', className)} style={{ height }}>{emptyText}</div>;
  }
  const sx = (x: number) => pad.l + ((x - x0) / (x1 - x0)) * (W - pad.l - pad.r);
  const sy = (y: number) => pad.t + (1 - (y - y0) / (y1 - y0)) * (H - pad.t - pad.b);
  const ticks = Array.from({ length: 4 }, (_, i) => y0 + ((y1 - y0) * i) / 3);
  const xTicks = Array.from(new Set([x0, Math.round((x0 + x1) / 2), x1]));
  const hovered =
    hoverX === null
      ? []
      : series.map((s, i) => {
          const p = s.points.reduce<{ x: number; y: number } | null>((best, q) => (best === null || Math.abs(q.x - hoverX) < Math.abs(best.x - hoverX) ? q : best), null);
          return { name: s.name, color: s.color ?? PALETTE[i % PALETTE.length], p };
        });
  return (
    <div className={cn('relative w-full', className)}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-auto select-none"
        role="img"
        aria-label={`Line chart of ${series.map((s) => s.name).join(', ')}`}
        onMouseMove={(e) => {
          const r = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
          const x = ((e.clientX - r.left) / r.width) * W;
          setHoverX(x0 + ((x - pad.l) / (W - pad.l - pad.r)) * (x1 - x0));
        }}
        onMouseLeave={() => setHoverX(null)}
      >
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={W - pad.r} y1={sy(t)} y2={sy(t)} className="stroke-line" strokeDasharray="3 4" />
            <text x={pad.l - 6} y={sy(t) + 3} textAnchor="end" className="fill-muted text-[10px]">{yFormat(t)}</text>
          </g>
        ))}
        {xTicks.map((t) => (
          <text key={t} x={sx(t)} y={H - 8} textAnchor="middle" className="fill-muted text-[10px]">{t}</text>
        ))}
        <text x={W - pad.r} y={H - 8} textAnchor="end" className="fill-muted text-[10px]">{xLabel}</text>
        {series.map((s, i) => {
          const pts = [...s.points].sort((a, b) => a.x - b.x);
          const d = pts.map((p, j) => `${j ? 'L' : 'M'}${sx(p.x).toFixed(1)},${sy(p.y).toFixed(1)}`).join(' ');
          const color = s.color ?? PALETTE[i % PALETTE.length];
          return (
            <g key={s.name}>
              <path d={d} fill="none" stroke={color} strokeWidth={2.2} strokeLinejoin="round" strokeLinecap="round" />
              {pts.length <= 40 && pts.map((p) => <circle key={p.x} cx={sx(p.x)} cy={sy(p.y)} r={2.5} fill={color} />)}
            </g>
          );
        })}
        {hoverX !== null && hoverX >= x0 && hoverX <= x1 && (
          <line x1={sx(hoverX)} x2={sx(hoverX)} y1={pad.t} y2={H - pad.b} className="stroke-line-strong" />
        )}
      </svg>
      {hoverX !== null && hovered.some((h) => h.p) && (
        <div className="pointer-events-none absolute top-2 right-2 rounded-control border border-line bg-raised/95 px-2.5 py-1.5 text-[11px] shadow-l2 space-y-0.5">
          {hovered.map(
            (h) =>
              h.p && (
                <div key={h.name} className="flex items-center gap-1.5">
                  <span className="size-2 rounded-full" style={{ background: h.color }} />
                  <span className="text-muted">{h.name}</span>
                  <span className="font-mono text-ink">{yFormat(h.p.y)}</span>
                  <span className="text-muted">@{h.p.x}</span>
                </div>
              ),
          )}
        </div>
      )}
      {series.length > 1 && (
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
          {series.map((s, i) => (
            <span key={s.name} className="inline-flex items-center gap-1.5">
              <span className="h-0.5 w-4 rounded" style={{ background: s.color ?? PALETTE[i % PALETTE.length] }} />
              {s.name}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
