import { cn } from '../../lib/cn'
import { Heading, Text } from '../atoms'

interface Props {
    title: string
    intro?: string
    className?: string
}

export function SectionHeader({ title, intro, className }: Props) {
    return (
        <div className={cn('mb-8 max-w-2xl px-1', className)}>
            <Heading className="mb-3">{title}</Heading>
            {intro && <Text size="lg" muted>{intro}</Text>}
        </div>
    )
}
