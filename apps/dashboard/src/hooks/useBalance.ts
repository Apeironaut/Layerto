import { useResource } from '@layerto/ui';
import { api } from '../lib/api';

/** Prepaid balance and free-call quota for the signed-in account. */
export function useBalance(enabled: boolean) {
  return useResource(() => api.getBalance(), enabled ? 'balance' : null);
}
