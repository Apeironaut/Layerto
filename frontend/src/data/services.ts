import type { IconName } from '../components/atoms/Icon'

export interface Service {
    icon: IconName
    title: string
    body: string
    tags: string[]
}

export const services: Service[] = [
    { icon: 'browser', title: 'Web applications', body: 'Scalable, high-efficiency web platforms built to handle real traffic and grow with your business.', tags: ['React', 'Go', 'PostgreSQL', 'Java', 'AWS'] },
    { icon: 'spark', title: 'AI integration', body: 'Chatbot development, RAG assistants and LLM features (GPT, Claude, Gemini and more), plus computer vision wired into the systems you already run.', tags: ['RAG', 'LLM Integration', 'Agentic-AI', 'Chatbots', 'Computer Vision'] },
    { icon: 'phone', title: 'Mobile apps', body: 'High-efficiency, cross-platform mobile applications that keep working when the connection drops.', tags: ['React Native', 'Firebase'] },
    { icon: 'cloud', title: 'Cloud & DevOps', body: 'Cloud infrastructure, CI/CD pipelines, containerized deployments and monitoring, built for high performance, strong uptime and scalable, reliable traffic handling.', tags: ['AWS', 'Docker', 'CI/CD'] },
]
