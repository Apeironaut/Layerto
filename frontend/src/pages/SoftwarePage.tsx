import { AboutPanel, ContactBanner, ProcessSteps, ServicesGrid, SoftwareHero, TeamGrid } from '../components/organisms'
import { SoftwareLayout } from '../components/templates'
import type { Theme } from '../hooks/useTheme'

interface Props {
    theme: Theme
    toggleTheme: () => void
}

export default function SoftwarePage(props: Props) {
    return (
        <SoftwareLayout {...props} title="Layerto Software — Custom software, built in layers">
            <SoftwareHero />
            <ServicesGrid />
            <ProcessSteps />
            <AboutPanel />
            <TeamGrid />
            <ContactBanner />
        </SoftwareLayout>
    )
}
