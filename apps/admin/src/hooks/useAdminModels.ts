import { useResource } from '@layerto/ui';
import { api } from '../lib/api';

/** Every model, enabled or not, with its exact price. */
export function useAdminModels() {
  return useResource(() => api.adminListModels(), 'admin-models');
}
