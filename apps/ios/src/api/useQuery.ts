import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { ApiError } from '@fancy/client';
import { useServices } from '../services.tsx';

export interface QueryState<T> {
  data: T | undefined;
  error: ApiError | null;
  loading: boolean;
  reload: () => Promise<void>;
}

/**
 * Cached read. The cache is memory-only and wiped on session end; a 403/404/410 drops the cached
 * value so revoked private data is not kept on screen.
 */
export function useQuery<T>(key: string | null, fetcher: () => Promise<T>): QueryState<T> {
  const { cache } = useServices();
  const data = useSyncExternalStore(
    (cb) => cache.subscribe(cb),
    () => (key ? cache.get<T>(key) : undefined),
  );
  const [error, setError] = useState<ApiError | null>(null);
  const [loading, setLoading] = useState(false);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const reload = useCallback(async () => {
    if (!key) return;
    setLoading(true);
    setError(null);
    try {
      cache.set(key, await fetcherRef.current());
    } catch (e) {
      const err = e instanceof ApiError ? e : new ApiError({ status: 0, code: 'NETWORK_ERROR', message: String(e) });
      if (err.kind === 'forbidden' || err.kind === 'not_found' || err.kind === 'gone') cache.delete(key);
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [cache, key]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { data, error, loading, reload };
}

export const loadErrorMessage = (e: ApiError) =>
  e.kind === 'network' ? 'You appear to be offline. Check your connection and try again.'
    : e.kind === 'not_found' ? 'This isn’t available any more.'
      : e.kind === 'forbidden' ? 'You don’t have access to this.'
        : 'Something went wrong. Please try again.';
