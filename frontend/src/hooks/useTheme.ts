import { useEffect, useState } from 'react'
import { applyTheme } from '../theme/applyTheme'
import type { ThemeName } from '../theme/tokens'

export type Theme = ThemeName

const STORAGE_KEY = 'layerto-theme'

export function getInitialTheme(): Theme {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved === 'light' || saved === 'dark') return saved
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function useTheme() {
    const [theme, setTheme] = useState<Theme>(getInitialTheme)

    useEffect(() => {
        applyTheme(theme)
        localStorage.setItem(STORAGE_KEY, theme)
    }, [theme])

    return { theme, toggleTheme: () => setTheme((t) => (t === 'light' ? 'dark' : 'light')) }
}
