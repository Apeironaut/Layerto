import type { SelectHTMLAttributes } from 'react'
import { cn } from '../../lib/cn'
import { controlClass } from './controlStyles'

export interface SelectOption {
    value: string
    label: string
}

interface Props extends SelectHTMLAttributes<HTMLSelectElement> {
    options: SelectOption[]
}

export function Select({ options, className, ...props }: Props) {
    return (
        <select className={cn(controlClass, className)} {...props}>
            {options.map((o) => (
                <option key={o.value} value={o.value}>
                    {o.label}
                </option>
            ))}
        </select>
    )
}
