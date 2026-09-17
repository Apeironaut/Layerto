import type { ElementType, ReactNode } from 'react'
import { cn } from '../../lib/cn'

const variants = {
    default: 'border border-line bg-surface',
    inverted: 'bg-ink text-page',
}

const paddings = {
    sm: 'p-5 sm:p-6',
    md: 'p-6 sm:p-8',
    lg: 'p-8 sm:p-12 lg:p-16',
}

interface CardProps {
    as?: ElementType
    variant?: keyof typeof variants
    padding?: keyof typeof paddings
    /** Lift + brand border on hover; children can use group-hover/card: */
    interactive?: boolean
    className?: string
    children: ReactNode
}

export function Card({ as: Tag = 'div', variant = 'default', padding = 'md', interactive, className, children }: CardProps) {
    return (
        <Tag
            className={cn(
                'relative rounded-3xl backdrop-blur-sm',
                variants[variant],
                paddings[padding],
                interactive &&
                    'group/card transition duration-400 ease-spring hover:-translate-y-1.5 hover:border-brand/45 hover:shadow-[0_1.5rem_3rem_-1.5rem_rgb(214_31_33/0.35)]',
                className,
            )}
        >
            {children}
        </Tag>
    )
}
