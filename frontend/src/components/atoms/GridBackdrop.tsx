import { cn } from '../../lib/cn'

/** Faint square grid; pass a mask class to fade it. */
export function GridBackdrop({ className }: { className?: string }) {
    return (
        <div
            aria-hidden="true"
            className={cn(
                'pointer-events-none absolute inset-0 bg-[linear-gradient(var(--color-grid)_1px,transparent_1px),linear-gradient(90deg,var(--color-grid)_1px,transparent_1px)] bg-size-[5rem_5rem]',
                className,
            )}
        />
    )
}
