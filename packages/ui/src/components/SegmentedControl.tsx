import { useId } from 'react';
import { motion } from 'framer-motion';
import { cn } from '../lib/cn';

export interface Segment<T extends string> {
  value: T;
  label: string;
}

export interface SegmentedControlProps<T extends string> {
  label: string;
  segments: Segment<T>[];
  value: T;
  onChange: (value: T) => void;
}

/** A small set of mutually exclusive options; the highlight slides to the chosen one. */
export function SegmentedControl<T extends string>({ label, segments, value, onChange }: SegmentedControlProps<T>) {
  const group = useId();
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex items-center gap-1 p-1 rounded-control bg-card border border-line">
      {segments.map((s) => {
        const active = s.value === value;
        return (
          <button
            key={s.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(s.value)}
            className={cn(
              'relative px-3 py-1.5 text-xs font-semibold rounded-[9px] cursor-pointer transition-colors',
              active ? 'text-white' : 'text-muted hover:text-ink',
            )}
          >
            {active && (
              <motion.span
                layoutId={`seg-${group}`}
                className="absolute inset-0 rounded-[9px] bg-crimson dark:bg-crimson-fill"
                transition={{ type: 'spring', stiffness: 420, damping: 34 }}
              />
            )}
            <span className="relative">{s.label}</span>
          </button>
        );
      })}
    </div>
  );
}
