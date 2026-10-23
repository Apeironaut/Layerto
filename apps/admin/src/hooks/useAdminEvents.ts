import { useCallback, useEffect, useState } from 'react';
import type { AdminEventItem } from '@layerto/types';
import { api } from '../lib/api';

/** Fetches ledger events with before_seq pagination and optional type filter. */
export function useAdminEvents(initialType = 'all', limit = 50) {
  const [data, setData] = useState<AdminEventItem[] | undefined>(undefined);
  const [typeFilter, setTypeFilter] = useState(initialType);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<unknown>(undefined);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(undefined);
    try {
      const typeParam = typeFilter === 'all' ? undefined : typeFilter;
      const items = await api.adminListEvents({ limit, type: typeParam });
      setData(items);
      setHasMore(items.length >= limit);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [typeFilter, limit]);

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore || !data || data.length === 0) return;
    setLoadingMore(true);
    const oldestSeq = data[data.length - 1].seq;
    try {
      const typeParam = typeFilter === 'all' ? undefined : typeFilter;
      const more = await api.adminListEvents({ limit, before_seq: oldestSeq, type: typeParam });
      if (more.length === 0) {
        setHasMore(false);
      } else {
        setData((prev) => [...(prev ?? []), ...more]);
        if (more.length < limit) setHasMore(false);
      }
    } catch (err) {
      setError(err);
    } finally {
      setLoadingMore(false);
    }
  }, [data, hasMore, loadingMore, typeFilter, limit]);

  useEffect(() => {
    void load();
  }, [load]);

  return {
    data,
    loading,
    refreshing,
    loadingMore,
    hasMore,
    error,
    typeFilter,
    setTypeFilter,
    reload: () => load(true),
    loadMore,
  };
}
