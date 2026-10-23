import { motion } from 'framer-motion';
import { cn } from '../lib/cn';

export interface ProgressBarProps {
  current: number;
  max: number;
  label: string;
  className?: string;
}

export function ProgressBar({ current, max, label, className }: ProgressBarProps) {
  const pct = Math.min(100, Math.max(0, (current / (max || 1)) * 100));
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuenow={current}
      aria-valuemin={0}
      aria-valuemax={max}
      className={cn('h-2 w-full rounded-full bg-line overflow-hidden', className)}
    >
      <motion.div
        className="h-full rounded-full bg-crimson"
        initial={{ width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={{ type: 'spring', stiffness: 120, damping: 22 }}
      />
    </div>
  );
}
