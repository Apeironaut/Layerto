import { site } from '../../config/site'
import { Container } from '../atoms'

export function SiteFooter() {
    return (
        <footer className="border-t border-line">
            <Container className="flex justify-between py-6 text-sm text-muted">
                <span>© {new Date().getFullYear()} {site.name}</span>
                <a href={`mailto:${site.contactEmail}`} className="hover:text-brand">{site.contactEmail}</a>
            </Container>
        </footer>
    )
}
