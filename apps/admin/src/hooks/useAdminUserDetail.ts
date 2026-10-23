import { useResource } from '@layerto/ui';
import { api } from '../lib/api';

/** Fetches detailed profile, balance, active keys, and 30d usage for a specific user. */
export function useAdminUserDetail(userId: string | null) {
  return useResource(() => (userId ? api.adminGetUser(userId) : Promise.reject('No ID')), userId ? `user-detail-${userId}` : null);
}
