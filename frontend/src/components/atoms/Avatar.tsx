import { initials } from '../../lib/format'

interface Props {
    name: string
    src?: string
}

/** Photo, or initials when no photo. Turns brand red on parent card hover. */
export function Avatar({ name, src }: Props) {
    return (
        <div className="flex size-16 items-center justify-center overflow-hidden rounded-full bg-ink font-display text-xl font-bold text-page transition-colors duration-350 group-hover/card:bg-brand group-hover/card:text-white">
            {src ? <img src={src} alt="" className="size-full object-cover" /> : initials(name)}
        </div>
    )
}
