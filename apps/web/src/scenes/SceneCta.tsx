import { useRef } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import { LayertoLogo, useMotionMode } from '@layerto/ui';
import { DASHBOARD_URL } from '../config';

/** Scene 6: a large call-to-action card that flips in (rotateX) as it enters. */
export function SceneCta({ onNavigate }: { onNavigate: (path: string) => void }) {
  const mode = useMotionMode();
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'center center'] });
  const flip = Math.min(mode.maxRotate, 75);
  const rotateX = useTransform(scrollYProgress, [0, 1], [flip, 0]);
  const y = useTransform(scrollYProgress, [0, 1], [80, 0]);
  const opacity = useTransform(scrollYProgress, [0, 0.4], [0, 1]);

  return (
    <section ref={ref} aria-labelledby="cta-title" className="w-full bg-card py-[10vh] [perspective:1600px]">
      <motion.div
        className="w-[96vw] mx-auto min-h-[70svh] rounded-l1 bg-crimson dark:bg-crimson-fill text-white shadow-l3 px-6 sm:px-16 py-16 flex flex-col items-center justify-center text-center origin-bottom"
        style={mode.reduced ? undefined : { rotateX, y, opacity }}
      >
        <div className="rounded-l2 bg-white p-3 shadow-l2">
          <LayertoLogo size={80} />
        </div>
        <h2 id="cta-title" className="mt-8 text-4xl sm:text-6xl font-bold tracking-tight !text-white max-w-[18ch]">
          Start building on Layerto
        </h2>
        <p className="mt-5 text-lg text-white/85 max-w-[46ch]">
          Layerto Vision is live today and Charon is on the way. Create an account, get approved, and make your first call. The first 50 calls are free.
        </p>
        <div className="mt-10 flex flex-wrap justify-center gap-3">
          <a
            href={DASHBOARD_URL}
            className="no-underline inline-flex items-center px-7 py-3.5 rounded-control bg-white text-[#A3122A] font-semibold text-base hover:bg-white/90 active:scale-[0.98] transition-colors cursor-pointer"
          >
            Create an account
          </a>
          <button
            type="button"
            onClick={() => onNavigate('/docs')}
            className="inline-flex items-center px-7 py-3.5 rounded-control border border-white/40 text-white font-semibold text-base hover:bg-white/10 active:scale-[0.98] transition-colors cursor-pointer"
          >
            Read the docs
          </button>
        </div>
      </motion.div>
    </section>
  );
}
