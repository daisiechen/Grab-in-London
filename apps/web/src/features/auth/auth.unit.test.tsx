import { describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { createFetchStub, fail, ok, meta } from '../../test/fetchStub.ts';
import { renderApp } from '../../test/render.tsx';
import { me, session } from '../../test/fixtures.ts';
import { browser } from '../../lib/browser.ts';

const CHALLENGE = '66666666-6666-4666-8666-666666666666';
const resendIn30 = { challengeId: CHALLENGE, expiresAt: '2026-10-21T12:05:00.000Z', resendAfter: '2026-10-21T12:00:30.000Z' };

/** getSession is a guest until `signedIn()` flips. */
function authStub(user = session()) {
  let signedIn = false;
  const stub = createFetchStub({
    getSession: () => (signedIn ? ok(user) : fail(401, 'AUTH_REQUIRED')),
    getMe: () => ok(user.user),
    getPublicProfile: () => ok({ profile: { id: user.user.id, displayName: user.user.displayName, avatarUrl: null, bio: null, interests: [], languages: [] }, reviews: [], nextReviewCursor: null }),
    startEmail: () => ({ status: 201, body: { data: resendIn30, meta: meta() } }),
    verifyEmail: () => { signedIn = true; return ok({ outcome: 'AUTHENTICATED' }); },
  });
  return { stub, signIn: () => { signedIn = true; } };
}

async function enterEmailAndCode(code = '123456') {
  await userEvent.click(await screen.findByRole('button', { name: /Continue with email/ }));
  await userEvent.type(screen.getByLabelText('Email address'), 'sam@example.test');
  await userEvent.click(screen.getByRole('button', { name: /Send code/ }));
  await userEvent.type(await screen.findByLabelText('6-digit code'), code);
  await userEvent.click(screen.getByRole('button', { name: /Verify & continue/ }));
}

describe('email OTP sign-in (T05)', () => {
  it('verifies, refreshes the session and returns to the allow-listed page', async () => {
    const { stub } = authStub();
    renderApp(stub.fetch, '/sign-in?returnTo=%2Fprofile');
    await enterEmailAndCode();
    expect(await screen.findByRole('heading', { name: 'Sam Rivera' })).toBeTruthy();
    const start = stub.callsTo('startEmail')[0]!.body as Record<string, unknown>;
    expect(start).toMatchObject({ email: 'sam@example.test', client: 'WEB', returnTarget: '/profile' });
    expect(stub.callsTo('verifyEmail')[0]!.body).toMatchObject({ challengeId: CHALLENGE, code: '123456' });
    expect(stub.callsTo('getSession').length).toBeGreaterThanOrEqual(2);
  });

  it('never sends or follows a non-allow-listed return target', async () => {
    const { stub } = authStub();
    renderApp(stub.fetch, '/sign-in?returnTo=%2F%2Fevil.example%2Fx');
    await enterEmailAndCode();
    await waitFor(() => expect(stub.callsTo('verifyEmail')).toHaveLength(1));
    expect((stub.callsTo('startEmail')[0]!.body as { returnTarget: string }).returnTarget).toBe('/discover');
  });

  it('sends an incomplete profile through the gate with the original return path', async () => {
    const incomplete = session({ profileGate: { ageConfirmed: false, communityAccepted: false, profileComplete: false, missing: ['bio', 'age', 'community'] }, bio: null });
    const { stub } = authStub(incomplete);
    renderApp(stub.fetch, '/sign-in?returnTo=%2Fprofile');
    await enterEmailAndCode();
    expect(await screen.findByRole('heading', { name: 'A face. A little story. You.' })).toBeTruthy();
  });

  it('shows the resend countdown from the server clock and disables resend', async () => {
    const { stub } = authStub();
    renderApp(stub.fetch, '/sign-in');
    await userEvent.click(await screen.findByRole('button', { name: /Continue with email/ }));
    await userEvent.type(screen.getByLabelText('Email address'), 'sam@example.test');
    await userEvent.click(screen.getByRole('button', { name: /Send code/ }));
    const resend = await screen.findByRole('button', { name: 'Resend code in 30s' });
    expect((resend as HTMLButtonElement).disabled).toBe(true);
  });

  it('rejects malformed emails before calling the API', async () => {
    const { stub } = authStub();
    renderApp(stub.fetch, '/sign-in');
    await userEvent.click(await screen.findByRole('button', { name: /Continue with email/ }));
    await userEvent.type(screen.getByLabelText('Email address'), 'not-an-email');
    await userEvent.click(screen.getByRole('button', { name: /Send code/ }));
    expect((await screen.findByRole('alert')).textContent).toBe('Enter a valid email address.');
    expect(stub.callsTo('startEmail')).toHaveLength(0);
  });

  it('explains rate limits with the provider’s Retry-After', async () => {
    const { stub } = authStub();
    stub.on('startEmail', () => fail(429, 'RATE_LIMITED', { retryAfterSeconds: 45 }));
    renderApp(stub.fetch, '/sign-in');
    await userEvent.click(await screen.findByRole('button', { name: /Continue with email/ }));
    await userEvent.type(screen.getByLabelText('Email address'), 'sam@example.test');
    await userEvent.click(screen.getByRole('button', { name: /Send code/ }));
    expect((await screen.findByRole('alert')).textContent).toBe('Too many attempts. Try again in 45 seconds.');
  });

  it('distinguishes a wrong code from an expired/exhausted challenge', async () => {
    const { stub } = authStub();
    stub.on('verifyEmail', () => fail(422, 'VALIDATION_FAILED'));
    renderApp(stub.fetch, '/sign-in');
    await enterEmailAndCode('000000');
    expect((await screen.findByRole('alert')).textContent).toBe('That code isn’t right. Check your inbox and try again.');
    stub.on('verifyEmail', () => fail(409, 'STATE_CONFLICT'));
    await userEvent.click(screen.getByRole('button', { name: /Verify & continue/ }));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toMatch(/expired or has been tried too many times/));
  });

  it('LINK_REQUIRED issues no session and never merges automatically', async () => {
    const { stub } = authStub();
    stub.on('verifyEmail', () => ok({ outcome: 'LINK_REQUIRED', linkTicket: 'l'.repeat(40), expiresAt: '2026-10-21T12:10:00.000Z' }));
    renderApp(stub.fetch, '/sign-in');
    await enterEmailAndCode();
    expect(await screen.findByRole('heading', { name: 'You’ve been here before.' })).toBeTruthy();
    expect(stub.callsTo('getSession')).toHaveLength(1);
  });
});

describe('OAuth sign-in (T05)', () => {
  it('redirects to the provider, then completes on /auth/callback back to the saved page', async () => {
    const assign = vi.spyOn(browser, 'assign').mockImplementation(() => {});
    const { stub, signIn } = authStub();
    stub.on('startOAuth', () => ({ status: 201, body: { data: { authorizationUrl: 'https://login.example.test/authorize?x=1', stateTransactionId: CHALLENGE }, meta: meta() } }));
    stub.on('oauthCallback', () => { signIn(); return ok({ outcome: 'AUTHENTICATED' }); });
    const first = renderApp(stub.fetch, '/sign-in?returnTo=%2Fprofile');
    await userEvent.click(await screen.findByRole('button', { name: /Continue with Google/ }));
    await waitFor(() => expect(assign).toHaveBeenCalledWith('https://login.example.test/authorize?x=1'));
    expect(stub.callsTo('startOAuth')[0]!.body).toMatchObject({ provider: 'GOOGLE', client: 'WEB', returnTarget: '/profile' });
    first.unmount();

    renderApp(stub.fetch, '/auth/callback?code=abc&state=st-1');
    expect(await screen.findByRole('heading', { name: 'Sam Rivera' })).toBeTruthy();
    const cb = stub.callsTo('oauthCallback');
    expect(cb).toHaveLength(1);
    expect(cb[0]!.url.searchParams.get('state')).toBe('st-1');
    expect(cb[0]!.url.searchParams.get('code')).toBe('abc');
  });

  it('refuses a non-https authorization URL', async () => {
    const assign = vi.spyOn(browser, 'assign').mockImplementation(() => {});
    const { stub } = authStub();
    stub.on('startOAuth', () => ({ status: 201, body: { data: { authorizationUrl: 'http://login.example.test/a', stateTransactionId: CHALLENGE }, meta: meta() } }));
    renderApp(stub.fetch, '/sign-in');
    await userEvent.click(await screen.findByRole('button', { name: /Continue with Apple/ }));
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(assign).not.toHaveBeenCalled();
  });
});

void me;
