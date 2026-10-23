import { useResource } from '@layerto/ui';
import { api } from '../lib/api';

export type UserFilter = 'all' | 'pending' | 'active' | 'suspended';

/** Users, optionally filtered by status. Pass enabled=false to skip loading. */
export function useUsers(filter: UserFilter, enabled = true) {
  return useResource(() => api.adminListUsers(filter === 'all' ? undefined : filter), enabled ? `users-${filter}` : null);
}
