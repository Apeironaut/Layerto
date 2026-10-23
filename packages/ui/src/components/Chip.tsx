import type { HTMLAttributes } from 'react';
import { cn } from '../lib/cn';

export type ChipVariant = 'active' | 'pending' | 'danger' | 'muted' | 'neutral' | 'brand';

export interface ChipProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: ChipVariant;
}

// Status uses shape + colour, never colour alone.
const SHAPES: Record<ChipVariant, string> = {
  active: '●',
  pending: '◔',
  danger: '▲',
  muted: '■',
  neutral: '•',
  brand: '◆',
};

const STYLES: Record<ChipVariant, string> = {
  active: 'bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 border-emerald-500/30',
  pending: 'bg-amber-500/10 text-amber-800 dark:text-amber-300 border-amber-500/30',
  danger: 'bg-crimson-tint text-crimson border-crimson-border',
  muted: 'bg-line/50 text-muted border-line-strong',
  neutral: 'bg-line/40 text-ink-secondary border-line',
  brand: 'bg-crimson-tint text-crimson border-crimson-border',
};

export function Chip({ variant = 'neutral', className, children, ...props }: ChipProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-pill text-xs font-semibold border whitespace-nowrap select-none',
        STYLES[variant],
        className,
      )}
      {...props}
    >
      <span className="text-[9px] leading-none" aria-hidden="true">
        {SHAPES[variant]}
      </span>
      <span>{children}</span>
    </span>
  );
}
