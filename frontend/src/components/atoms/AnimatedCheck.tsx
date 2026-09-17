import { cn } from '../../lib/cn'

export function AnimatedCheck({ className }: { className?: string }) {
    return (
        <svg viewBox="0 0 52 52" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={cn('size-14', className)}>
            <circle cx="26" cy="26" r="23" />
            <path d="M16 27l7 7 13-15" pathLength={1} strokeDasharray={1} className="animate-draw" />
        </svg>
    )
}
