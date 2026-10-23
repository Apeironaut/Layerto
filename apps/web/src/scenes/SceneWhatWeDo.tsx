import { useRef } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import type { MotionValue } from 'framer-motion';
import { useMotionMode } from '@layerto/ui';
import type { MotionMode } from '@layerto/ui';

/**
 * Scene 2: "What we do". A pinned scene: three full-width cards start stacked like the
 * logo's slabs (Route = black top, Control = red middle, Meter = dark red bottom), then
 * fan out one by one in 3D as the page scrolls. Every value is driven by scroll position,
 * so scrolling up reverses it.
 */

const LAYERS = [
  {
    key: 'route',
    title: 'Route',
    body: 'Each request goes to the right AI. Name a model directly, or describe what you need and Layerto picks it.',
    detail: 'Layerto Vision: POST /v1/vision/auto',
    tone: 'bg-[#15161A] text-white border-white/10',
  },
  {
    key: 'control',
    title: 'Control',
    body: 'Keys, permissions and balance are checked before anything runs. With Charon, AI agents get the same checks before every action.',
    detail: 'Keys · rules · approvals · prepaid balance',
    tone: 'bg-[#A3122A] text-white border-white/15',
  },
  {
    key: 'meter',
    title: 'Meter',
    body: 'Every call is recorded in a tamper-evident ledger, so you can prove later what happened and what it cost.',
    detail: 'Hash-chained usage ledger',
    tone: 'bg-[#6E0E1C] text-white border-white/10',
  },
] as const;

// Scroll windows (0..1 of the pinned section) in which each card fans out.
const WINDOWS: [number, number][] = [
  [0.1, 0.38],
  [0.36, 0.64],
  [0.62, 0.9],
];

function LayerCard({
  index,
  progress,
  mode,
}: {
  index: number;
  progress: MotionValue<number>;
  mode: MotionMode;
}) {
  const layer = LAYERS[index];
  const [a, b] = WINDOWS[index];
  const mid = (a + b) / 2;
  const slot = index - 1; // -1, 0, 1 → final vertical slot
  const spread = 24; // vh between settled cards (cards are 21vh tall)
  const tiltMax = Math.min(mode.maxRotate, 58);

  // stacked → pulled forward (active) → settled flat in its slot
  const y = useTransform(progress, [a, mid, b], [`${slot * 2.5}vh`, `${slot * spread * 0.6}vh`, `${slot * spread}vh`]);
  const rotateX = useTransform(progress, [a, mid, b], [tiltMax, 0, 0]);
  // Forward "active" pop stays within the viewport: 96vw × 1400/(1400-50) ≈ 99.5vw.
  const z = useTransform(progress, [a, mid, b], [-index * 60 * mode.depth, 50 * mode.depth, 0]);
  const scale = useTransform(progress, [a, mid, b], [0.9, 1, 1]);
  const textOpacity = useTransform(progress, [a, a + (mid - a) * 0.7], [0, 1]);

  return (
    <motion.article
      aria-labelledby={`layer-${layer.key}`}
      className={`absolute inset-x-0 top-0 mx-auto w-[96vw] h-[21vh] rounded-l1 border shadow-l3 px-6 sm:px-12 flex items-center overflow-hidden ${layer.tone}`}
      style={{ y, rotateX, z, scale, zIndex: 3 - index }}
    >
      <motion.div className="w-full flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-12" style={{ opacity: textOpacity }}>
        <h3 id={`layer-${layer.key}`} className="text-2xl sm:text-5xl font-bold tracking-tight !text-white sm:w-[28%] shrink-0">
          {layer.title}
        </h3>
        <div className="flex-1">
          <p className="text-sm sm:text-lg text-white/90 max-w-[60ch]">{layer.body}</p>
          <p className="mt-1 sm:mt-2 font-mono text-xs sm:text-sm text-white/60 hidden sm:block">{layer.detail}</p>
        </div>
      </motion.div>
    </motion.article>
  );
}

export function SceneWhatWeDo() {
  const mode = useMotionMode();
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end end'] });
  const introOpacity = useTransform(scrollYProgress, [0, 0.5, 0.9], [1, 1, 0.5]);

  if (mode.reduced) {
    return (
      <section id="what-we-do" aria-labelledby="wwd-title" className="w-full bg-card py-20 px-4">
        <h2 id="wwd-title" className="text-3xl sm:text-5xl font-bold tracking-tight text-center mb-10">
          What we do
        </h2>
        <div className="flex flex-col gap-4">
          {LAYERS.map((l) => (
            <article key={l.key} className={`w-full rounded-l1 border shadow-l2 p-8 ${l.tone}`}>
              <h3 className="text-3xl font-bold !text-white">{l.title}</h3>
              <p className="mt-2 text-lg text-white/90 max-w-[60ch]">{l.body}</p>
              <p className="mt-2 font-mono text-sm text-white/60">{l.detail}</p>
            </article>
          ))}
        </div>
      </section>
    );
  }

  return (
    <section ref={ref} id="what-we-do" aria-labelledby="wwd-title" className="relative w-full h-[300vh] bg-card">
      <div className="sticky top-0 h-[100svh] w-full overflow-hidden">
        {/* Heading occupies the top ~18vh; the stage below is centred at 58vh. */}
        <motion.div className="absolute inset-x-0 top-[9vh] text-center px-4" style={{ opacity: introOpacity }}>
          <h2 id="wwd-title" className="text-3xl sm:text-5xl font-bold tracking-tight">
            What we do
          </h2>
          <p className="mt-2 text-muted text-base sm:text-lg">Three layers between your software and AI.</p>
        </motion.div>
        <div className="absolute inset-x-0 top-[47.5vh] h-[21vh] perspective-[1400px] transform-3d">
          {LAYERS.map((l, i) => (
            <LayerCard key={l.key} index={i} progress={scrollYProgress} mode={mode} />
          ))}
        </div>
      </div>
    </section>
  );
}
