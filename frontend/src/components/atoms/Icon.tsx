import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'

const paths = {
    close: <path d="M6 6l12 12M18 6L6 18" />,
    sun: (
        <>
            <circle cx="12" cy="12" r="3.5" />
            <path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42M17.65 17.65l1.42 1.42M2 12h2M20 12h2M4.93 19.07l1.42-1.42M17.65 6.35l1.42-1.42" />
        </>
    ),
    moon: <path d="M20 15.2A8.2 8.2 0 0 1 8.8 4a8.2 8.2 0 1 0 11.2 11.2Z" />,
    browser: (
        <>
            <rect x="3" y="4" width="18" height="16" rx="3" />
            <path d="M3 9h18M7 6.5h.01M10 6.5h.01" />
        </>
    ),
    spark: <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3zM18.5 16l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7.7-2z" />,
    phone: (
        <>
            <rect x="6.5" y="2.5" width="11" height="19" rx="2.5" />
            <path d="M11 18.5h2" />
        </>
    ),
    store: <path d="M4 9.5V20h16V9.5M3 5l1.5-2h15L21 5v2.5a2.5 2.5 0 0 1-4.5 1.5 2.5 2.5 0 0 1-4.5 0 2.5 2.5 0 0 1-4.5 0A2.5 2.5 0 0 1 3 7.5V5zM9.5 20v-5h5v5" />,
    cloud: <path d="M7 18.5a4.5 4.5 0 0 1-.6-8.96A6 6 0 0 1 18 9.2a4.7 4.7 0 0 1-.7 9.3H7z" />,
    layers: <path d="M12 3l9 4.5-9 4.5-9-4.5L12 3zM3 12l9 4.5 9-4.5M3 16.5L12 21l9-4.5" />,
} satisfies Record<string, ReactNode>

export type IconName = keyof typeof paths

interface IconProps {
    name: IconName
    className?: string
    strokeWidth?: number
}

export function Icon({ name, className, strokeWidth = 1.8 }: IconProps) {
    return (
        <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            className={cn('size-6', className)}
        >
            {paths[name]}
        </svg>
    )
}
