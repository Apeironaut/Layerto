import { LogoHero } from '../components/organisms'
import { LandingLayout } from '../components/templates'
import type { Theme } from '../hooks/useTheme'

interface Props {
    theme: Theme
    toggleTheme: () => void
}

export default function LandingPage(props: Props) {
    return (
        <LandingLayout {...props}>
            <LogoHero />
        </LandingLayout>
    )
}
