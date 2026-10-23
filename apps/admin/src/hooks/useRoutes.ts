import { useResource } from '@layerto/ui';
import { api } from '../lib/api';

/** Keyword → model routing rules used by "auto" requests. */
export function useRoutes() {
  return useResource(() => api.adminListRoutes(), 'routes');
}
