import wordmark from '../../assets/layerto-wordmark.png'
import wordmarkDark from '../../assets/layerto-wordmark-dark.png'
import { LayerMark3D } from './LayerMark3D'

const wordmarkImg = 'pointer-events-none z-1 block h-auto w-full select-none transition-opacity duration-500'

export function LogoLockup() {
    return (
        <div className="relative z-2 grid w-[88vw] max-w-lg grid-cols-1 items-center md:w-[min(91vw,82rem)] md:max-w-7xl md:grid-cols-[minmax(10rem,31.6fr)_minmax(20rem,68.4fr)]">
            {/* 3D symbol */}
            <div className="group/symbol relative z-2 mx-auto -mb-[14%] flex w-[48%] animate-symbol-in items-center justify-center transition-[filter] duration-500 hover:drop-shadow-[0_2rem_2.4rem_rgb(216_29_31/0.22)] md:m-0 md:w-auto">
                <LayerMark3D
                    intro
                    follow={0.6}
                    fill={1.08}
                    spread={0.2}
                    depth={1.3}
                    angle={{ x: 0.42, y: -0.5 }}
                    label="Layerto layered symbol in 3D. Hover to separate the layers."
                    className="z-1 aspect-650/764 w-full"
                />
                {/* Floor shadow */}
                <span
                    aria-hidden="true"
                    className="pointer-events-none absolute bottom-[9%] left-[18%] h-[7%] w-[66%] bg-[radial-gradient(closest-side,rgb(20_10_12/0.28),transparent)] transition duration-500 ease-spring group-hover/symbol:scale-x-110 group-hover/symbol:opacity-70 dark:bg-[radial-gradient(closest-side,rgb(0_0_0/0.6),transparent)]"
                />
            </div>

            {/* Wordmark with light/dark crossfade and hover sweep */}
            <div className="group/word relative z-1 flex cursor-pointer items-center justify-center animate-wordmark-in transition duration-500 ease-spring md:-ml-[1.8%] hover:[transform:perspective(70rem)_rotateY(3deg)_translateX(0.65rem)_scale(1.012)] hover:drop-shadow-[0_1.1rem_1.25rem_rgb(18_18_20/0.17)] dark:hover:drop-shadow-[0_1.1rem_1.25rem_rgb(0_0_0/0.42)]">
                <img src={wordmark} alt="Layerto" width="1407" height="764" className={`${wordmarkImg} relative opacity-100 dark:opacity-0`} />
                <img src={wordmarkDark} alt="" aria-hidden="true" width="1407" height="764" className={`${wordmarkImg} absolute inset-0 opacity-0 dark:opacity-100`} />
                <span
                    aria-hidden="true"
                    className="pointer-events-none absolute top-[28%] left-0 z-3 h-[44%] w-[45%] -translate-x-1/4 bg-[linear-gradient(90deg,transparent,rgb(221_31_32/0.15),transparent)] opacity-0 transition duration-700 group-hover/word:translate-x-[175%] group-hover/word:opacity-100"
                />
            </div>
        </div>
    )
}
