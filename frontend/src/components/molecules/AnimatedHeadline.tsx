import { Heading } from '../atoms'

interface Props {
    lines: string[]
    /** Index of the line shown in brand red */
    accentLine?: number
}

/** Display heading whose lines rise into view one after another. */
export function AnimatedHeadline({ lines, accentLine = lines.length - 1 }: Props) {
    return (
        <Heading as="h1" level="display" className="mb-6">
            {lines.map((line, i) => (
                <span key={line} className="block overflow-hidden pb-[0.08em]">
                    <span style={{ animationDelay: `${i * 140}ms` }} className={i === accentLine ? 'inline-block animate-rise text-brand' : 'inline-block animate-rise'}>
                        {line}
                    </span>
                </span>
            ))}
        </Heading>
    )
}
