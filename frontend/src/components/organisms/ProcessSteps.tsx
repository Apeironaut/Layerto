import { content } from '../../data/content'
import { processSteps } from '../../data/process'
import { Section, StepCard } from '../molecules'

export function ProcessSteps() {
    return (
        <Section id="process" {...content.process}>
            <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {processSteps.map((step, i) => (
                    <StepCard key={step.title} step={step} index={i} />
                ))}
            </ol>
        </Section>
    )
}
