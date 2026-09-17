import { themes, type ThemeName } from './tokens'

/** Global element styling that would otherwise live in a CSS base layer. */
const rootClasses = [
    'scroll-smooth bg-page font-sans text-ink antialiased transition-colors duration-500',
    'selection:bg-brand selection:text-white',
    '[&_:focus-visible]:outline-3 [&_:focus-visible]:outline-offset-4 [&_:focus-visible]:outline-brand/35',
    'motion-reduce:[&_*]:animate-none! motion-reduce:[&_*]:transition-none!',
].join(' ')

/** Writes theme tokens as CSS variables on <html>. Call before first render to avoid a flash. */
export function applyTheme(theme: ThemeName) {
    const root = document.documentElement
    Object.entries(themes[theme]).forEach(([name, value]) => root.style.setProperty(`--color-${name}`, value))
    root.style.colorScheme = theme
    root.dataset.theme = theme
    root.className = rootClasses
}
