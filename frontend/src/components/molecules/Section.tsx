import type { ReactNode } from 'react'
import { useInView } from '../../hooks/useInView'
import { cn } from '../../lib/cn'
import { Container } from '../atoms'
import { SectionHeader } from './SectionHeader'

interface Props {
    id?: string
    title?: string
    intro?: string
    className?: string
    children: ReactNode
}

/**
 * Page band: container, optional header and a one-time scroll reveal.
 * Children can react with `group-data-[in=true]/section:*`.
 */
export function Section({ id, title, intro, className, children }: Props) {
    const { ref, inView } = useInView<HTMLElement>()

    return (
        <Container
            as="section"
            ref={ref}
            id={id}
            data-in={inView}
            className={cn(
                'group/section scroll-mt-16 py-12 transition duration-900 ease-out-expo sm:py-20',
                inView ? 'translate-y-0 opacity-100' : 'translate-y-6 opacity-0',
                className,
            )}
        >
            {title && <SectionHeader title={title} intro={intro} />}
            {children}
        </Container>
    )
}
