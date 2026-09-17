import { site } from '../../config/site'
import { content } from '../../data/content'
import { Card, Heading, Text } from '../atoms'
import { Section, StartProjectButton } from '../molecules'

export function ContactBanner() {
    const { title, body } = content.contact

    return (
        <Section id="contact" className="pt-0 sm:pt-0">
            <Card variant="inverted" padding="lg" className="overflow-hidden">
                <div aria-hidden="true" className="pointer-events-none absolute -top-40 -right-40 size-[28rem] rounded-full bg-brand/35 blur-3xl" />
                <div className="relative grid items-end gap-8 lg:grid-cols-[1fr_auto]">
                    <div>
                        <Heading className="mb-4 sm:text-6xl">{title}</Heading>
                        <Text size="lg" className="max-w-xl opacity-70">{body}</Text>
                    </div>
                    <div className="flex flex-col items-start gap-3 lg:items-end">
                        <StartProjectButton size="lg" />
                        <a href={`mailto:${site.contactEmail}`} className="text-sm opacity-70 hover:text-brand hover:opacity-100">
                            or email {site.contactEmail}
                        </a>
                    </div>
                </div>
            </Card>
        </Section>
    )
}
