import { useBootMilestones } from '@layerto/ui';
import type { AdminSession } from './useAdminSession';

/** Real boot milestones: session checked → first admin data loaded. */
export function useAdminBoot(session: AdminSession, dataSettled: boolean) {
  const signedIn = session.status === 'signed-in';
  useBootMilestones([
    { label: 'Checking your session', done: session.status !== 'checking' },
    { label: 'Loading admin data', done: session.status !== 'checking' && (!signedIn || dataSettled) },
  ]);
}
