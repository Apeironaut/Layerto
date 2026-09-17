import type { Service } from '../../data/services'
import { cn } from '../../lib/cn'
import { Card, Heading, IconBadge, Tag, Text } from '../atoms'

export function ServiceCard({ service, className }: { service: Service; className?: string }) {
    return (
        <Card as="li" interactive className={cn('flex flex-col', className)}>
            <IconBadge icon={service.icon} className="mb-8" />
            <Heading as="h3" level="card" className="mb-2">{service.title}</Heading>
            <Text muted className="mb-6">{service.body}</Text>
            <div className="mt-auto flex flex-wrap gap-2">
                {service.tags.map((tag) => (
                    <Tag key={tag}>{tag}</Tag>
                ))}
            </div>
        </Card>
    )
}
