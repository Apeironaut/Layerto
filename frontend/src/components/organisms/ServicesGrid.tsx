import { content } from '../../data/content'
import { services } from '../../data/services'
import { Section, ServiceCard } from '../molecules'

// 6-column grid: first three cards take a third each, the last two take half each
const spans = ['lg:col-span-2', 'lg:col-span-2', 'lg:col-span-2', 'lg:col-span-3', 'lg:col-span-3']

export function ServicesGrid() {
    return (
        <Section id="services" {...content.services}>
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
                {services.map((service, i) => (
                    <ServiceCard key={service.title} service={service} className={spans[i]} />
                ))}
            </ul>
        </Section>
    )
}
