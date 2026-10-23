import { useRef } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import type { MotionValue } from 'framer-motion';
import { useMotionMode } from '@layerto/ui';
import { STEPS } from './how/steps';
import { StepCard } from './how/StepCard';
import { CallLifecycle } from './how/CallLifecycle';

/**
 * How it works. Desktop: vertical scroll drives a horizontal track of four full-height
 * 3D cards that turn to face you as they pass the centre. Mobile / reduced motion:
 * a plain vertical stack. Followed by the per-call timeline.
 */

const CARD_VW = 80;
const GAP_VW = 4;
const SHIFT_VW = (STEPS.length - 1) * (CARD_VW + GAP_VW);

function TrackCard({ index, progress }: { index: number; progress: MotionValue<number> }) {
  const step = STEPS[index];
  const span = 0.9 / (STEPS.length - 1);
  const centre = 0.05 + span * index;
  // Keyframe offsets must stay inside [0, 1] and increase, or the animation is rejected.
  const lo = Math.max(0, centre - span);
  const hi = Math.min(1, centre + span);
  const at = (edge: number, far: number) => 1 + (far - 1) * (Math.abs(edge - centre) / span);
  const rotateY = useTransform(progress, [lo, centre, hi], [28 * (Math.abs(lo - centre) / span), 0, -28 * (Math.abs(hi - centre) / span)]);
  const scale = useTransform(progress, [lo, centre, hi], [at(lo, 0.88), 1, at(hi, 0.88)]);
  const opacity = useTransform(progress, [lo, centre, hi], [at(lo, 0.4), 1, at(hi, 0.4)]);
  return (
    <motion.article
      aria-labelledby={`how-${step.n}`}
      className="shrink-0 min-h-[64svh] rounded-l1 border border-line bg-card shadow-l2 p-8 sm:p-12 flex items-center"
      style={{ width: `${CARD_VW}vw`, rotateY, scale, opacity, transformPerspective: 1400 }}
    >
      <StepCard step={step} />
    </motion.article>
  );
}

function Heading() {
  return (
    <div className="text-center px-4">
      <h2 id="how-title" className="text-3xl sm:text-5xl font-bold tracking-tight">
        How it works
      </h2>
      <p className="mt-2 text-muted text-base sm:text-lg">Four steps from sign-up to your first Layerto Vision result.</p>
    </div>
  );
}

export function SceneHowItWorks() {
  const mode = useMotionMode();
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end end'] });
  const x = useTransform(scrollYProgress, [0.05, 0.95], ['0vw', `-${SHIFT_VW}vw`]);

  if (mode.reduced || mode.mobile) {
    return (
      <div id="how-it-works" className="w-full bg-card">
        <section aria-labelledby="how-title" className="py-20 px-3 flex flex-col gap-6">
          <Heading />
          {STEPS.map((s) => (
            <article key={s.n} aria-labelledby={`how-${s.n}`} className="w-full rounded-l1 border border-line bg-page shadow-l1 p-6">
              <StepCard step={s} />
            </article>
          ))}
        </section>
        <CallLifecycle />
      </div>
    );
  }

  return (
    <div id="how-it-works" className="w-full bg-card">
      <section ref={ref} aria-labelledby="how-title" className="relative w-full h-[420vh]">
        <div className="sticky top-0 h-[100svh] w-full overflow-hidden flex flex-col justify-center gap-6 pt-14">
          <Heading />
          <motion.div className="flex items-center" style={{ x, gap: `${GAP_VW}vw`, paddingLeft: `${(100 - CARD_VW) / 2}vw` }}>
            {STEPS.map((s, i) => (
              <TrackCard key={s.n} index={i} progress={scrollYProgress} />
            ))}
          </motion.div>
        </div>
      </section>
      <CallLifecycle />
    </div>
  );
}
