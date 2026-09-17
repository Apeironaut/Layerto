import { easing, fonts, palette, themes } from './tokens'

const themeColors = Object.fromEntries(Object.keys(themes.light).map((name) => [name, `var(--color-${name})`]))

export default {
    // `dark:` follows <html data-theme="dark">
    darkMode: ['variant', '&:where([data-theme="dark"], [data-theme="dark"] *)'],
    theme: {
        extend: {
            colors: { brand: palette.brand, 'brand-deep': palette.brandDeep, ...themeColors },
            fontFamily: fonts,
            transitionTimingFunction: easing,
            keyframes: {
                'fade-in': { from: { opacity: '0' } },
                'fade-up': { from: { opacity: '0', transform: 'translateY(1rem)' } },
                'wipe-in': { from: { clipPath: 'inset(0 100% 0 0)', opacity: '0.2' } },
                'scale-in': { from: { opacity: '0', scale: '0.85' } },
                breathe: { '50%': { scale: '1.025' } },
                orbit: { to: { rotate: '360deg' } },
                rise: { from: { transform: 'translateY(105%)' } },
                draw: { from: { strokeDashoffset: '1' } },
            },
            animation: {
                'symbol-in': 'fade-in 900ms ease 100ms both',
                'wordmark-in': 'wipe-in 1100ms cubic-bezier(0.7, 0, 0.2, 1) 550ms both',
                rise: `rise 1000ms ${easing['out-expo']} both`,
                'fade-up': 'fade-up 900ms ease both',
                'fade-in': 'fade-in 300ms ease',
                'modal-in': `fade-up 380ms ${easing['out-expo']}`,
                draw: `draw 600ms ${easing.spring} 150ms both`,
            },
        },
    },
}
