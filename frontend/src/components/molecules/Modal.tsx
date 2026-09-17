import { useEffect, useId, useRef, type ReactNode } from 'react'
import { Heading, Icon, Text } from '../atoms'

interface Props {
    open: boolean
    onClose: () => void
    title: string
    description?: string
    children: ReactNode
}

/** Native <dialog>: focus trap, Esc and inert background built in. */
export function Modal({ open, onClose, title, description, children }: Props) {
    const ref = useRef<HTMLDialogElement>(null)
    const titleId = useId()

    useEffect(() => {
        const dialog = ref.current
        if (!dialog) return
        if (open && !dialog.open) dialog.showModal()
        if (!open && dialog.open) dialog.close()
        document.documentElement.style.overflow = open ? 'hidden' : ''
    }, [open])

    return (
        <dialog
            ref={ref}
            aria-labelledby={titleId}
            onClose={onClose}
            onCancel={(e) => {
                e.preventDefault()
                onClose()
            }}
            onClick={(e) => e.target === ref.current && onClose()}
            className="m-auto max-h-dvh w-full max-w-2xl overflow-y-auto overscroll-contain bg-transparent p-4 text-ink open:animate-modal-in backdrop:bg-black/50 backdrop:backdrop-blur-sm open:backdrop:animate-fade-in"
        >
            <div className="rounded-3xl border border-t-4 border-line border-t-brand bg-page p-5 shadow-[0_2rem_5rem_rgb(0_0_0/0.3)] sm:p-9">
                <header className="mb-6 flex items-start justify-between gap-4">
                    <div>
                        <Heading level="card" className="mb-1.5 sm:text-3xl">
                            <span id={titleId}>{title}</span>
                        </Heading>
                        {description && <Text muted>{description}</Text>}
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="Close"
                        className="flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-full border border-line transition duration-300 hover:rotate-90 hover:border-brand"
                    >
                        <Icon name="close" strokeWidth={2} className="size-5" />
                    </button>
                </header>
                {children}
            </div>
        </dialog>
    )
}
