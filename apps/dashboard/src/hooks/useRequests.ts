import { useCallback, useEffect, useState } from 'react';
import type { RequestLogItem } from '@layerto/types';
import { api } from '../lib/api';

/** Fetches requests and supports cursor-based pagination with loadMore. */
export function useRequests() {
  const [data, setData] = useState<RequestLogItem[] | undefined>(undefined);
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
      const items = await api.getRequests();
      setData(items);
      setHasMore(items.length >= 50);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore || !data || data.length === 0) return;
    setLoadingMore(true);
    const oldestSeq = data[data.length - 1].seq;
    try {
      const more = await api.getRequests(oldestSeq);
      if (more.length === 0) {
        setHasMore(false);
      } else {
        setData((prev) => [...(prev ?? []), ...more]);
        if (more.length < 50) setHasMore(false);
      }
    } catch (err) {
      setError(err);
    } finally {
      setLoadingMore(false);
    }
  }, [data, hasMore, loadingMore]);

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
    reload: () => load(true),
    loadMore,
  };
}
