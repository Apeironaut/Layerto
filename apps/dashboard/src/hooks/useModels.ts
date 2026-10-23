import { useResource } from '@layerto/ui';
import { api } from '../lib/api';

/** Enabled models with prices, from the public catalogue. */
export function useModels() {
  return useResource(() => api.getModels(), 'models');
}
