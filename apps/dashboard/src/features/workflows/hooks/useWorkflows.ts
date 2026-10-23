import { useResource } from '@layerto/ui';
import { api } from '../../../lib/api';

/** The signed-in user's saved workflows. */
export function useWorkflows() {
  return useResource(() => api.listWorkflows(), 'workflows');
}
