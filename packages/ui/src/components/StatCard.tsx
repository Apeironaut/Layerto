import type { ReactNode } from 'react';
import { TiltCard } from './TiltCard';
import { Skeleton } from './Skeleton';

export interface StatCardProps {
  label: string;
  value: ReactNode;
  /** Small line under the value. */
  hint?: ReactNode;
  /** Optional extra content (progress bar, button). */
  footer?: ReactNode;
  loading?: boolean;
}

/** One headline number in a 3D-tilting card. */
export function StatCard({ label, value, hint, footer, loading = false }: StatCardProps) {
  return (
    <TiltCard className="flex flex-col">
      <div className="text-sm font-medium text-muted">{label}</div>
      <div className="mt-2 text-3xl font-bold tracking-tight text-ink tabular-nums">
        {loading ? <Skeleton className="h-9 w-32" /> : value}
      </div>
      {hint && <div className="mt-1 text-xs text-muted">{hint}</div>}
      {footer && <div className="mt-4">{footer}</div>}
    </TiltCard>
  );
}
