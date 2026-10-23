import type { ReactNode } from 'react';
import { motion, useReducedMotion } from 'framer-motion';

export interface RevealProps {
  children: ReactNode;
  /** Position in a sequence: each step waits a little longer. */
  index?: number;
  className?: string;
}

/** Enters with a short rise when the page or tab first shows it. */
export function Reveal({ children, index = 0, className }: RevealProps) {
  const reduced = useReducedMotion();
  if (reduced) return <div className={className}>{children}</div>;
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: index * 0.05, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  );
}
