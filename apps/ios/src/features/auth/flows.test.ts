import { WebBrowserResultType } from 'expo-web-browser';
import { createApiClient } from '@fancy/client';
import { SessionManager } from './session.ts';
import { parseAuthRedirect, signInWithProvider } from './oauth.ts';
import { startEmailChallenge, verifyEmailCode, type Challenge } from './otp.ts';
import { clearReturnTo, peekReturnTo, rememberReturnTo, takeReturnTo } from './intent.ts';
import { createMockFetch, fail, networkDown, ok } from '../../test/mock-fetch.ts';
import { HANDOFF, NOW, credentials, memoryStore, seqId, sessionInfo } from '../../test/fixtures.ts';

const REDIRECT = 'fancy://auth/callback';
const PAIR = { verifier: 'V'.repeat(43), challenge: 'C'.repeat(43) };
const CHALLENGE_ID = '1d6f0a3e-2b7c-4f8e-9a1d-3c5e7f9b2d40';

function setup() {
  const mock = createMockFetch();
  const holder: { m?: SessionManager } = {};
  const api = createApiClient({ baseUrl: 'http://api.test', credentials: { kind: 'bearer', accessToken: () => holder.m?.accessToken() ?? null }, fetch: mock.fetch });
  const manager = new SessionManager({ api, withToken: () => api, store: memoryStore(), installMarker: null, newId: seqId, now: () => NOW, onClear: [] });
  holder.m = manager;
  return { mock, api, manager, deps: { api, session: manager, createChallenge: async () => PAIR, newId: seqId } };
}

describe('parseAuthRedirect',()=>{
 it('matches exact base and the provider state, rejecting injected handoff/ticket and duplicate fields',()=>{
  for(const url of [`${REDIRECT}.evil?code=p&state=s`,`${REDIRECT}/extra?code=p&state=s`,`fancy://user@auth/callback?code=p&state=s`,`${REDIRECT}?code=p&code=q&state=s`,`${REDIRECT}?handoffCode=${HANDOFF}`,`${REDIRECT}?linkTicket=forged&state=s`])expect(parseAuthRedirect(url,REDIRECT,'s').kind).toBe('error');
  expect(parseAuthRedirect(`${REDIRECT}?code=provider-code&state=s`,REDIRECT,'s')).toEqual({kind:'provider',code:'provider-code',state:'s'});
  expect(parseAuthRedirect(`${REDIRECT}?error=access_denied&state=s`,REDIRECT,'s')).toEqual({kind:'error',error:'access_denied'});
  expect(parseAuthRedirect(`${REDIRECT}?code=p&state=other`,REDIRECT,'s').kind).toBe('error');
 });
});

describe('signInWithProvider (system browser + handoff)', () => {
  it('sends the app challenge, opens the system browser and redeems the handoff with the verifier', async () => {
    const { mock, deps } = setup();
    mock.on('POST', '/v1/auth/oauth/start', ok({ authorizationUrl: 'https://auth.example.test/authorize?state=provider-state', stateTransactionId: CHALLENGE_ID }, 201));
    mock.on('GET','/v1/auth/oauth/callback',ok({outcome:'AUTHENTICATED',handoffCode:HANDOFF}));
    mock.on('POST', '/v1/auth/handoff', ok(credentials()));
    mock.on('GET', '/v1/auth/session', ok(sessionInfo()));
    const opened: string[] = [];
    const result = await signInWithProvider('GOOGLE', {
      ...deps,
      redirectUrl: REDIRECT,
      openAuthSession: async (url, redirect) => {
        opened.push(url, redirect);
        return { type: 'success', url: `${REDIRECT}?code=provider-code&state=provider-state` };
      },
    });
    expect(result.kind).toBe('signedIn');
    expect(opened).toEqual(['https://auth.example.test/authorize?state=provider-state', REDIRECT]);
    expect(mock.callsTo('POST', '/v1/auth/oauth/start')[0]?.body).toMatchObject({ provider: 'GOOGLE', client: 'IOS', appChallenge: PAIR.challenge });
    expect(mock.callsTo('POST', '/v1/auth/handoff')[0]?.body).toMatchObject({ code: HANDOFF, appVerifier: PAIR.verifier });
  });

  it('provider cancel returns to sign-in without any session request (QA-AUTH-004)', async () => {
    const { mock, deps, manager } = setup();
    mock.on('POST', '/v1/auth/oauth/start', ok({ authorizationUrl: 'https://auth.example.test/a?state=provider-state', stateTransactionId: CHALLENGE_ID }, 201));
    const result = await signInWithProvider('APPLE', { ...deps, redirectUrl: REDIRECT, openAuthSession: async () => ({ type: WebBrowserResultType.CANCEL }) });
    expect(result).toEqual({ kind: 'cancelled' });
    expect(mock.calls.map((c) => c.path)).toEqual(['/v1/auth/oauth/start']);
    expect(manager.accessToken()).toBeNull();
  });

  it('surfaces LINK_REQUIRED without issuing a session', async () => {
    const { mock, deps, manager } = setup();
    mock.on('POST', '/v1/auth/oauth/start', ok({ authorizationUrl: 'https://auth.example.test/a?state=provider-state', stateTransactionId: CHALLENGE_ID }, 201));
    mock.on('GET','/v1/auth/oauth/callback',ok({outcome:'LINK_REQUIRED',linkTicket:'t'.repeat(40),expiresAt:'2026-10-21T10:10:00Z'}));
    const result = await signInWithProvider('GOOGLE', { ...deps, redirectUrl: REDIRECT, openAuthSession: async () => ({ type: 'success', url: `${REDIRECT}?code=provider-code&state=provider-state` }) });
    expect(result).toEqual({ kind: 'linkRequired', linkTicket: 't'.repeat(40), expiresAt: '2026-10-21T10:10:00Z', appVerifier:PAIR.verifier });
    expect(manager.getState().status).not.toBe('signedIn');
  });

  it('offline start shows a retryable message', async () => {
    const { mock, deps } = setup();
    mock.on('POST', '/v1/auth/oauth/start', networkDown);
    await expect(signInWithProvider('GOOGLE', { ...deps, redirectUrl: REDIRECT, openAuthSession: async () => ({ type: WebBrowserResultType.CANCEL }) })).resolves.toEqual({
      kind: 'failed', message: 'You appear to be offline. Check your connection and try again.',
    });
  });
});

describe('email OTP (QA-AUTH-002/003/007/008)', () => {
  const challenge: Challenge = { challengeId: CHALLENGE_ID, email: 'qa@example.com', expiresAt: NOW + 300_000, resendAfter: NOW + 30_000 };

  it('rejects an invalid email locally without calling the API', async () => {
    const { mock, api } = setup();
    await expect(startEmailChallenge(api, 'not-an-email', seqId)).resolves.toEqual({ ok: false, message: 'Enter a valid email address.' });
    expect(mock.calls).toHaveLength(0);
  });

  it('starts an IOS challenge with a trimmed email', async () => {
    const { mock, api } = setup();
    mock.on('POST', '/v1/auth/email/start', ok({ challengeId: CHALLENGE_ID, expiresAt: '2026-10-21T10:05:00Z', resendAfter: '2026-10-21T10:00:30Z' }, 201));
    const res = await startEmailChallenge(api, '  qa@example.com ', seqId);
    expect(res).toEqual({ ok: true, challenge: { challengeId: CHALLENGE_ID, email: 'qa@example.com', expiresAt: Date.parse('2026-10-21T10:05:00Z'), resendAfter: Date.parse('2026-10-21T10:00:30Z') } });
    expect(mock.calls[0]?.body).toMatchObject({ email: 'qa@example.com', client: 'IOS', signupSource: { entry: 'ios_app' } });
  });

  it('a wrong code does not sign in and keeps the challenge', async () => {
    const { mock, deps, manager } = setup();
    mock.on('POST', '/v1/auth/email/verify', fail(422, 'VALIDATION_FAILED'));
    await expect(verifyEmailCode(deps, challenge, '000000', NOW)).resolves.toEqual({ kind: 'retry', message: 'That code doesn’t match. Check the six digits and try again.', restart: false });
    expect(manager.getState().status).not.toBe('signedIn');
  });

  it('an expired code asks for a new one without calling the API', async () => {
    const { mock, deps } = setup();
    await expect(verifyEmailCode(deps, challenge, '123456', challenge.expiresAt)).resolves.toMatchObject({ kind: 'retry', restart: true });
    expect(mock.calls).toHaveLength(0);
  });

  it('a consumed/locked challenge (409) requires a new code instead of replaying', async () => {
    const { mock, deps } = setup();
    mock.on('POST', '/v1/auth/email/verify', fail(409, 'STATE_CONFLICT'));
    await expect(verifyEmailCode(deps, challenge, '123456', NOW)).resolves.toEqual({ kind: 'retry', message: 'This code can no longer be used. Request a new code.', restart: true });
    expect(mock.callsTo('POST', '/v1/auth/handoff')).toHaveLength(0);
  });

  it('a correct code exchanges the handoff with this attempt verifier', async () => {
    const { mock, deps } = setup();
    mock.on('POST', '/v1/auth/email/verify', ok({ outcome: 'AUTHENTICATED', handoffCode: HANDOFF }));
    mock.on('POST', '/v1/auth/handoff', ok(credentials()));
    mock.on('GET', '/v1/auth/session', ok(sessionInfo()));
    await expect(verifyEmailCode(deps, challenge, '123456', NOW)).resolves.toMatchObject({ kind: 'signedIn' });
    expect(mock.callsTo('POST', '/v1/auth/email/verify')[0]?.body).toMatchObject({ challengeId: CHALLENGE_ID, code: '123456', appChallenge: PAIR.challenge });
    expect(mock.callsTo('POST', '/v1/auth/handoff')[0]?.body).toMatchObject({ appVerifier: PAIR.verifier });
  });
});

describe('return target', () => {
  afterEach(clearReturnTo);
  it('keeps allow-listed app paths and drops anything else', () => {
    rememberReturnTo('/meals/6a1f6c32-6c4e-4c4d-9a51-6c1d0e5f9b11/apply');
    expect(takeReturnTo()).toBe('/meals/6a1f6c32-6c4e-4c4d-9a51-6c1d0e5f9b11/apply');
    expect(peekReturnTo()).toBeNull();
    rememberReturnTo('//evil.example');
    expect(takeReturnTo('/')).toBe('/');
  });
});
