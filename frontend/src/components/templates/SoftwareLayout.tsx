import { useEffect, type ReactNode } from 'react'
import { site } from '../../config/site'
import type { Theme } from '../../hooks/useTheme'
import { loadStylesheet } from '../../lib/loadStylesheet'
import { GridBackdrop } from '../atoms'
import { EnquiryProvider, SiteFooter, SiteNav } from '../organisms'

interface Props {
    theme: Theme
    toggleTheme: () => void
    title: string
    children: ReactNode
}

/** Shell for the software site: providers, backdrop, nav, footer. */
export function SoftwareLayout({ theme, toggleTheme, title, children }: Props) {
    useEffect(() => {
        document.title = title
        loadStylesheet('font-display', site.fonts.display)
    }, [title])

    return (
        <div className="relative min-h-svh overflow-x-clip bg-page bg-[radial-gradient(60rem_40rem_at_85%_10%,var(--color-glow),transparent_60%)] text-ink">
            <GridBackdrop className="h-svh mask-[linear-gradient(black,transparent)]" />
            <EnquiryProvider>
                <SiteNav theme={theme} toggleTheme={toggleTheme} />
                <main>{children}</main>
                <SiteFooter />
            </EnquiryProvider>
        </div>
    )
}
