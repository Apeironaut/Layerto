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
        name: 'Naveen',
        role: 'Founder & AI Engineer',
        focus: 'Machine learning, NLP and computer vision. Leads architecture and the AI middle-layer research.',
        links: [{ label: 'Hugging Face', href: 'https://huggingface.co/Naviya-C' }],
    },
    {
        name: 'Janitha Dilsham',
        role: 'DevOps & Cloud Engineer',
        focus: 'TODO: cloud infrastructure, CI/CD and keeping production stable.',
        links: [],
    },
    {
        name: 'Thareesha Marasinghe',
        role: 'Software & AI Engineer',
        focus: 'TODO: short line about focus and strengths.',
        links: [],
    },
    {
        name: 'Mayura Pabasara',
        role: 'Software Engineer',
        focus: 'TODO: short line about focus and strengths.',
        links: [],
    },
    {
        name: 'Imesh Rajakaruna',
        role: 'Software Engineer',
        focus: 'TODO: short line about focus and strengths.',
        links: [],
    },
]
