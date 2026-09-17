const ring = 'pointer-events-none absolute rounded-full border border-ring transition-colors'

export function AmbientRings() {
    return (
        <>
            <div
                aria-hidden="true"
                className={`${ring} size-[88vw] animate-[scale-in_1400ms_ease-out_200ms_both,breathe_7s_ease-in-out_1.6s_infinite] md:size-[min(64vw,52rem)]`}
            />
            <div
                aria-hidden="true"
                className={`${ring} size-[122vw] animate-[scale-in_1600ms_ease-out_350ms_both,breathe_9s_ease-in-out_2s_infinite_reverse] md:size-[min(82vw,68rem)]`}
            />
            {/* Red dot orbiting the inner ring */}
            <div
                aria-hidden="true"
                className="pointer-events-none absolute size-[88vw] animate-[orbit_22s_linear_infinite,scale-in_1200ms_ease-out_900ms_both] md:size-[min(64vw,52rem)]"
            >
                <span className="absolute -top-1 left-1/2 size-2 rounded-full bg-brand shadow-[0_0_1.2rem_rgb(214_31_33/0.7)]" />
            </div>
        </>
    )
}
