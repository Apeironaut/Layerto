import { motion, useScroll, useSpring } from 'framer-motion';
import { useMotionMode } from '@layerto/ui';

/** Thin crimson bar at the top that follows page scroll. */
export function ScrollProgress() {
  const { reduced } = useMotionMode();
  const { scrollYProgress } = useScroll();
  const smooth = useSpring(scrollYProgress, { stiffness: 220, damping: 32, restDelta: 0.001 });
  return (
    <motion.div
      aria-hidden="true"
      className="fixed top-0 left-0 right-0 z-50 h-[3px] bg-crimson origin-left pointer-events-none"
      style={{ scaleX: reduced ? scrollYProgress : smooth }}
    />
  );
}
