import { useEffect } from 'react';
import { animate, motion, useMotionValue, useReducedMotion, useTransform } from 'framer-motion';

export interface AnimatedNumberProps {
  value: number;
  /** Turns the in-between number into text, e.g. (n) => `$${n.toFixed(2)}`. */
  format?: (n: number) => string;
  className?: string;
}

/** Counts from the previous value to the new one when it changes. */
export function AnimatedNumber({ value, format = (n) => Math.round(n).toLocaleString(), className }: AnimatedNumberProps) {
  const reduced = useReducedMotion();
  const mv = useMotionValue(value);
  const text = useTransform(mv, (n) => format(n));

  useEffect(() => {
    if (reduced) {
      mv.set(value);
      return;
    }
    const controls = animate(mv, value, { duration: 0.6, ease: [0.16, 1, 0.3, 1] });
    return () => controls.stop();
  }, [value, reduced, mv]);

  return <motion.span className={className}>{text}</motion.span>;
}
