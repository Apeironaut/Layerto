import type { Theme } from '../../hooks/useTheme'
import { cn } from '../../lib/cn'
import { Icon } from '../atoms'

interface Props {
    theme: Theme
    onToggle: () => void
    className?: string
}

export function ThemeToggle({ theme, onToggle, className }: Props) {
    const next = theme === 'light' ? 'dark' : 'light'

    return (
        <button type="button" onClick={onToggle} aria-label={`Switch to ${next} mode`} title={`Switch to ${next} mode`} className={cn('cursor-pointer p-2', className)}>
            <span className="relative block h-9.5 w-17.5 rounded-full border border-line bg-white/75 shadow-[0_0.7rem_2rem_rgb(24_18_20/0.1)] transition-colors dark:bg-[#19191c]/90 dark:shadow-[0_0.7rem_2rem_rgb(0_0_0/0.3)]">
                <span className="absolute top-1 left-1 flex size-7 items-center justify-center rounded-full bg-[#171719] text-[#f3f3f3] transition-transform duration-350 ease-out-expo dark:translate-x-8 dark:bg-[#f4f4f5] dark:text-[#171719]">
                    <Icon name={theme === 'light' ? 'moon' : 'sun'} className="size-4" />
                </span>
            </span>
        </button>
    )
}
