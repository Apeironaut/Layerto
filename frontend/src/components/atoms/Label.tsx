import type { ReactNode } from 'react'

interface Props {
    htmlFor: string
    required?: boolean
    children: ReactNode
}

export function Label({ htmlFor, required, children }: Props) {
    return (
        <label htmlFor={htmlFor} className="text-sm font-semibold">
            {children}
            {required && <span aria-hidden="true" className="ml-0.5 text-brand">*</span>}
        </label>
    )
}
