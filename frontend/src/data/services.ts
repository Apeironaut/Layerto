import type { IconName } from '../components/atoms/Icon'

export interface Service {
    icon: IconName
    title: string
    body: string
    tags: string[]
}

export const services: Service[] = [
    { icon: 'browser', title: 'Web applications', body: 'Multi-tenant dashboards, portals and internal tools. React on the front, Go or Python behind it.', tags: ['React', 'Go', 'PostgreSQL'] },
    { icon: 'spark', title: 'AI integration', body: 'RAG assistants, document processing and LLM features wired into the systems you already run.', tags: ['RAG', 'LLMs', 'Vector search'] },
    { icon: 'phone', title: 'Mobile apps', body: 'Android and iOS apps that keep working when the connection drops.', tags: ['React Native', 'Offline-first'] },
    { icon: 'store', title: 'Business systems', body: 'POS, inventory, billing and booking software shaped around how your shop actually operates.', tags: ['POS', 'Inventory', 'Payments'] },
    { icon: 'cloud', title: 'Cloud & DevOps', body: 'Deployments, monitoring and cost control so the software stays up after launch.', tags: ['AWS', 'Docker', 'CI/CD'] },
]
