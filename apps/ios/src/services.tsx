import { createContext, useContext, useSyncExternalStore, type ReactNode } from 'react';
import { createApiClient, newIntentKey, type ApiClient } from '@fancy/client';
import { QueryCache } from './api/cache.ts';
import type { CredentialStore, InstallMarker } from './features/auth/credential-store.ts';
import { SessionManager, sessionClient, type SessionState } from './features/auth/session.ts';
import { clearReturnTo } from './features/auth/intent.ts';
import { clearPendingLink } from './features/auth/link.ts';
import { createAppChallenge, type AppChallengePair } from './features/auth/pkce.ts';
import type { WebBrowserAuthSessionResult } from 'expo-web-browser';
import * as ExpoCrypto from 'expo-crypto';

export interface Services {
  session: SessionManager;
  /** Authenticated client (refresh + single replay on 401). Use for every feature call. */
  api: ApiClient;
  cache: QueryCache;
  /** In-memory drafts (create meal, application messages); never persisted, cleared on session end. */
  drafts: QueryCache;
  /** Clearers registered by features (drafts, pollers); run on every session end. */
  onSessionEnd: Set<() => void>;
  openAuthSession: (url: string, redirectUrl: string) => Promise<WebBrowserAuthSessionResult>;
  createChallenge: () => Promise<AppChallengePair>;
  newId: () => string;
  now: () => number;
  randomBytes: (n: number) => Uint8Array;
}

export interface ServiceConfig {
  baseUrl: string;
  fetch?: typeof fetch;
  store: CredentialStore;
  installMarker: InstallMarker | null;
  openAuthSession: Services['openAuthSession'];
  createChallenge?: Services['createChallenge'];
  newId?: () => string;
  now?: () => number;
  onClearError?: (error: unknown) => void;
  randomBytes?: (n: number) => Uint8Array;
}

export function createServices(config: ServiceConfig): Services {
  const cache = new QueryCache();
  const drafts = new QueryCache();
  const onSessionEnd = new Set<() => void>();
  const newId = config.newId ?? newIntentKey;
  const now = config.now ?? Date.now;
  const base = (accessToken: () => string | null) =>
    createApiClient({ baseUrl: config.baseUrl, credentials: { kind: 'bearer', accessToken }, ...(config.fetch ? { fetch: config.fetch } : {}) });
  const holder: { session?: SessionManager } = {};
  const raw = base(() => holder.session?.accessToken() ?? null);
  const session = new SessionManager({
    api: raw,
    withToken: (token) => base(() => token),
    store: config.store,
    installMarker: config.installMarker,
    newId,
    now,
    onClear: [() => cache.clear(), () => drafts.clear(), clearReturnTo, clearPendingLink, () => { for (const clear of onSessionEnd) clear(); }],
    ...(config.onClearError ? { onClearError: config.onClearError } : {}),
  });
  holder.session = session;
  return {
    session,
    api: sessionClient(raw, session),
    cache,
    drafts,
    onSessionEnd,
    openAuthSession: config.openAuthSession,
    createChallenge: config.createChallenge ?? (() => createAppChallenge()),
    newId,
    now,
    randomBytes: config.randomBytes ?? ((n) => ExpoCrypto.getRandomBytes(n)),
  };
}

const ServicesContext = createContext<Services | null>(null);

export function ServicesProvider({ services, children }: { services: Services; children: ReactNode }) {
  return <ServicesContext.Provider value={services}>{children}</ServicesContext.Provider>;
}

export function useServices(): Services {
  const value = useContext(ServicesContext);
  if (!value) throw new Error('ServicesProvider missing');
  return value;
}

export function useSessionState(): SessionState {
  const { session } = useServices();
  return useSyncExternalStore((cb) => session.subscribe(cb), () => session.getState());
}
