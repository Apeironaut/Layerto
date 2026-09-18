import { content } from '../../data/content'
import { Card, Heading, Text } from '../atoms'
import { Section } from '../molecules'

export function AboutPanel() {
    const { title, paragraphs } = content.about

    return (
        <Section id="about">
            <Card padding="md" className="mx-auto max-w-6xl text-center">
                <Heading className="mb-8">{title}</Heading>
                <div className="mx-auto max-w-4xl space-y-3">
                    {paragraphs.map((p, i) => (
                        <Text key={p} size="xl" muted={i > 0}>{p}</Text>
                    ))}
                </div>
            </Card>
        </Section>
    )
}
