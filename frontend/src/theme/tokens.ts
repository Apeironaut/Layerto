/** Design tokens — single source for colours, fonts and motion. */

export const palette = {
    brand: '#d61f21',
    brandDeep: '#8f1214',
}

/** Theme-aware colours, exposed to Tailwind as CSS variables (bg-page, text-ink, …). */
export const themes = {
    light: {
        page: '#f5f5f3',
        ink: '#151517',
        muted: '#5d5d64',
        line: 'rgb(18 18 20 / 0.14)',
        ring: 'rgb(18 18 20 / 0.08)',
        grid: 'rgb(18 18 20 / 0.045)',
        surface: 'rgb(255 255 255 / 0.6)',
        glow: 'rgb(214 31 33 / 0.1)',
    },
    dark: {
        page: '#0b0b0d',
        ink: '#ededf0',
        muted: '#9c9ca5',
        line: 'rgb(255 255 255 / 0.17)',
        ring: 'rgb(255 255 255 / 0.08)',
        grid: 'rgb(255 255 255 / 0.045)',
        surface: 'rgb(28 28 32 / 0.6)',
        glow: 'rgb(210 25 28 / 0.14)',
    },
} as const

export type ThemeName = keyof typeof themes
export type ThemeColor = keyof (typeof themes)['light']

export const fonts = {
    sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
    display: ['Poppins', 'ui-sans-serif', 'system-ui', 'sans-serif'],
}

export const easing = {
    spring: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
    'out-expo': 'cubic-bezier(0.16, 1, 0.3, 1)',
}
