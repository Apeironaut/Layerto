import type { TextareaHTMLAttributes } from 'react'
import { cn } from '../../lib/cn'
import { controlClass } from './controlStyles'

export function Textarea({ className, rows = 5, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
    return <textarea rows={rows} className={cn(controlClass, 'min-h-28 resize-y leading-relaxed', className)} {...props} />
}
