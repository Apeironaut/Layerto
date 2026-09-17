import type { ComponentPropsWithRef, ElementType, ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { container } from '../../lib/layout'

type Props<T extends ElementType> = {
    as?: T
    className?: string
    children: ReactNode
} & Omit<ComponentPropsWithRef<T>, 'as' | 'className' | 'children'>

/** Shared page width + edge padding. */
export function Container<T extends ElementType = 'div'>({ as, className, children, ...rest }: Props<T>) {
    const Tag: ElementType = as ?? 'div'
    return (
        <Tag className={cn(container, className)} {...rest}>
            {children}
        </Tag>
    )
}
