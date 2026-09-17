import type { ReactNode } from 'react'
import type { Theme } from '../../hooks/useTheme'
import { GridBackdrop } from '../atoms'
import { ThemeToggle } from '../molecules'

interface Props {
    theme: Theme
    toggleTheme: () => void
    children: ReactNode
}

export function LandingLayout({ theme, toggleTheme, children }: Props) {
    return (
        <div className="relative min-h-svh overflow-hidden bg-page bg-[radial-gradient(circle_at_50%_45%,var(--color-glow)_0,transparent_48%)] transition-colors duration-500">
            <GridBackdrop className="mask-[radial-gradient(circle_at_center,black,transparent_69%)]" />
            <ThemeToggle theme={theme} onToggle={toggleTheme} className="fixed top-4 right-4 z-10 sm:top-9 sm:right-11" />
            {children}
        </div>
    )
}
