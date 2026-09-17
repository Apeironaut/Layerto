import type { InputHTMLAttributes } from 'react'
import { cn } from '../../lib/cn'
import { controlClass } from './controlStyles'

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
    return <input className={cn(controlClass, className)} {...props} />
}
