import { useCallback, useEffect, useRef, useState } from 'react';
import type { ApiClient } from '@fancy/client';
import { useApi } from './ApiProvider.tsx';

export interface QueryState<T> {
  data: T | undefined;
  error: unknown;
  loading: boolean;
  reload: () => Promise<void>;
  setData: (value: T) => void;
}

/** Loads `key` with `loader`; `key === null` skips loading (e.g. signed out). */
export function useQuery<T>(key: string | null, loader: (client: ApiClient) => Promise<T>): QueryState<T> {
  const { api, cache } = useApi();
  const [data, setDataState] = useState<T | undefined>(() => (key ? cache.get<T>(key) : undefined));
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(key !== null);
  const loaderRef = useRef(loader);
  loaderRef.current = loader;
  const generation = useRef(0);

  const run = useCallback(async () => {
    if (key === null) return;
    const gen = ++generation.current;
    setLoading(true);
    setError(null);
    try {
      const value = await loaderRef.current(api.client);
      if (gen !== generation.current) return;
      cache.set(key, value);
      setDataState(value);
    } catch (e) {
      if (gen !== generation.current) return;
      setError(e);
    } finally {
      if (gen === generation.current) setLoading(false);
    }
  }, [api, cache, key]);

  useEffect(() => {
    setDataState(key ? cache.get<T>(key) : undefined);
    if (key === null) {
      setLoading(false);
      return;
    }
    void run();
    return () => { generation.current++; };
  }, [cache, key, run]);

  useEffect(() => cache.onClear(() => setDataState(undefined)), [cache]);

  const setData = useCallback((value: T) => {
    if (key) cache.set(key, value);
    setDataState(value);
  }, [cache, key]);

  return { data, error, loading, reload: run, setData };
}
