import { useBootMilestones } from '@layerto/ui';
import type { Session } from './useSession';

/**
 * Real boot milestones: session checked → account data loaded.
 * Accounts that aren't active have no data to load, so that step completes at once.
 */
export function useDashboardBoot(session: Session, balanceSettled: boolean) {
  const active = session.status === 'signed-in' && session.user.status === 'active';
  useBootMilestones([
    { label: 'Checking your session', done: session.status !== 'checking' },
    { label: 'Loading your account', done: session.status !== 'checking' && (!active || balanceSettled) },
  ]);
}
