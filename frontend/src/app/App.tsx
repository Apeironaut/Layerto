import { lazy, Suspense } from 'react'
import { useTheme } from '../hooks/useTheme'
import LandingPage from '../pages/LandingPage'

const SoftwarePage = lazy(() => import('../pages/SoftwarePage'))

// software.layerto.com (or /software locally) renders the services site
const isSoftwareSite =
    window.location.hostname.startsWith('software.') || window.location.pathname.startsWith('/software')

export default function App() {
    const themeProps = useTheme()

    return isSoftwareSite ? (
        <Suspense fallback={null}>
            <SoftwarePage {...themeProps} />
        </Suspense>
    ) : (
        <LandingPage {...themeProps} />
    )
}
