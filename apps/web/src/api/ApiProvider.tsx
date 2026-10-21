import { createContext, useContext, useMemo, type ReactNode } from 'react';
import type { WebApi } from './webApi.ts';
import { QueryCache } from './queryCache.ts';

interface ApiContextValue {
  api: WebApi;
  cache: QueryCache;
}

const ApiContext = createContext<ApiContextValue | null>(null);

export function ApiProvider({ api, children }: { api: WebApi; children: ReactNode }) {
  const value = useMemo(() => ({ api, cache: new QueryCache() }), [api]);
  return <ApiContext.Provider value={value}>{children}</ApiContext.Provider>;
}

export function useApi(): ApiContextValue {
  const value = useContext(ApiContext);
  if (!value) throw new Error('useApi must be used inside <ApiProvider>');
  return value;
}
