import { useRef } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import type { MotionValue } from 'framer-motion';
import { useMotionMode } from '@layerto/ui';
import { LIFECYCLE } from './steps';

function Stage({ index, progress, reduced }: { index: number; progress: MotionValue<number>; reduced: boolean }) {
  const s = LIFECYCLE[index];
  const at = index / LIFECYCLE.length;
  const opacity = useTransform(progress, [at, at + 0.12], [0.25, 1]);
  const lit = useTransform(progress, [at, at + 0.06], [0, 1]);
  return (
    <motion.li className="relative pl-12" style={reduced ? undefined : { opacity }}>
      <span aria-hidden="true" className="absolute left-[9px] top-1 h-4 w-4 rounded-full bg-line-strong ring-4 ring-card overflow-hidden">
        <motion.span className="block h-full w-full bg-crimson" style={{ opacity: reduced ? 1 : lit }} />
      </span>
      <h4 className="font-bold text-lg">
        <span className="font-mono text-sm text-muted mr-2">{index + 1}</span>
        {s.title}
      </h4>
      <p className="mt-1 text-ink-secondary">{s.body}</p>
    </motion.li>
  );
}

/** "What happens during a call": a timeline whose line fills as you scroll. */
export function CallLifecycle() {
  const mode = useMotionMode();
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start 75%', 'end 60%'] });
  const fill = useTransform(scrollYProgress, [0, 1], ['0%', '100%']);

  return (
    <div className="w-[96vw] max-w-5xl mx-auto py-[10vh] px-2 grid grid-cols-1 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-10">
      <div className="lg:sticky lg:top-24 self-start">
        <h3 className="text-2xl sm:text-4xl font-bold tracking-tight">What happens during a call</h3>
        <p className="mt-3 text-ink-secondary max-w-[40ch]">
          Every request goes through the same six steps. How long it takes depends on the model; each response tells you its latency.
        </p>
      </div>
      <div ref={ref} className="relative">
        <div aria-hidden="true" className="absolute left-4 top-2 bottom-2 w-0.5 bg-line rounded-full overflow-hidden">
          <motion.div className="w-full bg-crimson" style={{ height: mode.reduced ? '100%' : fill }} />
        </div>
        <ol className="space-y-9">
          {LIFECYCLE.map((_, i) => (
            <Stage key={i} index={i} progress={scrollYProgress} reduced={mode.reduced} />
          ))}
        </ol>
      </div>
    </div>
  );
}
