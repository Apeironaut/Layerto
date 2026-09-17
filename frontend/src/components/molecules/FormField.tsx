import { cn } from '../../lib/cn'
import { FieldError, Input, Label, Select, Textarea, type SelectOption } from '../atoms'

export type ControlProps =
    | { as?: 'input'; type?: 'text' | 'email' | 'tel'; autoComplete?: string; placeholder?: string }
    | { as: 'textarea'; rows?: number; placeholder?: string }
    | { as: 'select'; options: SelectOption[] }

type Props = ControlProps & {
    id: string
    label: string
    value: string
    error?: string
    required?: boolean
    onChange: (value: string) => void
    onBlur?: () => void
    className?: string
}

/** Label + control + error, wired for accessibility. */
export function FormField(props: Props) {
    const { id, label, value, error, required, onChange, onBlur, className } = props
    const errorId = `${id}-error`
    const a11y = {
        id,
        name: id,
        value,
        required,
        onBlur,
        'aria-invalid': Boolean(error),
        'aria-describedby': error ? errorId : undefined,
    }

    return (
        <div className={cn('flex flex-col gap-1.5', className)}>
            <Label htmlFor={id} required={required}>{label}</Label>
            {props.as === 'textarea' ? (
                <Textarea {...a11y} rows={props.rows} placeholder={props.placeholder} onChange={(e) => onChange(e.target.value)} />
            ) : props.as === 'select' ? (
                <Select {...a11y} options={props.options} onChange={(e) => onChange(e.target.value)} />
            ) : (
                <Input {...a11y} type={props.type ?? 'text'} autoComplete={props.autoComplete} placeholder={props.placeholder} onChange={(e) => onChange(e.target.value)} />
            )}
            <FieldError id={errorId} message={error} />
        </div>
    )
}
