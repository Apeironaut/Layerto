import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'

const levels = {
    display: 'font-display text-[clamp(2.8rem,7vw,6rem)] leading-[0.95] font-bold tracking-[-0.035em]',
    section: 'font-display text-4xl leading-none font-bold tracking-tight sm:text-5xl',
    card: 'font-display text-2xl font-bold tracking-tight',
    item: 'font-display text-xl font-bold',
}

interface HeadingProps {
    as?: 'h1' | 'h2' | 'h3' | 'h4'
    level?: keyof typeof levels
    className?: string
    children: ReactNode
}

export function Heading({ as: Tag = 'h2', level = 'section', className, children }: HeadingProps) {
    return <Tag className={cn(levels[level], className)}>{children}</Tag>
}
