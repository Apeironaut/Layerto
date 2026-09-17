import { content } from '../../data/content'
import { team } from '../../data/team'
import { Section, TeamCard } from '../molecules'

export function TeamGrid() {
    return (
        <Section id="team" {...content.team}>
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
                {team.map((member) => (
                    <TeamCard key={member.name} member={member} />
                ))}
            </ul>
        </Section>
    )
}
