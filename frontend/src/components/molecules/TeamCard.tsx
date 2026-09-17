import type { TeamMember } from '../../data/team'
import { Avatar, Card, Heading, Text } from '../atoms'

export function TeamCard({ member }: { member: TeamMember }) {
    return (
        <Card as="li" interactive padding="sm">
            <div className="mb-5">
                <Avatar name={member.name} src={member.photo} />
            </div>
            <Heading as="h3" level="item" className="mb-1">{member.name}</Heading>
            <p className="mb-3 text-sm font-semibold text-brand">{member.role}</p>
            <Text size="sm" muted>{member.focus}</Text>
            {member.links && member.links.length > 0 && (
                <div className="mt-4 flex gap-4">
                    {member.links.map((link) => (
                        <a key={link.href} href={link.href} target="_blank" rel="noreferrer" className="text-sm underline underline-offset-3 hover:text-brand">
                            {link.label}
                        </a>
                    ))}
                </div>
            )}
        </Card>
    )
}
