import type { ProcessStep } from '../../data/process'
import { Card, StepNumber, Text } from '../atoms'

interface Props {
    step: ProcessStep
    index: number
}

export function StepCard({ step, index }: Props) {
    return (
        <Card as="li" className="overflow-hidden">
            {/* Red line draws across when the parent Section reveals */}
            <span
                aria-hidden="true"
                style={{ transitionDelay: `${index * 180 + 200}ms` }}
                className="absolute top-0 left-0 h-1 w-full origin-left scale-x-0 bg-brand transition-transform duration-700 ease-spring group-data-[in=true]/section:scale-x-100"
            />
            <StepNumber value={index + 1} />
            <h3 className="mt-6 mb-2 text-xl font-semibold">{step.title}</h3>
            <Text muted>{step.body}</Text>
        </Card>
    )
}
