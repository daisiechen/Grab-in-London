import { ApiError, type ApiClient, type ResponseOf } from '@fancy/client';
import type { CredentialStore, InstallMarker } from './credential-store.ts';

export type SessionInfo = ResponseOf<'getSession'>['data'];
export type Me = SessionInfo['user'];
type IosCredentials = Extract<ResponseOf<'refreshSession'>['data'], { client: 'IOS' }>;

export type SignedOutReason = 'logout' | 'expired' | 'deleted';
export type SessionState =
  | { status: 'restoring' }
  | { status: 'signedOut'; reason: SignedOutReason | null }
  /** A stored session exists but could not be checked (offline/provider down); nothing is shown as signed in. */
  | { status: 'unavailable' }
  | { status: 'signedIn'; session: SessionInfo };

export interface SessionDeps {
  /** Client whose bearer credential reads `manager.accessToken()`. */
  api: ApiClient;
  /** Client bound to one explicit access token (used to revoke after local state has ended). */
  withToken: (accessToken: string) => ApiClient;
  store: CredentialStore;
  /** Production uses a sandbox file; null is reserved for isolated tests. */
  installMarker: InstallMarker | null;
  newId: () => string;
  now?: () => number;
  /** Clears query caches, drafts and poll state; runs on logout, expiry and account deletion. */
  onClear: Array<() => void | Promise<void>>;
  /** Reports local clean-up failures (e.g. Keychain delete rejected) without blocking sign-out. */
  onClearError?: (error: unknown) => void;
}

/**
 * Thrown when an auth/session/refresh response arrives after the session it belonged to ended
 * (logout, expiry, deletion). The response is discarded; callers should simply stop.
 */
export class StaleSessionError extends Error {
  constructor() {
    super('Session ended before this response arrived.');
    this.name = 'StaleSessionError';
  }
}

/** Refresh this long before the 15-minute access token expires. */
const REFRESH_SKEW_MS = 60_000;

/**
 * iOS session owner (API §2, core plan §104): access token in memory only, rotating refresh token in
 * the Keychain. A refresh that fails with 401 (expired/rotated/reused family) signs the user out.
 *
 * Every async transition captures the auth `epoch` before awaiting and re-checks it afterwards.
 * Ending a session (logout/expiry/deletion) bumps the epoch first, so a late exchangeHandoff,
 * refresh or getSession response can never write credentials or flip the state back to signedIn.
 */
export class SessionManager {
  private state: SessionState = { status: 'restoring' };
  private access: { token: string; expiresAt: number } | null = null;
  private refreshToken: string | null = null;
  private refreshExpiresAt = 0;
  private refreshing: { epoch: number; promise: Promise<void> } | null = null;
  private epoch = 0;
  private persistence: Promise<void> = Promise.resolve();
  private readonly listeners = new Set<(s: SessionState) => void>();
  private remoteLogoutUnconfirmed = false;
  private readonly logoutNoticeListeners = new Set<() => void>();
  getLogoutNotice = () => this.remoteLogoutUnconfirmed;
  subscribeLogoutNotice = (listener: () => void) => {this.logoutNoticeListeners.add(listener);return () => {this.logoutNoticeListeners.delete(listener);};};
  dismissLogoutNotice = () => this.setLogoutNotice(false);
  private setLogoutNotice(value: boolean) {if(this.remoteLogoutUnconfirmed===value)return;this.remoteLogoutUnconfirmed=value;for(const listener of this.logoutNoticeListeners)listener();}
  private readonly now: () => number;
  private readonly deps: SessionDeps;

  constructor(deps: SessionDeps) {
    this.deps = deps;
    this.now = deps.now ?? Date.now;
  }

  /** Captures a session lifetime for feature requests; replies from an ended lifetime are discarded. */
  get generation(): number {
    return this.epoch;
  }

  assertGeneration(generation: number): void {
    this.assertCurrent(generation);
  }

  getState(): SessionState {
    return this.state;
  }

  subscribe(listener: (s: SessionState) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Current access token, or null when absent/expired (the client then sends no Authorization). */
  accessToken(): string | null {
    if (!this.access || this.access.expiresAt <= this.now()) return null;
    return this.access.token;
  }

  hasRefresh(): boolean {
    return this.refreshToken !== null && this.refreshExpiresAt > this.now();
  }

  /** Cold start: discard Keychain leftovers from a previous install, then validate any stored session. */
  async restore(): Promise<SessionState> {
    const epoch = this.epoch;
    try {
      if (this.deps.installMarker && !(await this.deps.installMarker.isPresent())) {
        this.assertCurrent(epoch);
        await this.persist(() => this.deps.store.clear());
        this.assertCurrent(epoch);
        await this.deps.installMarker.set();
      }
      this.assertCurrent(epoch);
      const stored = await this.deps.store.readRefresh();
      this.assertCurrent(epoch);
      if (!stored || !Number.isFinite(Date.parse(stored.refreshExpiresAt)) || Date.parse(stored.refreshExpiresAt) <= this.now()) {
        if (stored) await this.persist(() => this.deps.store.clear());
        this.assertCurrent(epoch);
        this.set({ status: 'signedOut', reason: null });
        return this.state;
      }
      this.refreshToken = stored.refreshToken;
      this.refreshExpiresAt = Date.parse(stored.refreshExpiresAt);
      return this.revalidate();
    } catch (error) {
      if (epoch !== this.epoch) return this.state;
      // Locked/corrupt storage is not proof of an authenticated session. Never read past a failed
      // reinstall wipe or mark the install as valid before the stale Keychain token is removed.
      this.deps.onClearError?.(error);
      this.access = null;
      this.refreshToken = null;
      this.refreshExpiresAt = 0;
      this.set({ status: 'unavailable' });
      return this.state;
    }
  }

  /** Retry after `unavailable` (e.g. connectivity returned). */
  async revalidate(): Promise<SessionState> {
    if (this.state.status === 'unavailable' && !this.refreshToken) return this.restore();
    const epoch = this.epoch;
    try {
      await this.refresh();
      await this.loadSession();
    } catch (error) {
      if (error instanceof StaleSessionError || epoch !== this.epoch || this.state.status === 'signedOut') return this.state;
      if (error instanceof ApiError && (error.kind === 'network' || error.kind === 'unavailable' || error.kind === 'rate_limit')) {
        this.set({ status: 'unavailable' });
      } else {
        await this.expire();
      }
    }
    return this.state;
  }

  /** Redeem a one-time handoff code from OAuth/OTP with this attempt's app verifier. */
  async completeHandoff(code: string, appVerifier: string): Promise<SessionInfo> {
    const epoch = this.epoch;
    const res = await this.deps.api.call('exchangeHandoff', { body: { clientRequestId: this.deps.newId(), code, appVerifier } });
    this.assertCurrent(epoch);
    if (res.data.client !== 'IOS') throw new ApiError({ status: 409, code: 'STATE_CONFLICT', message: 'Unexpected credential type for the iOS app.' });
    await this.apply(res.data, epoch);
    return this.loadSession();
  }

  /** Called before each authenticated call; refreshes shortly before access expiry. */
  async ensureFresh(): Promise<void> {
    if (!this.refreshToken) return;
    if (this.access && this.access.expiresAt - REFRESH_SKEW_MS > this.now()) return;
    await this.refresh();
  }

  /** Single-flight rotation per epoch; concurrent callers share one request so a token is never reused. */
  refresh(): Promise<void> {
    const epoch = this.epoch;
    if (this.refreshing && this.refreshing.epoch === epoch) return this.refreshing.promise;
    const entry = {
      epoch,
      promise: this.rotate(epoch).finally(() => {
        if (this.refreshing === entry) this.refreshing = null;
      }),
    };
    this.refreshing = entry;
    return entry.promise;
  }

  async loadSession(): Promise<SessionInfo> {
    const epoch = this.epoch;
    const res = await this.deps.api.call('getSession', {});
    this.assertCurrent(epoch);
    this.set({ status: 'signedIn', session: res.data });
    return res.data;
  }

  /** Local update after updateMe so profileGate/route guards see the new profile immediately. */
  updateUser(user: Me): void {
    if (this.state.status === 'signedIn') this.set({ status: 'signedIn', session: { ...this.state.session, user } });
  }

  /**
   * User-initiated sign-out. Local state ends first (epoch bump, memory, caches, Keychain) so nothing
   * in flight can revive it; the server revoke then runs with the captured access token. An in-flight
   * refresh is never awaited (its late result is discarded by the epoch check).
   */
  async logout(): Promise<{ serverRevoked: boolean }> {
    let token = this.accessToken();
    if (!token && this.hasRefresh() && !this.refreshing) {
      try {
        await this.refresh();
        token = this.accessToken();
      } catch {
        token = null;
      }
    }
    await this.end('logout');
    const endedEpoch=this.epoch;
    let serverRevoked=false;
    if(token)try {
      await this.deps.withToken(token).call('logout', { body: { clientRequestId: this.deps.newId() } });
      serverRevoked=true;
    } catch { /* Local sign-out remains complete; remote revocation is unconfirmed. */ }
    if(!serverRevoked&&this.epoch===endedEpoch&&this.state.status==='signedOut')this.setLogoutNotice(true);
    return {serverRevoked};
  }

  /** Session no longer valid (401 after refresh, reuse-revoked family, refresh expired). */
  async expire(): Promise<void> {
    await this.end('expired');
  }

  /** Account deletion accepted: every session was revoked server-side; clear everything locally. */
  async endForDeletion(): Promise<void> {
    await this.end('deleted');
  }

  private async rotate(epoch: number): Promise<void> {
    const token = this.refreshToken;
    if (!token || this.refreshExpiresAt <= this.now()) {
      if (epoch === this.epoch) await this.expire();
      throw new ApiError({ status: 401, code: 'AUTH_REQUIRED', message: 'Please sign in again.' });
    }
    let res: ResponseOf<'refreshSession'>;
    try {
      res = await this.deps.api.call('refreshSession', { body: { clientRequestId: this.deps.newId(), refreshToken: token } });
    } catch (error) {
      if (epoch !== this.epoch) throw new StaleSessionError();
      if (error instanceof ApiError && error.kind === 'auth') await this.expire();
      throw error;
    }
    this.assertCurrent(epoch);
    await this.apply(res.data, epoch);
  }

  private async apply(creds: IosCredentials, epoch: number): Promise<void> {
    this.assertCurrent(epoch);
    // Persist the rotated refresh token before using the new access token, so a crash never leaves
    // only the already-consumed token in the Keychain.
    await this.persist(async () => {
      this.assertCurrent(epoch);
      await this.deps.store.writeRefresh({ refreshToken: creds.refreshToken, refreshExpiresAt: creds.refreshExpiresAt });
      if (epoch !== this.epoch) {
        // Keep stale-write cleanup inside the same queue item: it cannot delete a newer login.
        await this.deps.store.clear().catch((e: unknown) => this.deps.onClearError?.(e));
        throw new StaleSessionError();
      }
    });
    this.assertCurrent(epoch);
    this.refreshToken = creds.refreshToken;
    this.refreshExpiresAt = Date.parse(creds.refreshExpiresAt);
    this.access = { token: creds.accessToken, expiresAt: Date.parse(creds.accessExpiresAt) };
  }

  /**
   * Ends the session. The epoch bump, memory wipe and signedOut state happen first and
   * unconditionally; Keychain and cache clean-up failures are reported but never keep a session alive.
   */
  private async end(reason: SignedOutReason): Promise<void> {
    this.epoch += 1;
    this.access = null;
    this.refreshToken = null;
    this.refreshExpiresAt = 0;
    this.refreshing = null;
    this.set({ status: 'signedOut', reason });
    // Reserve deletion in the persistence queue immediately, before async feature cleanup yields
    // to a possible new sign-in. A late old-session clear must not erase the new refresh token.
    const credentialsCleared = this.persist(() => this.deps.store.clear()).catch((error: unknown) => {
      this.deps.onClearError?.(error);
    });
    for (const clear of this.deps.onClear) {
      try {
        await clear();
      } catch (error) {
        this.deps.onClearError?.(error);
      }
    }
    await credentialsCleared;
  }

  /** Keychain writes and clears execute in order, including across logout → new sign-in. */
  private persist(operation: () => Promise<void>): Promise<void> {
    const result = this.persistence.then(operation);
    this.persistence = result.catch(() => undefined);
    return result;
  }

  private assertCurrent(epoch: number): void {
    if (epoch !== this.epoch) throw new StaleSessionError();
  }

  private set(next: SessionState) {
    this.state = next;
    if(next.status==='signedIn')this.setLogoutNotice(false);
    for (const l of this.listeners) l(next);
  }
}

/**
 * Authenticated wrapper used by every feature: refresh before expiry, and on a 401 refresh once and
 * replay the same request object (same Idempotency-Key). A second 401 ends the session.
 */
export function sessionClient(raw: ApiClient, session: SessionManager): ApiClient {
  return {
    async call(operationId, request) {
      const generation = session.generation;
      try {
        await session.ensureFresh();
      } catch (error) {
        session.assertGeneration(generation);
        throw error;
      }
      session.assertGeneration(generation);
      const sentToken = session.accessToken();
      try {
        const response = await raw.call(operationId, request);
        session.assertGeneration(generation);
        return response;
      } catch (error) {
        session.assertGeneration(generation);
        if (!(error instanceof ApiError) || error.kind !== 'auth' || !session.hasRefresh()) {
          if (error instanceof ApiError && error.kind === 'auth' && session.getState().status === 'signedIn') await session.expire();
          throw error;
        }
        // A concurrent request may have already rotated the token while this 401 was in flight.
        if (session.accessToken() === sentToken) await session.refresh();
        session.assertGeneration(generation);
        const retryToken = session.accessToken();
        try {
          const response = await raw.call(operationId, request);
          session.assertGeneration(generation);
          return response;
        } catch (retryError) {
          session.assertGeneration(generation);
          if (retryError instanceof ApiError && retryError.kind === 'auth' && session.accessToken() === retryToken) await session.expire();
          throw retryError;
        }
      }
    },
  };
}
