import { useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { cn } from '../lib/cn';
import { Table, THead, Th, Tr, Td } from './Table';

export interface ChartDay {
  /** YYYY-MM-DD */
  date: string;
  requests: number;
  /** Already formatted, e.g. "$0.004000" */
  charge: string;
}

export interface UsageChartProps {
  data: ChartDay[];
  className?: string;
}

/** Daily request bars with hover/focus readout and a table view for screen readers. */
export function UsageChart({ data, className }: UsageChartProps) {
  const reduced = useReducedMotion();
  const [asTable, setAsTable] = useState(false);
  const [active, setActive] = useState<ChartDay | null>(null);
  const max = Math.max(1, ...data.map((d) => d.requests));
  const shown = active ?? data[data.length - 1];

  return (
    <div className={cn('space-y-4', className)}>
      <div className="flex items-center justify-between gap-3">
        <div aria-live="polite" className="text-sm text-muted min-h-[1.25rem]">
          {shown && (
            <>
              <span className="font-mono">{shown.date}</span> ·{' '}
              <strong className="text-ink">{shown.requests}</strong> {shown.requests === 1 ? 'request' : 'requests'} ·{' '}
              <span className="font-mono">{shown.charge}</span>
            </>
          )}
        </div>
        <button
          type="button"
          onClick={() => setAsTable((v) => !v)}
          className="text-xs font-semibold text-crimson hover:underline underline-offset-2 cursor-pointer"
        >
          {asTable ? 'Show chart' : 'Show as table'}
        </button>
      </div>

      {asTable ? (
        <Table label="Daily usage">
          <THead>
            <Th>Date</Th>
            <Th>Requests</Th>
            <Th>Spend</Th>
          </THead>
          <tbody>
            {data.map((d) => (
              <Tr key={d.date}>
                <Td className="font-mono text-xs">{d.date}</Td>
                <Td className="font-semibold">{d.requests}</Td>
                <Td className="font-mono text-xs">{d.charge}</Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      ) : (
        <div className="h-44 flex items-end gap-[3px] border-b border-line" role="list" aria-label="Requests per day">
          {data.map((d, i) => {
            const h = d.requests === 0 ? 2 : Math.max(6, (d.requests / max) * 100);
            const isActive = active?.date === d.date;
            return (
              <div
                key={d.date}
                role="listitem"
                tabIndex={0}
                aria-label={`${d.date}: ${d.requests} requests, ${d.charge}`}
                onMouseEnter={() => setActive(d)}
                onMouseLeave={() => setActive(null)}
                onFocus={() => setActive(d)}
                onBlur={() => setActive(null)}
                className="flex-1 h-full flex items-end cursor-pointer focus-visible:outline-2 focus-visible:outline-focus rounded-t-sm"
              >
                <motion.div
                  className={cn(
                    'w-full rounded-t-[4px] transition-colors',
                    isActive ? 'bg-crimson' : d.requests > 0 ? 'bg-crimson/45' : 'bg-line-strong',
                  )}
                  initial={reduced ? false : { height: 0 }}
                  animate={{ height: `${h}%` }}
                  transition={{ type: 'spring', stiffness: 160, damping: 22, delay: reduced ? 0 : i * 0.01 }}
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
