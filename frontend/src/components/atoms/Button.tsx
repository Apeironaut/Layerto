import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from 'react'
import { cn } from '../../lib/cn'

const base =
    'relative inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 overflow-hidden whitespace-nowrap rounded-full border font-semibold no-underline transition duration-250 ease-spring disabled:cursor-progress disabled:opacity-70'

const variants = {
    primary:
        'border-transparent bg-brand text-white hover:not-disabled:-translate-y-0.5 hover:not-disabled:shadow-[0_0.9rem_2rem_rgb(214_31_33/0.35)] before:absolute before:inset-0 before:-translate-x-full before:bg-[linear-gradient(115deg,transparent_30%,rgb(255_255_255/0.35)_50%,transparent_70%)] before:transition-transform before:duration-700 hover:before:translate-x-full',
    ghost: 'border-line text-ink hover:-translate-y-0.5 hover:border-ink',
    outline: 'border-line text-ink hover:border-brand hover:bg-brand hover:text-white',
}

const sizes = {
    sm: 'px-4 py-1.5 text-sm font-medium',
    md: 'px-6 py-3.5 text-base',
    lg: 'px-8 py-4 text-lg',
}

export type ButtonVariant = keyof typeof variants
export type ButtonSize = keyof typeof sizes

interface BaseProps {
    variant?: ButtonVariant
    size?: ButtonSize
    className?: string
    children: ReactNode
}

export type ButtonProps =
    | (BaseProps & AnchorHTMLAttributes<HTMLAnchorElement> & { href: string })
    | (BaseProps & ButtonHTMLAttributes<HTMLButtonElement> & { href?: never })

/** <a> when `href` is set, otherwise <button>. */
export function Button({ variant = 'primary', size = 'md', className, children, ...rest }: ButtonProps) {
    const classes = cn(base, variants[variant], sizes[size], className)
    const label = <span className="relative">{children}</span>

    if ('href' in rest && rest.href !== undefined) {
        return (
            <a className={classes} {...(rest as AnchorHTMLAttributes<HTMLAnchorElement>)}>
                {label}
            </a>
        )
    }
    const { type = 'button', ...props } = rest as ButtonHTMLAttributes<HTMLButtonElement>
    return (
        <button type={type} className={classes} {...props}>
            {label}
        </button>
    )
}
