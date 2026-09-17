import { cn } from '../../lib/cn'
import { Icon, type IconName } from './Icon'

const tones = {
    soft: 'bg-brand/10 text-brand group-hover/card:bg-brand group-hover/card:text-white',
    solid: 'bg-brand text-white',
}

interface Props {
    icon: IconName
    tone?: keyof typeof tones
    className?: string
}

export function IconBadge({ icon, tone = 'soft', className }: Props) {
    return (
        <span className={cn('flex size-12 shrink-0 items-center justify-center rounded-2xl transition-colors duration-300', tones[tone], className)}>
            <Icon name={icon} />
        </span>
    )
}
