import { usePointerVars } from '../../hooks/usePointerVars'
import { AmbientRings } from './AmbientRings'
import { LogoLockup } from './LogoLockup'
import { SoftwareLink } from '../molecules'

export function LogoHero() {
    const ref = usePointerVars<HTMLElement>()

    return (
        <main ref={ref} aria-label="Layerto" className="group/hero relative flex min-h-svh items-center justify-center px-5 py-20 sm:px-[6vw]">
            {/* Cursor-following glow */}
            <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_var(--mx,50%)_var(--my,50%),rgb(214_31_33/0.13),transparent_22rem)] opacity-0 transition-opacity duration-500 group-hover/hero:opacity-100"
            />
            <AmbientRings />

            {/* Tilts toward the pointer */}
            <div className="relative z-2 flex justify-center transition-transform duration-700 ease-spring [transform:perspective(90rem)_rotateY(calc(var(--px,0)*7deg))_rotateX(calc(var(--py,0)*-6deg))_translate3d(calc(var(--px,0)*-1.2rem),calc(var(--py,0)*-0.8rem),0)]">
                <LogoLockup />
            </div>

            <SoftwareLink />
        </main>
    )
}
