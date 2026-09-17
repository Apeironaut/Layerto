import type { ReactNode } from 'react'

/** Text link with a brand underline that sweeps in on hover. */
export function NavLink({ href, children }: { href: string; children: ReactNode }) {
    return (
        <a
            href={href}
            className="relative text-sm no-underline after:absolute after:-bottom-1 after:left-0 after:h-0.5 after:w-full after:origin-right after:scale-x-0 after:bg-brand after:transition-transform after:duration-300 hover:after:origin-left hover:after:scale-x-100"
        >
            {children}
        </a>
    )
}
