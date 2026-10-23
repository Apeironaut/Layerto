import { useMemo } from 'react';
import { useResource } from '@layerto/ui';
import { api } from '../lib/api';
import { fetchRequestsSince } from '../lib/requestHistory';
import { dailyActivity } from '../lib/dailyActivity';

/**
 * Usage for the last `days` days: totals and per-model split from /api/usage,
 * and a real per-day series built from the request history.
 */
export function useUsage(days: number) {
  const range = useMemo(() => {
    const to = new Date();
    return { from: new Date(to.getTime() - days * 86_400_000), to };
  }, [days]);

  const totals = useResource(() => api.getUsage(range.from.toISOString(), range.to.toISOString()), `usage-${days}`);
  const history = useResource(() => fetchRequestsSince(range.from), `history-${days}`);
  const daily = useMemo(() => dailyActivity(history.data?.items ?? [], days), [history.data, days]);

  return { totals, daily, dailyLoading: history.loading, truncated: history.data?.truncated ?? false };
}
