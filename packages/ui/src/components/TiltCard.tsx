import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { cn } from '../lib/cn';
import { useMotionMode } from '../motion/useMotionMode';
import { usePointerTilt } from '../motion/usePointerTilt';

export interface TiltCardProps {
  children: ReactNode;
  className?: string;
  /** Max tilt in degrees on mouse hover. */
  tilt?: number;
}

/**
 * A card that tilts toward the mouse in 3D and lifts on hover (the landing page's
 * card language, used in the apps). Flat on touch devices and with reduced motion.
 */
export function TiltCard({ children, className, tilt = 5 }: TiltCardProps) {
  const mode = useMotionMode();
  const t = usePointerTilt(tilt, mode.finePointer);
  return (
    <motion.div
      onPointerMove={t.onPointerMove}
      onPointerLeave={t.onPointerLeave}
      style={mode.finePointer ? { rotateX: t.rotateX, rotateY: t.rotateY, transformPerspective: 900 } : undefined}
      className={cn(
        'rounded-l1 bg-card border border-line shadow-l1 p-5 sm:p-6 text-ink',
        'transition-[box-shadow,border-color] duration-200 hover:shadow-l2 hover:border-crimson-border',
        className,
      )}
    >
      {children}
    </motion.div>
  );
}
