interface Props {
    title: string
    body: string
}

export function PillarItem({ title, body }: Props) {
    return (
        <li className="py-4 first:pt-0 last:pb-0">
            <p className="font-semibold">{title}</p>
            <p className="mt-1 text-sm leading-relaxed opacity-70">{body}</p>
        </li>
    )
}
