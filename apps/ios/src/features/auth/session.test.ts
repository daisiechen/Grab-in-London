import { createApiClient } from '@fancy/client';
import { SessionManager, StaleSessionError, sessionClient } from './session.ts';
import { createMockFetch, fail, networkDown, noContent, ok, type MockReply } from '../../test/mock-fetch.ts';
import { deferred, flush } from '../../test/deferred.ts';
import { ACCESS_1, ACCESS_2, HANDOFF, NOW, REFRESH_1, REFRESH_2, credentials, memoryStore, seqId, sessionInfo } from '../../test/fixtures.ts';

function setup(opts: { stored?: boolean; now?: () => number; marker?: { present: boolean }; beforeClear?: () => Promise<void> } = {}) {
  const mock = createMockFetch();
  const store = memoryStore(opts.stored ? { refreshToken: REFRESH_1, refreshExpiresAt: new Date(NOW + 86_400_000).toISOString() } : null);
  const cleared: string[] = [];
  const holder: { m?: SessionManager } = {};
  const raw = createApiClient({ baseUrl: 'http://api.test', credentials: { kind: 'bearer', accessToken: () => holder.m?.accessToken() ?? null }, fetch: mock.fetch });
  const marker = opts.marker
    ? { present: opts.marker.present, async isPresent() { return this.present; }, async set() { this.present = true; } }
    : null;
  const withToken = (t: string) => createApiClient({ baseUrl: 'http://api.test', credentials: { kind: 'bearer', accessToken: () => t }, fetch: mock.fetch });
  const manager = new SessionManager({ api: raw, withToken, store, installMarker: marker, newId: seqId, now: opts.now ?? (() => NOW), onClear: [...(opts.beforeClear ? [opts.beforeClear] : []), () => void cleared.push('cache')] });
  holder.m = manager;
  return { mock, store, manager, raw, cleared, marker };
}

it('reuses the already rotated access token when an older concurrent 401 arrives late',async()=>{
 const {manager,mock,raw}=setup();
 mock.on('POST','/v1/auth/handoff',ok(credentials()));mock.on('GET','/v1/auth/session',ok(sessionInfo()));
 await manager.completeHandoff(HANDOFF,'v'.repeat(43));
 const held=deferred<MockReply>();
 mock.on('GET','/v1/me',()=>held.promise,1);
 mock.on('GET','/v1/me',fail(401,'AUTH_REQUIRED'),1);
 mock.on('GET','/v1/me',ok({id:'self'}));
 mock.on('POST','/v1/auth/refresh',ok(credentials(ACCESS_2,REFRESH_2)));
 const api=sessionClient(raw,manager),late=api.call('getMe',{});await flush();
 await api.call('getMe',{});held.resolve(fail(401,'AUTH_REQUIRED'));await late;
 expect(mock.callsTo('POST','/v1/auth/refresh')).toHaveLength(1);
 expect(manager.getState().status).toBe('signedIn');
});
it('does not expire a newer rotated session when a retried request returns a stale 401',async()=>{
 const {manager,mock,raw}=setup();
 mock.on('POST','/v1/auth/handoff',ok(credentials()));mock.on('GET','/v1/auth/session',ok(sessionInfo()));
 await manager.completeHandoff(HANDOFF,'v'.repeat(43));
 const held=deferred<MockReply>();
 mock.on('GET','/v1/me',fail(401,'AUTH_REQUIRED'),1);mock.on('GET','/v1/me',()=>held.promise);
 mock.on('POST','/v1/auth/refresh',ok(credentials(ACCESS_2,REFRESH_2)),1);
 mock.on('POST','/v1/auth/refresh',ok(credentials('access-token-three-00000000000000000000','refresh-token-three-0000000000000000000')));
 const request=sessionClient(raw,manager).call('getMe',{});await flush();
 const rejected=expect(request).rejects.toMatchObject({status:401});
 await manager.refresh();held.resolve(fail(401,'AUTH_REQUIRED'));await rejected;
 expect(manager.getState().status).toBe('signedIn');
 expect(manager.accessToken()).toBe('access-token-three-00000000000000000000');
});

describe('SessionManager restore (QA-AUTH-006 / QA-AUTH-013)', () => {
  it('stays unavailable when protected storage cannot be read and retries safely', async () => {
    const { manager, store } = setup();
    store.readRefresh = async () => { throw new Error('Keychain locked'); };
    await expect(manager.restore()).resolves.toEqual({ status: 'unavailable' });
    expect(manager.accessToken()).toBeNull();
    store.readRefresh = async () => null;
    await expect(manager.restore()).resolves.toEqual({ status: 'signedOut', reason: null });
  });

  it('starts signed out without a stored refresh token and makes no request', async () => {
    const { manager, mock } = setup();
    await expect(manager.restore()).resolves.toEqual({ status: 'signedOut', reason: null });
    expect(mock.calls).toHaveLength(0);
  });

  it('rotates the stored refresh token, keeps access in memory only and loads the session', async () => {
    const { manager, mock, store } = setup({ stored: true });
    mock.on('POST', '/v1/auth/refresh', ok(credentials(ACCESS_1, REFRESH_2)));
    mock.on('GET', '/v1/auth/session', ok(sessionInfo()));
    const state = await manager.restore();
    expect(state.status).toBe('signedIn');
    expect(mock.callsTo('POST', '/v1/auth/refresh')[0]?.body).toMatchObject({ refreshToken: REFRESH_1 });
    expect(mock.callsTo('GET', '/v1/auth/session')[0]?.headers.authorization).toBe(`Bearer ${ACCESS_1}`);
    expect(store.value).toEqual({ refreshToken: REFRESH_2, refreshExpiresAt: expect.any(String) });
    expect(JSON.stringify(store.writes)).not.toContain(ACCESS_1);
  });

  it('signs out and clears Keychain + caches when the refresh family was revoked (reuse)', async () => {
    const { manager, mock, store, cleared } = setup({ stored: true });
    mock.on('POST', '/v1/auth/refresh', fail(401, 'AUTH_REQUIRED'));
    await expect(manager.restore()).resolves.toEqual({ status: 'signedOut', reason: 'expired' });
    expect(store.value).toBeNull();
    expect(cleared).toEqual(['cache']);
  });

  it('reports unavailable offline instead of pretending to be signed in, and keeps the token for retry', async () => {
    const { manager, mock, store } = setup({ stored: true });
    mock.on('POST', '/v1/auth/refresh', networkDown, 1);
    await expect(manager.restore()).resolves.toEqual({ status: 'unavailable' });
    expect(store.value?.refreshToken).toBe(REFRESH_1);
    mock.on('POST', '/v1/auth/refresh', ok(credentials(ACCESS_1, REFRESH_2)));
    mock.on('GET', '/v1/auth/session', ok(sessionInfo()));
    await expect(manager.revalidate()).resolves.toMatchObject({ status: 'signedIn' });
  });

  it('discards a Keychain token left by a previous install', async () => {
    const { manager, mock, store, marker } = setup({ stored: true, marker: { present: false } });
    await expect(manager.restore()).resolves.toEqual({ status: 'signedOut', reason: null });
    expect(store.value).toBeNull();
    expect(marker?.present).toBe(true);
    expect(mock.calls).toHaveLength(0);
  });
});

describe('handoff, refresh and logout', () => {
  it('exchanges the one-time handoff code with the app verifier', async () => {
    const { manager, mock } = setup();
    mock.on('POST', '/v1/auth/handoff', ok(credentials()));
    mock.on('GET', '/v1/auth/session', ok(sessionInfo()));
    const session = await manager.completeHandoff(HANDOFF, 'v'.repeat(43));
    expect(session.user.displayName).toBe('Alex');
    expect(mock.callsTo('POST', '/v1/auth/handoff')[0]?.body).toMatchObject({ code: HANDOFF, appVerifier: 'v'.repeat(43) });
    expect(manager.getState().status).toBe('signedIn');
  });

  it('rejects CLI credentials returned to the iOS app', async () => {
    const { manager, mock, store } = setup();
    mock.on('POST', '/v1/auth/handoff', ok({ client: 'SUPPORT_CLI', accessToken: ACCESS_1, accessExpiresAt: '2026-10-21T10:15:00Z' }));
    await expect(manager.completeHandoff(HANDOFF, 'v'.repeat(43))).rejects.toMatchObject({ code: 'STATE_CONFLICT' });
    expect(store.value).toBeNull();
  });

  it('shares one refresh between concurrent callers so a rotated token is never reused', async () => {
    let t = NOW;
    const { manager, mock } = setup({ now: () => t });
    mock.on('POST', '/v1/auth/handoff', ok(credentials()));
    mock.on('GET', '/v1/auth/session', ok(sessionInfo()));
    await manager.completeHandoff(HANDOFF, 'v'.repeat(43));
    t = NOW + 14.5 * 60_000; // inside the 60 s skew
    mock.on('POST', '/v1/auth/refresh', ok(credentials(ACCESS_2, REFRESH_2, t)));
    await Promise.all([manager.ensureFresh(), manager.ensureFresh(), manager.ensureFresh()]);
    expect(mock.callsTo('POST', '/v1/auth/refresh')).toHaveLength(1);
    expect(manager.accessToken()).toBe(ACCESS_2);
  });

  it('logout revokes server-side, then clears SecureStore and caches', async () => {
    const { manager, mock, store, cleared } = setup();
    mock.on('POST', '/v1/auth/handoff', ok(credentials()));
    mock.on('GET', '/v1/auth/session', ok(sessionInfo()));
    mock.on('POST', '/v1/auth/logout', noContent());
    await manager.completeHandoff(HANDOFF, 'v'.repeat(43));
    await expect(manager.logout()).resolves.toEqual({ serverRevoked: true });
    expect(mock.callsTo('POST', '/v1/auth/logout')[0]?.headers.authorization).toBe(`Bearer ${ACCESS_1}`);
    expect(store.value).toBeNull();
    expect(manager.accessToken()).toBeNull();
    expect(cleared).toEqual(['cache']);
    expect(manager.getState()).toEqual({ status: 'signedOut', reason: 'logout' });
  });

  it('logout offline still clears local credentials and reports the server was not reached', async () => {
    const { manager, mock, store } = setup();
    mock.on('POST', '/v1/auth/handoff', ok(credentials()));
    mock.on('GET', '/v1/auth/session', ok(sessionInfo()));
    mock.on('POST', '/v1/auth/logout', networkDown);
    await manager.completeHandoff(HANDOFF, 'v'.repeat(43));
    await expect(manager.logout()).resolves.toEqual({ serverRevoked: false });
    expect(store.value).toBeNull();
  });
});

describe('sessionClient', () => {
  it('refreshes once on 401 and replays the same request (same Idempotency-Key)', async () => {
    const { manager, mock, raw } = setup();
    mock.on('POST', '/v1/auth/handoff', ok(credentials()));
    mock.on('GET', '/v1/auth/session', ok(sessionInfo()));
    await manager.completeHandoff(HANDOFF, 'v'.repeat(43));
    mock.on('PATCH', '/v1/me', fail(401, 'AUTH_REQUIRED'), 1);
    mock.on('POST', '/v1/auth/refresh', ok(credentials(ACCESS_2, REFRESH_2)));
    mock.on('PATCH', '/v1/me', ok(sessionInfo().user));
    const api = sessionClient(raw, manager);
    const key = '0b8a7c55-4d0f-4d55-8c5a-2b0f6c9d1e22';
    await api.call('updateMe', { body: { bio: 'x'.repeat(20) }, idempotencyKey: key, ifMatch: '3' });
    const patches = mock.callsTo('PATCH', '/v1/me');
    expect(patches).toHaveLength(2);
    expect(patches.map((c) => c.headers['idempotency-key'])).toEqual([key, key]);
    expect(patches[1]?.headers.authorization).toBe(`Bearer ${ACCESS_2}`);
  });

  it('ends the session when the replay is still unauthorised', async () => {
    const { manager, mock, raw, store } = setup();
    mock.on('POST', '/v1/auth/handoff', ok(credentials()));
    mock.on('GET', '/v1/auth/session', ok(sessionInfo()), 1);
    await manager.completeHandoff(HANDOFF, 'v'.repeat(43));
    mock.on('GET', '/v1/auth/session', fail(401, 'AUTH_REQUIRED'));
    mock.on('POST', '/v1/auth/refresh', ok(credentials(ACCESS_2, REFRESH_2)));
    await expect(sessionClient(raw, manager).call('getSession', {})).rejects.toMatchObject({ status: 401 });
    expect(manager.getState()).toEqual({ status: 'signedOut', reason: 'expired' });
    expect(store.value).toBeNull();
  });
});

describe('auth epoch: late responses cannot undo an ended session', () => {
  it('queues logout credential deletion before slow cache cleanup and a new sign-in', async () => {
    const pausedClear = deferred<void>();
    const { manager, mock, store } = setup({ beforeClear: () => pausedClear.promise });
    mock.on('POST', '/v1/auth/handoff', ok(credentials(ACCESS_1, REFRESH_1)), 1);
    mock.on('POST', '/v1/auth/handoff', ok(credentials(ACCESS_2, REFRESH_2)));
    mock.on('GET', '/v1/auth/session', ok(sessionInfo()));
    await manager.completeHandoff(HANDOFF, 'v'.repeat(43));
    const logout = manager.logout();
    await manager.completeHandoff(HANDOFF, 'v'.repeat(43));
    pausedClear.resolve();
    await logout;
    expect(store.value?.refreshToken).toBe(REFRESH_2);
    expect(manager.accessToken()).toBe(ACCESS_2);
  });

  it('serializes Keychain writes so old cleanup cannot erase a new sign-in', async () => {
    const { manager, mock, store } = setup();
    const write = deferred<void>();
    const realWrite = store.writeRefresh.bind(store);
    let writes = 0;
    store.writeRefresh = async (value) => {
      if (++writes === 1) await write.promise;
      await realWrite(value);
    };
    mock.on('POST', '/v1/auth/handoff', ok(credentials(ACCESS_1, REFRESH_1)), 1);
    mock.on('POST', '/v1/auth/handoff', ok(credentials(ACCESS_2, REFRESH_2)));
    mock.on('GET', '/v1/auth/session', ok(sessionInfo()));
    const oldSignIn = manager.completeHandoff(HANDOFF, 'v'.repeat(43));
    const oldResult = oldSignIn.catch((error: unknown) => error);
    await flush();
    const logout = manager.logout();
    const newSignIn = manager.completeHandoff(HANDOFF, 'v'.repeat(43));
    await flush();
    write.resolve();
    await logout;
    await newSignIn;
    expect(await oldResult).toBeInstanceOf(StaleSessionError);
    expect(store.value?.refreshToken).toBe(REFRESH_2);
    expect(manager.accessToken()).toBe(ACCESS_2);
  });

  it('a getSession resolving after logout leaves the user signed out with no token', async () => {
    const { manager, mock, store } = setup();
    const held = deferred<MockReply>();
    mock.on('POST', '/v1/auth/handoff', ok(credentials()));
    mock.on('GET', '/v1/auth/session', () => held.promise);
    mock.on('POST', '/v1/auth/logout', noContent());
    const signIn = manager.completeHandoff(HANDOFF, 'v'.repeat(43));
    await flush();
    expect(mock.callsTo('GET', '/v1/auth/session')).toHaveLength(1);
    await manager.logout();
    expect(manager.getState()).toEqual({ status: 'signedOut', reason: 'logout' });
    held.resolve(ok(sessionInfo()));
    await expect(signIn).rejects.toBeInstanceOf(StaleSessionError);
    expect(manager.getState()).toEqual({ status: 'signedOut', reason: 'logout' });
    expect(manager.accessToken()).toBeNull();
    expect(store.value).toBeNull();
  });

  it('an exchangeHandoff resolving after logout never writes the Keychain or signs in', async () => {
    const { manager, mock, store } = setup();
    const held = deferred<MockReply>();
    mock.on('POST', '/v1/auth/handoff', () => held.promise);
    const signIn = manager.completeHandoff(HANDOFF, 'v'.repeat(43));
    await flush();
    await manager.logout();
    held.resolve(ok(credentials()));
    await expect(signIn).rejects.toBeInstanceOf(StaleSessionError);
    expect(store.writes).toHaveLength(0);
    expect(store.value).toBeNull();
    expect(manager.accessToken()).toBeNull();
    expect(mock.callsTo('GET', '/v1/auth/session')).toHaveLength(0);
    expect(manager.getState()).toEqual({ status: 'signedOut', reason: 'logout' });
  });

  it('a refresh resolving after logout does not restore rotated credentials', async () => {
    const { manager, mock, store } = setup({ stored: true });
    const held = deferred<MockReply>();
    mock.on('POST', '/v1/auth/refresh', () => held.promise);
    const restoring = manager.restore();
    await flush();
    await manager.logout();
    held.resolve(ok(credentials(ACCESS_2, REFRESH_2)));
    await restoring;
    expect(manager.getState()).toEqual({ status: 'signedOut', reason: 'logout' });
    expect(manager.accessToken()).toBeNull();
    expect(manager.hasRefresh()).toBe(false);
    expect(store.value).toBeNull();
    expect(mock.callsTo('GET', '/v1/auth/session')).toHaveLength(0);
  });

  it('a Keychain write still in flight when logout happens is removed afterwards', async () => {
    const { manager, mock, store } = setup();
    const write = deferred<void>();
    const realWrite = store.writeRefresh.bind(store);
    store.writeRefresh = async (v) => {
      await write.promise;
      await realWrite(v);
    };
    mock.on('POST', '/v1/auth/handoff', ok(credentials()));
    const signIn = manager.completeHandoff(HANDOFF, 'v'.repeat(43));
    await flush();
    const logout = manager.logout();
    write.resolve();
    await logout;
    await expect(signIn).rejects.toBeInstanceOf(StaleSessionError);
    expect(store.value).toBeNull();
    expect(manager.accessToken()).toBeNull();
  });

  it('account deletion also invalidates in-flight session loads', async () => {
    const { manager, mock } = setup();
    const held = deferred<MockReply>();
    mock.on('POST', '/v1/auth/handoff', ok(credentials()));
    mock.on('GET', '/v1/auth/session', () => held.promise);
    const signIn = manager.completeHandoff(HANDOFF, 'v'.repeat(43));
    await flush();
    await manager.endForDeletion();
    held.resolve(ok(sessionInfo()));
    await expect(signIn).rejects.toBeInstanceOf(StaleSessionError);
    expect(manager.getState()).toEqual({ status: 'signedOut', reason: 'deleted' });
  });
});

describe('sign-out survives local clean-up failures', () => {
  it('clears caches/drafts and reaches signedOut even when SecureStore delete rejects', async () => {
    const { manager, mock, store, cleared } = setup();
    const errors: unknown[] = [];
    (manager as unknown as { deps: { onClearError: (e: unknown) => void } }).deps.onClearError = (e) => errors.push(e);
    mock.on('POST', '/v1/auth/handoff', ok(credentials()));
    mock.on('GET', '/v1/auth/session', ok(sessionInfo()));
    mock.on('POST', '/v1/auth/logout', noContent());
    await manager.completeHandoff(HANDOFF, 'v'.repeat(43));
    store.clear = async () => {
      throw new Error('errSecInteractionNotAllowed');
    };
    await expect(manager.logout()).resolves.toEqual({ serverRevoked: true });
    expect(manager.getState()).toEqual({ status: 'signedOut', reason: 'logout' });
    expect(manager.accessToken()).toBeNull();
    expect(cleared).toEqual(['cache']);
    expect(errors).toEqual([expect.objectContaining({ message: 'errSecInteractionNotAllowed' })]);
  });

  it('a throwing cache clearer does not stop the remaining clearers or the Keychain delete', async () => {
    const mock = createMockFetch();
    const store = memoryStore({ refreshToken: REFRESH_1, refreshExpiresAt: new Date(NOW + 86_400_000).toISOString() });
    const ran: string[] = [];
    const manager = new SessionManager({
      api: createApiClient({ baseUrl: 'http://api.test', credentials: { kind: 'none' }, fetch: mock.fetch }),
      withToken: () => createApiClient({ baseUrl: 'http://api.test', credentials: { kind: 'none' }, fetch: mock.fetch }),
      store,
      installMarker: null,
      newId: seqId,
      now: () => NOW,
      onClear: [() => { throw new Error('boom'); }, () => void ran.push('drafts')],
      onClearError: () => undefined,
    });
    await manager.expire();
    expect(ran).toEqual(['drafts']);
    expect(store.value).toBeNull();
    expect(manager.getState()).toEqual({ status: 'signedOut', reason: 'expired' });
  });
});


describe('feature requests belong to the session that started them', () => {
  it('discards an authenticated feature response arriving after logout', async () => {
    const { manager, mock, raw } = setup();
    mock.on('POST', '/v1/auth/handoff', ok(credentials()));
    mock.on('GET', '/v1/auth/session', ok(sessionInfo()), 1);
    await manager.completeHandoff(HANDOFF, 'v'.repeat(43));
    const held = deferred<MockReply>();
    mock.on('GET', '/v1/me', () => held.promise);
    mock.on('POST', '/v1/auth/logout', noContent());
    const feature = sessionClient(raw, manager).call('getMe', {});
    await flush();
    await manager.logout();
    held.resolve(ok(sessionInfo().user));
    await expect(feature).rejects.toBeInstanceOf(StaleSessionError);
  });

  it('does not send an authenticated operation when preflight refresh ends the session', async () => {
    let now = NOW;
    const { manager, mock, raw } = setup({ now: () => now });
    mock.on('POST', '/v1/auth/handoff', ok(credentials()));
    mock.on('GET', '/v1/auth/session', ok(sessionInfo()), 1);
    await manager.completeHandoff(HANDOFF, 'v'.repeat(43));
    now += 15 * 60_000;
    mock.on('POST', '/v1/auth/refresh', fail(401, 'AUTH_REQUIRED'));
    mock.on('GET', '/v1/me', ok(sessionInfo().user));
    await expect(sessionClient(raw, manager).call('getMe', {})).rejects.toBeInstanceOf(StaleSessionError);
    expect(mock.callsTo('GET', '/v1/me')).toHaveLength(0);
  });
});
