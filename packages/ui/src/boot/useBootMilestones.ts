import { useEffect, useRef } from 'react';
import { bootDone, bootStart, bootStep } from './boot';

export interface BootMilestone {
  /** What is loading while this milestone is pending, e.g. "Checking your session". */
  label: string;
  done: boolean;
}

/**
 * Drives the static boot screen from real app state. Pass milestones in order;
 * each one that becomes done reveals another logo layer. "Code loaded" is counted
 * automatically, since this hook only runs once the app's JavaScript is running.
 */
export function useBootMilestones(milestones: BootMilestone[]) {
  const reported = useRef(-1);
  const total = milestones.length + 1;

  useEffect(() => {
    if (reported.current === -1) {
      bootStart(total, milestones[0]?.label ?? 'Loading');
      bootStep(milestones[0]?.label); // code loaded
      reported.current = 0;
      if (milestones.length === 0) bootDone();
    }
    // Report milestones in order; a later one can't count before an earlier one.
    while (reported.current < milestones.length && milestones[reported.current].done) {
      reported.current += 1;
      const next = milestones[reported.current];
      if (next) bootStep(next.label);
      else bootDone();
    }
  });
}
