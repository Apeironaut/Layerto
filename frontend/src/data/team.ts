// To add a photo: put it in src/assets/team/ and import it, e.g.
//   import janitha from '../assets/team/janitha.jpg'   →   photo: janitha
// Initials show when photo is missing. Links are optional.
export interface TeamLink {
    label: string
    href: string
}

export interface TeamMember {
    name: string
    role: string
    focus: string
    photo?: string
    links?: TeamLink[]
}

export const team: TeamMember[] = [
    {
        name: 'Naveen Chethiya',
        role: 'Founder & AI/ML Engineer',
        focus: 'Machine learning, NLP and computer vision. Leads architecture and the AI middle-layer research.',
        links: [{ label: 'Hugging Face', href: 'https://huggingface.co/Naviya-C' }],
    },
    {
        name: 'Janitha Dilsham',
        role: 'Co-founder & Cloud Engineer',
        focus: 'Cloud infrastructure, CI/CD pipelines and deployments. Keeps production stable, scalable and cost-efficient.',
        links: [],
    },
    {
        name: 'Thareesha Marasinghe',
        role: 'Co-founder & Software Engineer',
        focus: 'Full-stack development across web and backend systems, turning product requirements into reliable, well-tested software.',
        links: [],
    },
    {
        name: 'Mayura Pabasara',
        role: 'Co-founder & Software Engineer',
        focus: 'Full-stack development, building clean, maintainable interfaces and the APIs that power them.',
        links: [],
    },
    {
        name: 'Imesh Rajakaruna',
        role: 'Co-founder & Software Engineer',
        focus: 'Full-stack development, focused on solid engineering fundamentals and shipping features end to end.',
        links: [],
    },
]
