import { useMemo } from 'react';
import { useResource } from '@layerto/ui';
import { api } from '../lib/api';

/**
 * Loads request counts per API endpoint for the last `days` days from /api/usage/endpoints.
 */
export function useEndpointUsage(days: number) {
  const range = useMemo(() => {
    const to = new Date();
    return { from: new Date(to.getTime() - days * 86_400_000), to };
  }, [days]);

  return useResource(
    () => api.getEndpointUsage(range.from.toISOString(), range.to.toISOString()),
    `endpoint-usage-${days}`
  );
}
