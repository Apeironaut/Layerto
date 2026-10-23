import { useRef } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import type { MotionValue } from 'framer-motion';
import { TiltCard, useMotionMode } from '@layerto/ui';

/**
 * "Built for": who Layerto Vision is for. Three tilt cards rise into place one after
 * another as the section scrolls in.
 */
const CASES = [
  {
    title: 'Conservation and research teams',
    body: 'Identify species in field photos without building and training your own model. Every call is recorded, so results are easy to audit later.',
    tag: 'Field data',
  },
  {
    title: 'Developers building niche apps',
    body: 'Add specialist vision to a biology, agriculture or education app with one HTTP call. JSON in, JSON out.',
    tag: 'One API',
  },
  {
    title: 'Hackathon and student teams',
    body: 'Get approved, use the 50 free calls, and have working image recognition in your demo the same day.',
    tag: 'Fast start',
  },
];

function CaseCard({ index, progress }: { index: number; progress: MotionValue<number> }) {
  const c = CASES[index];
  const start = 0.1 + index * 0.12;
  const y = useTransform(progress, [start, start + 0.3], [120, 0]);
  const rotateX = useTransform(progress, [start, start + 0.3], [35, 0]);
  const opacity = useTransform(progress, [start, start + 0.2], [0, 1]);
  return (
    <motion.div style={{ y, rotateX, opacity, transformPerspective: 1000 }} className="h-full">
      <TiltCard className="h-full min-h-[44svh] flex flex-col justify-between p-7 sm:p-9">
        <span className="self-start text-xs font-semibold px-2.5 py-1 rounded-pill bg-crimson-tint text-crimson">{c.tag}</span>
        <div>
          <h3 className="text-2xl sm:text-3xl font-bold tracking-tight">{c.title}</h3>
          <p className="mt-3 text-ink-secondary">{c.body}</p>
        </div>
      </TiltCard>
    </motion.div>
  );
}

export function SceneUseCases() {
  const mode = useMotionMode();
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end end'] });

  return (
    <section ref={ref} id="use-cases" aria-labelledby="use-cases-title" className="w-full bg-card py-[12vh] px-[2vw]">
      <div className="text-center px-4 mb-12">
        <h2 id="use-cases-title" className="text-3xl sm:text-5xl font-bold tracking-tight">
          Built for
        </h2>
        <p className="mt-3 text-muted text-base sm:text-lg">Teams that need a specialist answer, not a general guess.</p>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {CASES.map((c, i) =>
          mode.reduced ? (
            <TiltCard key={c.title} className="min-h-[36svh] flex flex-col justify-between p-7">
              <span className="self-start text-xs font-semibold px-2.5 py-1 rounded-pill bg-crimson-tint text-crimson">{c.tag}</span>
              <div>
                <h3 className="text-2xl font-bold">{c.title}</h3>
                <p className="mt-3 text-ink-secondary">{c.body}</p>
              </div>
            </TiltCard>
          ) : (
            <CaseCard key={c.title} index={i} progress={scrollYProgress} />
          ),
        )}
      </div>
    </section>
  );
}
