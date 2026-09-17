import { navLinks } from '../../data/navLinks'
import type { Theme } from '../../hooks/useTheme'
import { Container } from '../atoms'
import { BrandLink, NavLink, StartProjectButton, ThemeToggle } from '../molecules'

interface Props {
    theme: Theme
    toggleTheme: () => void
}

export function SiteNav({ theme, toggleTheme }: Props) {
    return (
        <header className="sticky top-0 z-20 border-b border-line bg-page/70 backdrop-blur-md">
            <Container className="flex items-center gap-2 py-2 sm:gap-6">
                <div className="mr-auto">
                    <BrandLink />
                </div>
                <nav aria-label="Primary" className="mr-1 hidden items-center gap-6 md:flex">
                    {navLinks.map((link) => (
                        <NavLink key={link.href} href={link.href}>{link.label}</NavLink>
                    ))}
                </nav>
                {/* Hero has the CTA on small screens */}
                <div className="hidden sm:block">
                    <StartProjectButton variant="outline" size="sm" />
                </div>
                <ThemeToggle theme={theme} onToggle={toggleTheme} />
            </Container>
        </header>
    )
}
