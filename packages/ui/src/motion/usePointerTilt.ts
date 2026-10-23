import { useCallback } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { useMotionValue, useSpring } from 'framer-motion';
import type { MotionValue } from 'framer-motion';

export interface PointerTilt {
  rotateX: MotionValue<number>;
  rotateY: MotionValue<number>;
  onPointerMove: (e: ReactPointerEvent<HTMLElement>) => void;
  onPointerLeave: () => void;
}

/**
 * Tilts an element toward the mouse using spring motion values
 * (transform only, no React re-renders). Stays flat when `enabled` is false.
 */
export function usePointerTilt(maxDeg: number, enabled: boolean): PointerTilt {
  const rx = useMotionValue(0);
  const ry = useMotionValue(0);
  const spring = { stiffness: 160, damping: 18, mass: 0.6 };
  const rotateX = useSpring(rx, spring);
  const rotateY = useSpring(ry, spring);

  const onPointerMove = useCallback(
    (e: ReactPointerEvent<HTMLElement>) => {
      if (!enabled || e.pointerType !== 'mouse') return;
      const rect = e.currentTarget.getBoundingClientRect();
      const nx = (e.clientX - rect.left) / rect.width - 0.5;
      const ny = (e.clientY - rect.top) / rect.height - 0.5;
      ry.set(nx * 2 * maxDeg);
      rx.set(-ny * 2 * maxDeg);
    },
    [enabled, maxDeg, rx, ry],
  );

  const onPointerLeave = useCallback(() => {
    rx.set(0);
    ry.set(0);
  }, [rx, ry]);

  return { rotateX, rotateY, onPointerMove, onPointerLeave };
}
