import { useRef } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import type { MotionValue } from 'framer-motion';
import { useMotionMode } from '@layerto/ui';

/**
 * Scene 5: about us. Lines reveal one by one with scroll; behind them, three
 * slabs in the logo's colours drift at different speeds (parallax depth).
 */

// TODO(owner): add founder details / team once ready. Keep copy factual.
const LINES = [
  'Apeironaut is an independent software studio.',
  'We build our own products, not client projects.',
  'Each one is the middle layer between people and technology.',
  'Layerto is the first, for AI.',
];

function Line({ text, index, progress }: { text: string; index: number; progress: MotionValue<number> }) {
  const start = 0.18 + index * 0.1;
  const opacity = useTransform(progress, [start, start + 0.1], [0.12, 1]);
  const y = useTransform(progress, [start, start + 0.1], [24, 0]);
  return (
    <motion.p className="text-2xl sm:text-4xl lg:text-5xl font-bold tracking-tight leading-tight" style={{ opacity, y }}>
      {text}
    </motion.p>
  );
}

const SLABS = [
  { cls: 'bg-[#15161A] dark:bg-[#2A2C33]', pos: 'top-[8%] -left-[6vw] w-[46vw] h-[22vh]', speed: -180, rot: -8 },
  { cls: 'bg-crimson', pos: 'top-[42%] -right-[8vw] w-[40vw] h-[18vh]', speed: -320, rot: 6 },
  { cls: 'bg-[#6E0E1C]', pos: 'bottom-[4%] left-[18vw] w-[34vw] h-[16vh]', speed: -460, rot: -4 },
];

function Slab({ s, progress }: { s: (typeof SLABS)[number]; progress: MotionValue<number> }) {
  const y = useTransform(progress, [0, 1], [0, s.speed]);
  return (
    <motion.div
      aria-hidden="true"
      className={`absolute rounded-l1 opacity-[0.14] dark:opacity-25 ${s.cls} ${s.pos}`}
      style={{ y, rotate: s.rot }}
    />
  );
}

export function SceneAbout() {
  const mode = useMotionMode();
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] });

  return (
    <section
      ref={ref}
      id="about"
      aria-labelledby="about-title"
      className="relative w-full min-h-[110svh] bg-page overflow-hidden flex items-center"
    >
      {!mode.reduced && SLABS.map((s, i) => <Slab key={i} s={s} progress={scrollYProgress} />)}
      <div className="relative w-full px-6 sm:px-[8vw] py-24">
        <h2 id="about-title" className="text-sm font-semibold text-crimson mb-8">
          About us
        </h2>
        <div className="flex flex-col gap-5 max-w-[min(100%,60rem)]">
          {mode.reduced
            ? LINES.map((t) => (
                <p key={t} className="text-2xl sm:text-4xl font-bold tracking-tight leading-tight">
                  {t}
                </p>
              ))
            : LINES.map((t, i) => <Line key={t} text={t} index={i} progress={scrollYProgress} />)}
        </div>
      </div>
    </section>
  );
}
