import { useRef } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import { Button, LayertoLogo, useMotionMode, usePointerTilt } from '@layerto/ui';
import { DASHBOARD_URL } from '../config';

export function SceneHero({ onNavigate }: { onNavigate: (path: string) => void }) {
  const mode = useMotionMode();
  const ref = useRef<HTMLElement>(null);
  const tilt = usePointerTilt(10, mode.finePointer);

  // Scroll-driven exit: as the hero scrolls away the logo rises and content fades (reversible).
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] });
  const logoY = useTransform(scrollYProgress, [0, 1], [0, mode.mobile ? -40 : -120]);
  const contentOpacity = useTransform(scrollYProgress, [0, 0.6], [1, 0]);
  const cueOpacity = useTransform(scrollYProgress, [0, 0.08], [1, 0]);
  // Shadow follows the tilt slightly.
  const shadowX = useTransform(tilt.rotateY, [-10, 10], [-14, 14]);

  const still = mode.reduced;

  return (
    <section
      ref={ref}
      id="hero"
      aria-labelledby="hero-title"
      onPointerMove={tilt.onPointerMove}
      onPointerLeave={tilt.onPointerLeave}
      className="relative w-full min-h-[100svh] flex flex-col items-center justify-center overflow-hidden bg-page px-5 pt-20 pb-24 text-center"
    >
      {/* Logo with CSS perspective tilt */}
      <motion.div
        className="relative perspective-[900px]"
        style={still ? undefined : { y: logoY }}
      >
        <motion.div
          className="transform-3d"
          style={still ? undefined : { rotateX: tilt.rotateX, rotateY: tilt.rotateY }}
        >
          <LayertoLogo size={mode.mobile ? 192 : 256} alt="Layerto logo" />
        </motion.div>
        {/* Soft shadow underneath */}
        <motion.div
          aria-hidden="true"
          className="absolute left-1/2 -bottom-6 h-6 w-[70%] -translate-x-1/2 rounded-[50%] bg-ink/25 blur-xl"
          style={still ? undefined : { x: shadowX }}
        />
      </motion.div>

      <motion.div
        className="mt-14 flex flex-col items-center"
        style={still ? undefined : { opacity: contentOpacity }}
      >
        <h1
          id="hero-title"
          className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight text-ink max-w-[20ch]"
        >
          The layer between AI and the real world.
        </h1>
        <p className="mt-6 text-base sm:text-lg text-muted max-w-[60ch]">
          Layerto sits between your software and AI. Layerto Vision turns images into answers from specialist
          models. Charon, coming soon, decides what AI agents are allowed to do. Every call is checked before it
          runs and recorded in a tamper-evident ledger.
        </p>
        <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
          <a
            href={DASHBOARD_URL}
            id="hero-try-vision-cta"
            className="no-underline inline-flex items-center justify-center px-6 py-3 rounded-control bg-crimson dark:bg-crimson-fill text-white font-semibold text-base hover:bg-crimson-hover dark:hover:bg-crimson border border-transparent dark:border-crimson-border shadow-l1 active:scale-[0.98] transition-colors cursor-pointer"
          >
            Try Layerto Vision
          </a>
          <Button variant="secondary" size="lg" onClick={() => onNavigate('/docs')} id="hero-read-docs-btn">
            Read the docs
          </Button>
        </div>
        <ul className="mt-8 flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-muted" aria-label="Key facts">
          {['50 free calls to start', 'Pay only for successful calls', 'Every call recorded'].map((fact) => (
            <li key={fact} className="inline-flex items-center gap-2">
              <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-crimson" />
              {fact}
            </li>
          ))}
        </ul>
      </motion.div>

      {/* Scroll cue */}
      <motion.a
        href="#what-we-do"
        aria-label="Scroll to What we do"
        onClick={(e) => {
          e.preventDefault();
          document.getElementById('what-we-do')?.scrollIntoView({ behavior: still ? 'auto' : 'smooth' });
        }}
        className="no-underline absolute bottom-6 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 text-xs text-muted cursor-pointer"
        style={still ? undefined : { opacity: cueOpacity }}
      >
        <span>Scroll</span>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="animate-scroll-cue">
          <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </motion.a>
    </section>
  );
}
