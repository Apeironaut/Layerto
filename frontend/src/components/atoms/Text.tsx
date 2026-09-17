import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'

const sizes = {
    sm: 'text-sm leading-relaxed',
    md: 'text-base leading-relaxed',
    lg: 'text-lg leading-relaxed',
    xl: 'text-lg leading-relaxed sm:text-xl',
}

interface TextProps {
    size?: keyof typeof sizes
    muted?: boolean
    className?: string
    children: ReactNode
}

export function Text({ size = 'md', muted, className, children }: TextProps) {
    return <p className={cn(sizes[size], muted && 'text-muted', className)}>{children}</p>
}
