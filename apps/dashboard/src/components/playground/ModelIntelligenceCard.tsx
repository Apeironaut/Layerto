import { useState } from 'react';
import type { PublicModelItem } from '@layerto/types';
import { Card, Chip, Icon, cn, usd } from '@layerto/ui';
import {
  calculateGraphCoordinates,
  formatMetricValue,
  parseVersionMetrics,
} from '../../lib/playgroundLogic';

export interface ModelIntelligenceCardProps {
  model?: PublicModelItem;
  isAuto: boolean;
}

export function ModelIntelligenceCard({ model, isAuto }: ModelIntelligenceCardProps) {
  const [activeVersionIndex, setActiveVersionIndex] = useState(0);
  const [hoveredPointIndex, setHoveredPointIndex] = useState<number | null>(null);

  if (isAuto) {
    return (
      <Card
        className="border-line/80 shadow-l2 transition-all duration-200"
        title="Auto-Routing Engine"
        actions={<Chip variant="brand">Dynamic Selection</Chip>}
      >
        <div className="space-y-4 text-sm">
          <p className="text-ink">
            Auto-routing automatically inspects your natural language prompt and resolves the best vision model in the Layerto catalog based on keyword priorities.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            <div className="p-3.5 rounded-control border border-line bg-page space-y-1.5">
              <div className="flex items-center gap-2 font-medium text-ink">
                <Icon name="route" className="w-4 h-4 text-crimson" />
                <span>Keyword Routing</span>
              </div>
              <p className="text-xs text-muted leading-relaxed">
                Matches keywords like &ldquo;turtle&rdquo;, &ldquo;sea turtle&rdquo; or Sinhala terms directly to specialist models.
              </p>
            </div>
            <div className="p-3.5 rounded-control border border-line bg-page space-y-1.5">
              <div className="flex items-center gap-2 font-medium text-ink">
                <Icon name="spark" className="w-4 h-4 text-crimson" />
                <span>Zero Latency Overhead</span>
              </div>
              <p className="text-xs text-muted leading-relaxed">
                Evaluated in-memory before worker dispatch without extra token or LLM latency.
              </p>
            </div>
          </div>
        </div>
      </Card>
    );
  }

  if (!model) return null;

  const meta = model.meta;
  const versions = meta.versions ?? [];
  const metrics = meta.metrics ?? {};
  const datasets = meta.datasets ?? [];
  const points = parseVersionMetrics(versions);
  const graph = calculateGraphCoordinates(points, 380, 130, 24);
  const activeVersion = versions[activeVersionIndex] ?? versions[0];

  return (
    <Card
      className="border-line/80 shadow-l2 transition-all duration-200 space-y-5"
      title={`${model.name} Intelligence`}
      actions={
        <div className="flex flex-wrap gap-2">
          <Chip variant="active">{usd(model.price_usd)} / call</Chip>
          {model.is_open ? <Chip variant="brand">Open Weights</Chip> : <Chip variant="neutral">Specialist</Chip>}
        </div>
      }
    >
      {/* Badges: Owner, Architecture, License */}
      <div className="flex flex-wrap items-center gap-2 text-xs">
        {meta.owner && (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-crimson-tint text-crimson font-medium">
            <Icon name="user" className="w-3.5 h-3.5" />
            <span>Owned by {meta.owner}</span>
          </span>
        )}
        {meta.architecture && (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-surface-muted text-muted font-mono">
            <Icon name="cpu" className="w-3.5 h-3.5" />
            <span>{meta.architecture}</span>
          </span>
        )}
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-surface-muted text-muted font-medium">
          <Icon name="shield" className="w-3.5 h-3.5" />
          <span>License: {model.license}</span>
        </span>
      </div>

      {/* Why & How to Use */}
      <div className="space-y-3">
        <p className="text-sm text-ink leading-relaxed">{model.description}</p>

        {meta.why_use && (
          <div className="p-3.5 rounded-control border border-crimson-border/40 bg-crimson-tint/30 space-y-1">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-crimson">
              <Icon name="target" className="w-3.5 h-3.5" />
              <span>Why Use This Model</span>
            </div>
            <p className="text-xs text-ink/90 leading-relaxed">{meta.why_use}</p>
          </div>
        )}

        {meta.how_to_use && (
          <div className="p-3.5 rounded-control border border-line bg-page space-y-1">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted">
              <Icon name="spark" className="w-3.5 h-3.5 text-ink" />
              <span>How To Use In Production</span>
            </div>
            <p className="text-xs text-muted leading-relaxed">{meta.how_to_use}</p>
          </div>
        )}
      </div>

      {/* Training Datasets */}
      {datasets.length > 0 && (
        <div className="space-y-2 pt-1">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted">
            <Icon name="database" className="w-3.5 h-3.5 text-crimson" />
            <span>Training & Benchmark Datasets</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {datasets.map((ds, idx) => (
              <span
                key={idx}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-control bg-page border border-line text-xs font-medium text-ink"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-crimson" />
                {ds}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Production Metrics Grid */}
      {Object.keys(metrics).length > 0 && (
        <div className="space-y-2 pt-2">
          <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-muted">
            <span className="flex items-center gap-1.5">
              <Icon name="chart" className="w-3.5 h-3.5 text-crimson" />
              <span>Verified Production Metrics</span>
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            {Object.entries(metrics).map(([key, val]) => (
              <div key={key} className="p-3 rounded-control border border-line bg-page text-center">
                <span className="block text-[11px] font-mono text-muted uppercase tracking-wider">
                  {key.replace(/_/g, ' ')}
                </span>
                <span className="mt-1 block font-mono text-base font-bold text-ink">
                  {formatMetricValue(key, val)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Versions & Fluctuation History Graph */}
      {versions.length > 0 && (
        <div className="space-y-3 pt-3 border-t border-line">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Icon name="clock" className="w-4 h-4 text-crimson" />
              <span className="text-xs font-semibold uppercase tracking-wider text-muted">
                Version History & Metrics Fluctuations
              </span>
            </div>
            <span className="text-xs text-muted font-mono">{versions.length} versions tracked</span>
          </div>

          {/* SVG Fluctuation Graph */}
          {points.length > 1 && (
            <div className="p-3.5 rounded-control border border-line bg-page space-y-2">
              <div className="flex items-center justify-between text-xs text-muted">
                <span className="font-medium text-ink">Accuracy / mAP50 Evolution Over Time</span>
                <span className="font-mono text-crimson font-medium">
                  {points[0].formattedValue} &rarr; {points[points.length - 1].formattedValue}
                </span>
              </div>

              <div className="relative w-full overflow-hidden">
                <svg
                  viewBox="0 0 380 130"
                  className="w-full h-28 overflow-visible"
                  role="img"
                  aria-label="Model metrics fluctuation line chart"
                >
                  <defs>
                    <linearGradient id="metricGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#e11d48" stopOpacity="0.25" />
                      <stop offset="100%" stopColor="#e11d48" stopOpacity="0.0" />
                    </linearGradient>
                  </defs>

                  {/* Horizontal grid lines */}
                  <line x1="24" y1="24" x2="356" y2="24" stroke="currentColor" strokeOpacity="0.08" strokeDasharray="3 3" />
                  <line x1="24" y1="65" x2="356" y2="65" stroke="currentColor" strokeOpacity="0.08" strokeDasharray="3 3" />
                  <line x1="24" y1="106" x2="356" y2="106" stroke="currentColor" strokeOpacity="0.08" strokeDasharray="3 3" />

                  {/* Area fill under curve */}
                  {graph.areaD && <path d={graph.areaD} fill="url(#metricGrad)" />}

                  {/* Line path */}
                  {graph.pathD && (
                    <path
                      d={graph.pathD}
                      fill="none"
                      stroke="#e11d48"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  )}

                  {/* Data point dots */}
                  {graph.coords.map((c, i) => {
                    const isHovered = hoveredPointIndex === i;
                    const isSelected = activeVersionIndex === i;
                    return (
                      <g key={i} className="cursor-pointer" onClick={() => setActiveVersionIndex(i)}>
                        <circle
                          cx={c.x}
                          cy={c.y}
                          r={isSelected || isHovered ? 6 : 4}
                          className={cn(
                            'transition-all duration-150',
                            isSelected
                              ? 'fill-crimson stroke-page stroke-2'
                              : 'fill-page stroke-crimson stroke-2',
                          )}
                          onMouseEnter={() => setHoveredPointIndex(i)}
                          onMouseLeave={() => setHoveredPointIndex(null)}
                        />
                        {/* Text label below point */}
                        <text
                          x={c.x}
                          y="124"
                          textAnchor="middle"
                          className="fill-muted text-[10px] font-mono select-none"
                        >
                          {c.point.version}
                        </text>
                      </g>
                    );
                  })}
                </svg>

                {/* Tooltip on hover */}
                {hoveredPointIndex !== null && graph.coords[hoveredPointIndex] && (
                  <div
                    className="absolute pointer-events-none px-2 py-1 rounded bg-ink text-page text-[11px] font-mono shadow-l2 -translate-x-1/2 -translate-y-full mb-2 z-10 whitespace-nowrap"
                    style={{
                      left: `${(graph.coords[hoveredPointIndex].x / 380) * 100}%`,
                      top: `${(graph.coords[hoveredPointIndex].y / 130) * 100}%`,
                    }}
                  >
                    <span className="font-bold">{graph.coords[hoveredPointIndex].point.version}</span>
                    <span className="mx-1">&middot;</span>
                    <span>{graph.coords[hoveredPointIndex].point.formattedValue}</span>
                    <span className="mx-1">&middot;</span>
                    <span className="opacity-80">{graph.coords[hoveredPointIndex].point.date}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Version Selector Tabs */}
          <div className="flex flex-wrap gap-2">
            {versions.map((ver, idx) => (
              <button
                key={ver.version}
                type="button"
                onClick={() => setActiveVersionIndex(idx)}
                className={cn(
                  'px-3 py-1.5 rounded-control text-xs font-mono transition-all',
                  activeVersionIndex === idx
                    ? 'bg-crimson text-white shadow-sm font-semibold'
                    : 'bg-page border border-line text-muted hover:border-crimson-border hover:text-ink',
                )}
              >
                {ver.version}
                {ver.status === 'latest' && ' (Current)'}
              </button>
            ))}
          </div>

          {/* Active Version Details */}
          {activeVersion && (
            <div className="p-3.5 rounded-control border border-line bg-page space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-mono font-bold text-ink">
                  {activeVersion.version}
                  <span className="ml-2 font-normal text-muted">Released {activeVersion.released_at}</span>
                </span>
                <span
                  className={cn(
                    'px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase',
                    activeVersion.status === 'latest'
                      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                      : activeVersion.status === 'stable'
                        ? 'bg-sky-500/10 text-sky-600 dark:text-sky-400'
                        : 'bg-muted/10 text-muted',
                  )}
                >
                  {activeVersion.status}
                </span>
              </div>
              {activeVersion.notes && <p className="text-muted leading-relaxed">{activeVersion.notes}</p>}

              {/* Version Metrics Breakdown */}
              {activeVersion.metrics && (
                <div className="flex flex-wrap gap-2 pt-1 font-mono">
                  {Object.entries(activeVersion.metrics).map(([mk, mv]) => (
                    <span key={mk} className="px-2 py-1 rounded bg-surface-muted text-ink text-[11px]">
                      <span className="text-muted">{mk}: </span>
                      <strong>{formatMetricValue(mk, mv)}</strong>
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
