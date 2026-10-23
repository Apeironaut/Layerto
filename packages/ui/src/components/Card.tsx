import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '../lib/cn';

export interface CardProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  /** l1 = content card, l2 = raised/active card. */
  level?: 'l1' | 'l2';
  title?: ReactNode;
  subtitle?: ReactNode;
  /** Right side of the card header (buttons, filters). */
  actions?: ReactNode;
  padded?: boolean;
}

const LEVELS = {
  l1: 'rounded-l1 bg-card border border-line shadow-l1',
  l2: 'rounded-l2 bg-raised border border-line-strong shadow-l2',
};

/** A static surface. For clickable cards use TiltCard or a button/link inside. */
export function Card({ level = 'l1', title, subtitle, actions, padded = true, className, children, ...props }: CardProps) {
  return (
    <div className={cn('text-ink', LEVELS[level], padded && 'p-5 sm:p-6', className)} {...props}>
      {(title || actions) && (
        <div className={cn('flex items-start justify-between gap-4 mb-4', !padded && 'px-5 sm:px-6 pt-5 sm:pt-6')}>
          <div className="min-w-0">
            {title && <h2 className="text-base font-bold text-ink">{title}</h2>}
            {subtitle && <p className="text-sm text-muted mt-0.5">{subtitle}</p>}
          </div>
          {actions && <div className="shrink-0 flex items-center gap-2">{actions}</div>}
        </div>
      )}
      {children}
    </div>
  );
}
