import { cn } from '../lib/cn';

/** Placeholder shaped like the content that is loading. */
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cn('rounded-control bg-line/70 animate-pulse motion-reduce:animate-none', className)} />;
}
