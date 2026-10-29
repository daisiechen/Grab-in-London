import { render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import App from '../../App.tsx';
import { createAdminApi } from '../../api/admin-api.ts';
import { fail, list, mockFetch, ok, session } from '../../test/mock-api.ts';
import { navigation } from './SignIn.tsx';

const TX = '55555555-5555-4555-8555-555555555555';
const AUTHORIZE = 'https://tenant.example/authorize?acr_values=x&state=s';
const started = () => ({ status: 201, body: { data: { authorizationUrl: AUTHORIZE, stateTransactionId: TX }, meta: { requestId: 'r', serverNow: '2026-10-29T12:00:00Z' } } });

function setup(routes: Parameters<typeof mockFetch>[0], url = '/admin/?lang=en#moderation') {
  history.replaceState(null, '', url);
  const mock = mockFetch({ 'GET /v1/moderation/reports': () => list([]), ...routes });
  render(<App api={createAdminApi({ fetch: mock.fetch })} />);
  return mock;
}
const assign = () => { const spy = vi.fn<(url: string) => void>(); navigation.assign = spy; return spy; };

afterEach(() => { vi.unstubAllEnvs(); });

describe('admin secure sign-in', () => {
  it('starts the hosted MFA sign-in from the sign-in page and leaves for the provider', async () => {
    const go = assign();
    const mock = setup({ 'GET /v1/auth/session': () => fail(401, 'AUTH_REQUIRED'), 'POST /v1/auth/staff/start': started });
    await userEvent.click(await screen.findByRole('button', { name: 'Sign in securely' }));
    await waitFor(() => expect(go).toHaveBeenCalledWith(AUTHORIZE));
    const call = mock.calls.find((c) => c.method === 'POST' && c.path === '/v1/auth/staff/start')!;
    expect(Object.keys(call.body as object)).toEqual(['clientRequestId']);
  });

  it('offers only the secure sign-in in production builds (no email-code form)', async () => {
    vi.stubEnv('DEV', false);
    setup({ 'GET /v1/auth/session': () => fail(401, 'AUTH_REQUIRED') });
    expect(await screen.findByRole('button', { name: 'Sign in securely' })).toBeTruthy();
    expect(screen.queryByLabelText('Staff email')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Send code' })).toBeNull();
  });

  it('keeps the email-code form for the local staff fixture in development builds', async () => {
    setup({ 'GET /v1/auth/session': () => fail(401, 'AUTH_REQUIRED') });
    expect(await screen.findByLabelText('Staff email')).toBeTruthy();
    expect(screen.getByText(/Development only/)).toBeTruthy();
  });

  it('explains a sign-in the API sent back with an error and removes the code from the address', async () => {
    setup({ 'GET /v1/auth/session': () => fail(401, 'AUTH_REQUIRED') }, '/admin/?lang=en&signin_error=FORBIDDEN#moderation');
    expect(await screen.findByText(/not linked to a staff account/)).toBeTruthy();
    expect(location.search).toBe('?lang=en');
    expect(location.hash).toBe('#moderation');
  });

  it('offers the secure sign-in when the session lacks MFA (REAUTH_REQUIRED)', async () => {
    const go = assign();
    setup({
      'GET /v1/auth/session': () => ok({ ...session(['support']), amr: ['otp'] }),
      'GET /v1/moderation/reports': () => fail(403, 'REAUTH_REQUIRED'),
      'POST /v1/auth/staff/start': started,
    });
    await userEvent.click(await screen.findByRole('button', { name: 'Sign in securely' }));
    await waitFor(() => expect(go).toHaveBeenCalledWith(AUTHORIZE));
  });

  it('shows a clear error when the secure sign-in cannot start', async () => {
    const go = assign();
    setup({ 'GET /v1/auth/session': () => fail(401, 'AUTH_REQUIRED'), 'POST /v1/auth/staff/start': () => fail(503, 'PROVIDER_UNAVAILABLE') });
    await userEvent.click(await screen.findByRole('button', { name: 'Sign in securely' }));
    expect(await screen.findByText('Sign-in could not start. Try again shortly.')).toBeTruthy();
    expect(go).not.toHaveBeenCalled();
  });
});
