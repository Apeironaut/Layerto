import { useResource } from '@layerto/ui';
import { api } from '../lib/api';

/** Fetches usage metrics for the current UTC calendar month. */
export function useMonthUsage() {
  const now = new Date();
  const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0)).toISOString();
  const to = now.toISOString();

  return useResource(() => api.getUsage(from, to), `usage-month-${from.slice(0, 7)}`);
}
