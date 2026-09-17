import { useEffect, useRef } from 'react'

/**
 * Writes pointer position into CSS variables on the element:
 * --px / --py in −0.5…0.5 (for tilt) and --mx / --my in px (for glows).
 * No React re-renders — Tailwind classes read the variables.
 */
export function usePointerVars<T extends HTMLElement>() {
    const ref = useRef<T>(null)

    useEffect(() => {
        const el = ref.current
        if (!el || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

        let frame = 0
        const set = (vars: Record<string, string>) =>
            Object.entries(vars).forEach(([k, v]) => el.style.setProperty(k, v))

        const onMove = (e: PointerEvent) => {
            cancelAnimationFrame(frame)
            frame = requestAnimationFrame(() => {
                const r = el.getBoundingClientRect()
                set({
                    '--px': ((e.clientX - r.left) / r.width - 0.5).toFixed(3),
                    '--py': ((e.clientY - r.top) / r.height - 0.5).toFixed(3),
                    '--mx': `${e.clientX - r.left}px`,
                    '--my': `${e.clientY - r.top}px`,
                })
            })
        }
        const onLeave = () => set({ '--px': '0', '--py': '0' })

        el.addEventListener('pointermove', onMove)
        el.addEventListener('pointerleave', onLeave)
        return () => {
            cancelAnimationFrame(frame)
            el.removeEventListener('pointermove', onMove)
            el.removeEventListener('pointerleave', onLeave)
        }
    }, [])

    return ref
}
