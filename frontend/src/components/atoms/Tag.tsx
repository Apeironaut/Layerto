import type { ReactNode } from 'react'

export function Tag({ children }: { children: ReactNode }) {
    return <span className="rounded-full border border-line px-3 py-1 text-xs">{children}</span>
}
