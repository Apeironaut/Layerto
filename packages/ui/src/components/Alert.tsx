import type { ReactNode } from 'react';
import { cn } from '../lib/cn';
import { Icon } from './Icon';

export interface AlertProps {
  tone?: 'error' | 'success' | 'info';
  children: ReactNode;
  className?: string;
}

const TONES = {
  error: { cls: 'bg-crimson-tint border-crimson-border text-crimson', icon: 'alert' as const, role: 'alert' },
  success: {
    cls: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-800 dark:text-emerald-300',
    icon: 'check' as const,
    role: 'status',
  },
  info: { cls: 'bg-page border-line text-ink-secondary', icon: 'info' as const, role: 'status' },
};

/** Inline message for errors and confirmations inside forms and cards. */
export function Alert({ tone = 'info', children, className }: AlertProps) {
  const t = TONES[tone];
  return (
    <div role={t.role} className={cn('flex items-start gap-2.5 p-3.5 rounded-control border text-sm', t.cls, className)}>
      <Icon name={t.icon} size={16} className="mt-0.5 shrink-0" />
      <div className="min-w-0">{children}</div>
    </div>
  );
}
