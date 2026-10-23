import { useReducedMotion } from 'framer-motion';
import { useMediaQuery } from './useMediaQuery';

/** How much motion the current device and user preferences allow. */
export interface MotionMode {
  /** prefers-reduced-motion: render static, normal-flow layouts. */
  reduced: boolean;
  /** Viewport under 768px: simpler layouts, smaller rotations. */
  mobile: boolean;
  /** Mouse or trackpad with hover: pointer tilt is allowed. */
  finePointer: boolean;
  /** Largest rotation in degrees for scroll-driven 3D. */
  maxRotate: number;
  /** Multiplier for translateZ depth. */
  depth: number;
}

export function useMotionMode(): MotionMode {
  const prefersReduced = useReducedMotion();
  const mediaReduced = useMediaQuery('(prefers-reduced-motion: reduce)');
  const mobile = useMediaQuery('(max-width: 767px)');
  const fine = useMediaQuery('(hover: hover) and (pointer: fine)');
  const reduced = Boolean(prefersReduced) || mediaReduced;
  return {
    reduced,
    mobile,
    finePointer: fine && !mobile && !reduced,
    maxRotate: mobile ? 6 : 90,
    depth: mobile ? 0.35 : 1,
  };
}
