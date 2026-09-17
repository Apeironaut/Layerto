import { content } from '../../data/content'
import { Button, Container, Text } from '../atoms'
import { AnimatedHeadline, StartProjectButton } from '../molecules'
import { LayerMark3D } from './LayerMark3D'

export function SoftwareHero() {
    const { headline, lead } = content.hero

    return (
        <Container as="section" className="relative grid items-center gap-8 py-12 lg:min-h-[calc(100svh-4rem)] lg:grid-cols-[1.1fr_0.9fr]">
            <div className="px-1 lg:pl-6">
                <AnimatedHeadline lines={headline} />
                <Text size="lg" muted className="mb-8 max-w-xl animate-fade-up [animation-delay:450ms]">{lead}</Text>
                <div className="flex animate-fade-up flex-wrap gap-6 [animation-delay:600ms]">
                    <StartProjectButton />
                    <Button variant="ghost" href="#services">See what we build</Button>
                </div>
            </div>

            <div className="relative order-first mx-auto aspect-square w-full max-w-md lg:order-none lg:max-w-none">
                <LayerMark3D fill={1} spread={0.5} depth={1.3} angle={{ x: 0.42, y: -0.5 }} label="Layerto mark in 3D. Hover to separate the layers." className="absolute! inset-0 cursor-grab" />
            </div>
        </Container>
    )
}
