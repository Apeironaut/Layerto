import { useMemo, useState } from 'react';
import type { AblationRun } from '@layerto/types';
import { Icon } from '@layerto/ui';

interface AblationMatrixTableProps {
  runs: AblationRun[];
  onPinBaseline?: (runId: string) => void;
}

export function AblationMatrixTable({ runs, onPinBaseline }: AblationMatrixTableProps) {
  const [pinnedId, setPinnedId] = useState<string>(() => {
    const base = runs.find((r) => r.is_baseline);
    return base?.id ?? runs[0]?.id ?? '';
  });
  const [onlyChanged, setOnlyChanged] = useState<boolean>(false);
  const [exportNotice, setExportNotice] = useState<string | null>(null);

  const baseline = useMemo(() => runs.find((r) => r.id === pinnedId), [runs, pinnedId]);

  // Find all hyperparameter keys across all runs
  const allParamKeys = useMemo(() => {
    const keys = new Set<string>();
    runs.forEach((r) => {
      if (r.hyperparameters) {
        Object.keys(r.hyperparameters).forEach((k) => keys.add(k));
      }
    });
    return Array.from(keys);
  }, [runs]);

  // Changed hyperparameter keys (filter out columns where all runs have identical values)
  const changedParamKeys = useMemo(() => {
    return allParamKeys.filter((k) => {
      const firstVal = JSON.stringify(runs[0]?.hyperparameters?.[k]);
      return runs.some((r) => JSON.stringify(r.hyperparameters?.[k]) !== firstVal);
    });
  }, [allParamKeys, runs]);

  const visibleParamKeys = onlyChanged ? changedParamKeys : allParamKeys;

  // Compute delta against pinned baseline
  const getDelta = (metricKey: string, currentVal: number, higherIsBetter = true) => {
    if (!baseline || !baseline.metrics || typeof baseline.metrics[metricKey] !== 'number') {
      return null;
    }
    const baseVal = Number(baseline.metrics[metricKey]);
    const diff = currentVal - baseVal;
    if (Math.abs(diff) < 0.001) return null;

    const isPositive = higherIsBetter ? diff > 0 : diff < 0;
    const sign = diff > 0 ? '+' : '';
    return {
      text: `${sign}${diff.toFixed(1)}`,
      isGood: isPositive,
    };
  };

  const handleExport = (format: 'latex' | 'markdown' | 'csv') => {
    let content = '';
    if (format === 'markdown') {
      const headers = ['Model Run', 'Architecture', ...visibleParamKeys, 'mAP 50-95', 'Latency (ms)'];
      const sep = headers.map(() => '---');
      const rows = runs.map((r) => [
        r.id === pinnedId ? `${r.run_name} (Baseline)` : r.run_name,
        r.architecture,
        ...visibleParamKeys.map((k) => String(r.hyperparameters?.[k] ?? '-')),
        `${r.metrics?.map50_95 ?? '-'}%`,
        `${r.metrics?.inference_ms ?? '-'}ms`,
      ]);
      content = `| ${headers.join(' | ')} |\n| ${sep.join(' | ')} |\n` + rows.map((r) => `| ${r.join(' | ')} |`).join('\n');
    } else if (format === 'latex') {
      const cols = 'l l ' + visibleParamKeys.map(() => 'c').join(' ') + ' r r';
      const headers = ['Model Run', 'Architecture', ...visibleParamKeys, 'mAP', 'Latency'];
      const body = runs
        .map((r) => {
          const isBase = r.id === pinnedId;
          const name = isBase ? `\\textbf{${r.run_name} (Baseline)}` : r.run_name;
          const cells = [
            name,
            r.architecture,
            ...visibleParamKeys.map((k) => String(r.hyperparameters?.[k] ?? '-')),
            `${r.metrics?.map50_95 ?? '-'}`,
            `${r.metrics?.inference_ms ?? '-'}ms`,
          ];
          return cells.join(' & ') + ' \\\\';
        })
        .join('\n');
      content = `\\begin{table}[htbp]\n\\centering\n\\begin{tabular}{${cols}}\n\\toprule\n${headers.join(' & ')} \\\\\n\\midrule\n${body}\n\\bottomrule\n\\end{tabular}\n\\caption{Ablation Matrix Results}\n\\label{tab:ablation_matrix}\n\\end{table}`;
    } else {
      const headers = ['Run Name', 'Architecture', 'Is Baseline', ...visibleParamKeys, 'mAP 50-95', 'Precision', 'Recall', 'F1', 'Inference ms'];
      const rows = runs.map((r) => [
        `"${r.run_name}"`,
        `"${r.architecture}"`,
        r.id === pinnedId ? 'true' : 'false',
        ...visibleParamKeys.map((k) => `"${r.hyperparameters?.[k] ?? ''}"`),
        r.metrics?.map50_95 ?? '',
        r.metrics?.precision ?? '',
        r.metrics?.recall ?? '',
        r.metrics?.f1 ?? '',
        r.metrics?.inference_ms ?? '',
      ]);
      content = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    }

    navigator.clipboard.writeText(content);
    setExportNotice(`Copied ${format.toUpperCase()} table to clipboard!`);
    setTimeout(() => setExportNotice(null), 3000);
  };

  return (
    <div className="space-y-4">
      {/* Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setOnlyChanged((prev) => !prev)}
            className={`inline-flex items-center gap-1.5 rounded-pill px-3 py-1 text-xs font-medium transition-all ${
              onlyChanged
                ? 'bg-crimson text-white shadow-sm'
                : 'border border-line bg-card text-muted hover:text-ink'
            }`}
          >
            <Icon name="filter" size={13} />
            {onlyChanged ? 'Filtering: Changed Hyperparams Only' : 'Show Only Changed Hyperparams'}
          </button>
          {baseline && (
            <span className="text-xs text-muted">
              Pinned Baseline:{' '}
              <span className="font-semibold text-ink">{baseline.run_name}</span>
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {exportNotice && (
            <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400 animate-fade">
              {exportNotice}
            </span>
          )}
          <div className="inline-flex rounded-control border border-line bg-card p-0.5 text-xs">
            <button
              type="button"
              onClick={() => handleExport('latex')}
              className="px-2.5 py-1 font-mono text-[11px] hover:bg-page hover:text-ink rounded-control text-muted"
              title="Export as LaTeX booktabs table"
            >
              LaTeX
            </button>
            <button
              type="button"
              onClick={() => handleExport('markdown')}
              className="px-2.5 py-1 text-[11px] hover:bg-page hover:text-ink rounded-control text-muted"
              title="Export as Markdown table"
            >
              Markdown
            </button>
            <button
              type="button"
              onClick={() => handleExport('csv')}
              className="px-2.5 py-1 text-[11px] hover:bg-page hover:text-ink rounded-control text-muted"
              title="Export as CSV spreadsheet"
            >
              CSV
            </button>
          </div>
        </div>
      </div>

      {/* Matrix Table */}
      <div className="overflow-x-auto rounded-l2 border border-line bg-card shadow-l1">
        <table className="w-full border-collapse text-left text-xs">
          <thead>
            <tr className="border-b border-line bg-page/70 text-muted">
              <th className="py-2.5 pl-4 pr-3 font-semibold">Model Run</th>
              <th className="py-2.5 px-3 font-semibold">Architecture</th>
              {visibleParamKeys.map((key) => (
                <th key={key} className="py-2.5 px-3 font-semibold">
                  {key.replace(/_/g, ' ')}
                </th>
              ))}
              <th className="py-2.5 px-3 font-semibold text-right">mAP (50-95)</th>
              <th className="py-2.5 px-3 font-semibold text-right">Precision</th>
              <th className="py-2.5 px-3 font-semibold text-right">Recall</th>
              <th className="py-2.5 px-3 font-semibold text-right">F1 Score</th>
              <th className="py-2.5 px-3 font-semibold text-right">Latency</th>
              <th className="py-2.5 pr-4 pl-3 font-semibold text-center">Baseline</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line/60">
            {runs.map((r) => {
              const isPinned = r.id === pinnedId;
              const mapDelta = !isPinned && typeof r.metrics?.map50_95 === 'number'
                ? getDelta('map50_95', Number(r.metrics.map50_95), true)
                : null;
              const latDelta = !isPinned && typeof r.metrics?.inference_ms === 'number'
                ? getDelta('inference_ms', Number(r.metrics.inference_ms), false)
                : null;

              return (
                <tr
                  key={r.id}
                  className={`transition-colors ${
                    isPinned
                      ? 'bg-crimson/5 dark:bg-crimson/10 font-medium'
                      : 'hover:bg-page/50'
                  }`}
                >
                  <td className="py-3 pl-4 pr-3">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-ink">{r.run_name}</span>
                      {isPinned && (
                        <span className="rounded-pill bg-crimson px-1.5 py-0.2 text-[10px] font-bold text-white uppercase tracking-wider">
                          Baseline
                        </span>
                      )}
                    </div>
                    {r.notes && (
                      <p className="mt-0.5 max-w-xs truncate text-[11px] text-muted">{r.notes}</p>
                    )}
                  </td>
                  <td className="py-3 px-3 font-mono text-[11px] text-muted">{r.architecture}</td>
                  {visibleParamKeys.map((key) => (
                    <td key={key} className="py-3 px-3 font-mono text-[11px] text-ink">
                      {String(r.hyperparameters?.[key] ?? '-')}
                    </td>
                  ))}
                  <td className="py-3 px-3 text-right font-mono text-ink">
                    <div className="flex items-center justify-end gap-1.5">
                      <span>{r.metrics?.map50_95 !== undefined ? `${r.metrics.map50_95}%` : '-'}</span>
                      {mapDelta && (
                        <span
                          className={`rounded px-1 text-[10px] font-bold ${
                            mapDelta.isGood
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-400'
                              : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-400'
                          }`}
                        >
                          {mapDelta.text}%
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="py-3 px-3 text-right font-mono text-ink">
                    {r.metrics?.precision !== undefined ? `${r.metrics.precision}%` : '-'}
                  </td>
                  <td className="py-3 px-3 text-right font-mono text-ink">
                    {r.metrics?.recall !== undefined ? `${r.metrics.recall}%` : '-'}
                  </td>
                  <td className="py-3 px-3 text-right font-mono font-bold text-ink">
                    {r.metrics?.f1 !== undefined ? `${r.metrics.f1}%` : '-'}
                  </td>
                  <td className="py-3 px-3 text-right font-mono text-ink">
                    <div className="flex items-center justify-end gap-1.5">
                      <span>{r.metrics?.inference_ms !== undefined ? `${r.metrics.inference_ms}ms` : '-'}</span>
                      {latDelta && (
                        <span
                          className={`rounded px-1 text-[10px] font-bold ${
                            latDelta.isGood
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-400'
                              : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-400'
                          }`}
                        >
                          {latDelta.text}ms
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="py-3 pr-4 pl-3 text-center">
                    <button
                      type="button"
                      onClick={() => {
                        setPinnedId(r.id);
                        onPinBaseline?.(r.id);
                      }}
                      className={`size-7 rounded-control transition-all inline-flex items-center justify-center ${
                        isPinned
                          ? 'bg-crimson text-white shadow-sm'
                          : 'text-muted hover:bg-page hover:text-ink'
                      }`}
                      title={isPinned ? 'Currently pinned baseline control' : 'Pin as baseline control'}
                    >
                      <Icon name="pin" size={14} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
