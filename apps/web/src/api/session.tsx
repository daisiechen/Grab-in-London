import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ApiError, newIntentKey } from '@fancy/client';
import { useApi } from './ApiProvider.tsx';
import type { SessionInfo } from './types.ts';
import { clearAllPrivateState } from '../lib/drafts.ts';

export type SessionState =
  | { status: 'loading' }
  | { status: 'guest' }
  | { status: 'signed-in'; session: SessionInfo };

interface SessionContextValue {
  state: SessionState;
  /** Re-reads GET /auth/session (after sign-in or profile changes). */
  refresh: () => Promise<SessionState>;
  /** Revokes this device session and clears every private cache and draft. */
  signOut: () => Promise<void>;
  /** Local-only clear, used after 401 or account deletion. */
  clearLocal: () => void;
}

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const { api, cache } = useApi();
  const [state, setState] = useState<SessionState>({ status: 'loading' });
  /**
   * Auth generation: every sign-out/401/deletion bumps it, and a session response is applied
   * only if the generation is unchanged since its request started. A late getSession reply
   * after logout therefore can never sign the user back in.
   */
  const generation = useRef(0);

  const clearLocal = useCallback(() => {
    generation.current++;
    api.setCsrfToken(null);
    cache.clear();
    clearAllPrivateState();
    setState({ status: 'guest' });
  }, [api, cache]);

  const refresh = useCallback(async (): Promise<SessionState> => {
    const gen = generation.current;
    try {
      const { data } = await api.client.call('getSession', {});
      if (gen !== generation.current) return { status: 'guest' };
      api.setCsrfToken(data.csrfToken ?? null);
      const next: SessionState = { status: 'signed-in', session: data };
      setState(next);
      return next;
    } catch (error) {
      if (gen !== generation.current) return { status: 'guest' };
      if (error instanceof ApiError && error.status === 401) return { status: 'guest' };
      // Network/provider failure: stay a guest for public pages but do not claim a session.
      api.setCsrfToken(null);
      setState({ status: 'guest' });
      return { status: 'guest' };
    }
  }, [api]);

  useEffect(() => api.onUnauthorized(clearLocal), [api, clearLocal]);
  useEffect(() => { void refresh(); }, [refresh]);

  const signOut = useCallback(async () => {
    // Invalidate in-flight session reads before the network call; clear locally whatever happens.
    generation.current++;
    try {
      await api.client.call('logout', { body: { clientRequestId: newIntentKey() } });
    } catch {
      // Server-side revoke failed (offline/5xx); this device still forgets everything.
    } finally {
      clearLocal();
    }
  }, [api, clearLocal]);

  const value = useMemo(() => ({ state, refresh, signOut, clearLocal }), [state, refresh, signOut, clearLocal]);
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const value = useContext(SessionContext);
  if (!value) throw new Error('useSession must be used inside <SessionProvider>');
  return value;
}

export function useSignedIn(): SessionInfo | null {
  const { state } = useSession();
  return state.status === 'signed-in' ? state.session : null;
}
