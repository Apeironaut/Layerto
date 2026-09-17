import { content } from '../../data/content'
import { pillars } from '../../data/pillars'
import { Card, Heading, IconBadge, Text } from '../atoms'
import { PillarItem, Section } from '../molecules'

export function AboutPanel() {
    const { title, paragraphs, pillarsTitle } = content.about

    return (
        <Section id="about">
            <div className="grid gap-3 lg:grid-cols-[1.1fr_0.9fr]">
                <Card padding="lg">
                    <Heading className="mb-6">{title}</Heading>
                    <div className="max-w-2xl space-y-5">
                        {paragraphs.map((p, i) => (
                            <Text key={p} size="xl" muted={i > 0}>{p}</Text>
                        ))}
                    </div>
                </Card>

                <Card variant="inverted" padding="lg">
                    <div className="mb-8 flex items-center gap-3">
                        <IconBadge icon="layers" tone="solid" className="size-11" />
                        <Heading as="h3" level="card">{pillarsTitle}</Heading>
                    </div>
                    <ul className="divide-y divide-page/15">
                        {pillars.map((pillar) => (
                            <PillarItem key={pillar.title} {...pillar} />
                        ))}
                    </ul>
                </Card>
            </div>
        </Section>
    )
}
