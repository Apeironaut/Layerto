import { useCallback, useEffect, useRef, useState } from 'react';

export interface Resource<T> {
  data: T | undefined;
  /** True only for the first load; reloads keep showing the previous data. */
  loading: boolean;
  /** True while any load (first or reload) is running. */
  refreshing: boolean;
  error: unknown;
  reload: () => Promise<void>;
}

/**
 * Loads data with `fetcher` when `key` changes (and on reload()). Ignores stale
 * responses if the key changes mid-request. Pass key = null to skip loading.
 */
export function useResource<T>(fetcher: () => Promise<T>, key: string | null): Resource<T> {
  const [data, setData] = useState<T>();
  const [error, setError] = useState<unknown>();
  const [refreshing, setRefreshing] = useState(key !== null);
  const [loaded, setLoaded] = useState(false);
  const latest = useRef(0);
  const fetchRef = useRef(fetcher);
  fetchRef.current = fetcher;

  const run = useCallback(async () => {
    const id = ++latest.current;
    setRefreshing(true);
    try {
      const value = await fetchRef.current();
      if (id === latest.current) {
        setData(value);
        setError(undefined);
      }
    } catch (err) {
      if (id === latest.current) setError(err);
    } finally {
      if (id === latest.current) {
        setRefreshing(false);
        setLoaded(true);
      }
    }
  }, []);

  useEffect(() => {
    if (key !== null) void run();
  }, [key, run]);

  return { data, loading: key !== null && !loaded, refreshing, error, reload: run };
}
