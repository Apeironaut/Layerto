export function FieldError({ id, message }: { id: string; message?: string }) {
    return (
        <p id={id} role={message ? 'alert' : undefined} className="min-h-4.5 text-xs text-brand">
            {message}
        </p>
    )
}
