export interface ProcessStep {
    title: string
    body: string
}

export const processSteps: ProcessStep[] = [
    { title: 'Discover', body: 'A short call and a written scope. You know the cost before any code.' },
    { title: 'Design', body: 'Clickable screens to agree on before building.' },
    { title: 'Build', body: 'Agile, incremental development with regular releases to a staging link you can try yourself.' },
    { title: 'Launch & support', body: 'Deployment, handover and a support window after go-live.' },
]
