import { afterEach, describe, expect, it } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { createFetchStub, fail, meta, ok } from '../../test/fetchStub.ts';
import { renderApp } from '../../test/render.tsx';
import { MEAL_ID, me, meal, session } from '../../test/fixtures.ts';
import { captureArrival, resetAttribution } from '../../lib/attribution.ts';

const CHALLENGE = '66666666-6666-4666-8666-666666666666';
afterEach(() => resetAttribution());

describe('sign-up attribution and sign-in context', () => {
  it('sends the landing utm source with email start and verify, and shows the host when coming from Apply', async () => {
    resetAttribution();
    captureArrival(`https://fancyabite.uk/meals/${MEAL_ID}/friday?utm_source=instagram&utm_campaign=launch`);
    let signedIn = false;
    const stub = createFetchStub({
      getSession: () => (signedIn ? ok(session()) : fail(401, 'AUTH_REQUIRED')),
      getMeal: () => ok({ meal: meal(), myApplication: null, conversationId: null }),
      startEmail: () => ({ status: 201, body: { data: { challengeId: CHALLENGE, expiresAt: new Date(Date.now() + 300_000).toISOString(), resendAfter: new Date().toISOString() }, meta: meta() } }),
      verifyEmail: () => { signedIn = true; return ok({ outcome: 'AUTHENTICATED', authProof: CHALLENGE }); },
    });
    renderApp(stub.fetch, `/sign-in?returnTo=${encodeURIComponent(`/meals/${MEAL_ID}/apply`)}`);
    expect(await screen.findByText(/Sign in to send your request to/)).toBeTruthy();
    expect(screen.getByText('Friday dinner & new faces')).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: /Continue with email/ }));
    await userEvent.type(screen.getByLabelText('Email address'), 'new@example.test');
    await userEvent.click(screen.getByRole('button', { name: /Send code/ }));
    await userEvent.type(await screen.findByLabelText('6-digit code'), '123456');
    expect(screen.getByText(/Code expires in/)).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: /Verify & continue/ }));
    await waitFor(() => expect(stub.callsTo('verifyEmail')).toHaveLength(1));
    expect(stub.callsTo('startEmail')[0]!.body).toMatchObject({ signupSource: { utmSource: 'instagram', utmCampaign: 'launch' }, returnTarget: `/meals/${MEAL_ID}/apply` });
    expect(stub.callsTo('verifyEmail')[0]!.body).toMatchObject({ signupSource: { utmSource: 'instagram' } });
    expect(document.cookie).not.toMatch(/utm/);
  });

  it('marks a shared meal link arrival as meal_link on provider sign-in, and sends nothing without attribution', async () => {
    resetAttribution();
    captureArrival(`https://fancyabite.uk/meals/${MEAL_ID}`);
    const stub = createFetchStub({ getSession: () => fail(401, 'AUTH_REQUIRED'), startOAuth: () => fail(503, 'PROVIDER_UNAVAILABLE') });
    renderApp(stub.fetch, '/sign-in');
    await userEvent.click(await screen.findByRole('button', { name: /Continue with Google/ }));
    await waitFor(() => expect(stub.callsTo('startOAuth')).toHaveLength(1));
    expect(stub.callsTo('startOAuth')[0]!.body).toMatchObject({ provider: 'GOOGLE', signupSource: { entry: 'meal_link' } });
    resetAttribution();
    captureArrival('https://fancyabite.uk/discover');
    await userEvent.click(screen.getByRole('button', { name: /Continue with Google/ }));
    await waitFor(() => expect(stub.callsTo('startOAuth')).toHaveLength(2));
    expect(stub.callsTo('startOAuth')[1]!.body).not.toHaveProperty('signupSource');
  });

  it('keeps a page outside the contract allowlist (chat) as the web return target without sending it to the API', async () => {
    const stub = createFetchStub({ getSession: () => fail(401, 'AUTH_REQUIRED'), startEmail: () => fail(429, 'RATE_LIMITED', { retryAfterSeconds: 30 }) });
    renderApp(stub.fetch, '/sign-in?returnTo=%2Fchat%2F13131313-1313-4131-8131-131313131313');
    await userEvent.click(await screen.findByRole('button', { name: /Continue with email/ }));
    await userEvent.type(screen.getByLabelText('Email address'), 'sam@example.test');
    await userEvent.click(screen.getByRole('button', { name: /Send code/ }));
    await waitFor(() => expect(stub.callsTo('startEmail')).toHaveLength(1));
    expect(stub.callsTo('startEmail')[0]!.body).not.toHaveProperty('returnTarget');
    expect(await screen.findByRole('button', { name: /Send code in \d+s/ })).toBeTruthy();
  });
});

describe('profile photo and settings', () => {
  it('uploads a cropped JPEG with the Me version and shows the new photo', async () => {
    const origCreate = document.createElement.bind(document);
    const canvas = { width: 0, height: 0, getContext: () => ({ drawImage: () => {} }), toDataURL: () => 'data:image/jpeg;base64,QUJD' };
    document.createElement = ((tag: string) => (tag === 'canvas' ? canvas : origCreate(tag))) as typeof document.createElement;
    (globalThis as { createImageBitmap?: unknown }).createImageBitmap = async () => ({ width: 800, height: 600, close: () => {} });
    try {
      let current = me();
      const stub = createFetchStub({
        getSession: () => ok({ ...session(), user: current }),
        getMe: () => ok(current),
        uploadAvatar: () => { current = me({ version: '4', avatarUrl: 'https://fancyabite.uk/v1/avatars/99999999-9999-4999-8999-999999999999' }); return ok(current); },
      });
      renderApp(stub.fetch, '/profile-edit');
      await screen.findByRole('button', { name: 'Upload photo' });
      const input = document.querySelector<HTMLInputElement>('input[type="file"]')!;
      fireEvent.change(input, { target: { files: [new File(['x'], 'me.png', { type: 'image/png' })] } });
      await waitFor(() => expect(stub.callsTo('uploadAvatar')).toHaveLength(1));
      const call = stub.callsTo('uploadAvatar')[0]!;
      expect(call.body).toEqual({ imageBase64: 'QUJD' });
      expect(call.headers['if-match']).toBe('"3"');
      expect(await screen.findByRole('button', { name: 'Change photo' })).toBeTruthy();
      expect(document.querySelector('img[src="/v1/avatars/99999999-9999-4999-8999-999999999999"]')).toBeTruthy();
    } finally {
      document.createElement = origCreate;
      delete (globalThis as { createImageBitmap?: unknown }).createImageBitmap;
    }
  });

  it('settings lists safety, account and legal entries and confirms sign-out', async () => {
    const stub = createFetchStub({ getSession: () => ok(session()), logout: () => ({ status: 204 }), discoverMeals: () => ({ status: 200, body: { data: [], page: { nextCursor: null, hasMore: false }, meta: meta() } }) });
    renderApp(stub.fetch, '/settings');
    expect(await screen.findByRole('link', { name: 'Blocked members' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Delete account' }).getAttribute('href')).toBe('/delete-account');
    expect(screen.getByRole('link', { name: 'Privacy notice' }).getAttribute('href')).toBe('/privacy/');
    expect(screen.getByRole('link', { name: 'Contact support' }).getAttribute('href')).toBe('/support/');
    await userEvent.click(screen.getByRole('button', { name: 'Sign out' }));
    const dialog = await screen.findByRole('dialog', { name: 'Sign out?' });
    expect(stub.callsTo('logout')).toHaveLength(0);
    await userEvent.click(within(dialog).getByRole('button', { name: 'Sign out' }));
    await waitFor(() => expect(stub.callsTo('logout')).toHaveLength(1));
  });
});
