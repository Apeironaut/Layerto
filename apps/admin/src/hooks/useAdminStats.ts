import { useResource } from '@layerto/ui';
import { api } from '../lib/api';

/** Fetches overall system stats (users, models, routes, 24h requests, 30d revenue). */
export function useAdminStats() {
  return useResource(() => api.adminGetStats(), 'admin-stats');
}
