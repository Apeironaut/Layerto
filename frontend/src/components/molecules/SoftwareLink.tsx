import { site } from '../../config/site'

/** Pill link from the landing page to the software site. */
export function SoftwareLink() {
    return (
        <a
            href={site.softwareUrl}
            className="group/link absolute bottom-[clamp(1.5rem,5vh,3rem)] left-1/2 z-3 inline-flex -translate-x-1/2 animate-[fade-in_800ms_ease_1500ms_both] items-center gap-2.5 rounded-full border border-line px-5 py-3 text-xs whitespace-nowrap text-ink no-underline opacity-75 transition hover:border-brand/50 hover:bg-brand/8 hover:opacity-100 sm:text-sm"
        >
            <span aria-hidden="true" className="size-2 rounded-full bg-brand transition-transform group-hover/link:scale-160" />
            Need custom software? Visit Layerto Software
        </a>
    )
}
