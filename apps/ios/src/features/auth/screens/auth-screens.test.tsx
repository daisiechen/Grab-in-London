import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { WebBrowserResultType } from 'expo-web-browser';
import { SignInScreen } from './SignInScreen.tsx';
import { EmailScreen } from './EmailScreen.tsx';
import { createTestApp, renderApp } from '../../../test/render.tsx';
import { mockRouter, resetRouter } from '../../../test/router.ts';
import { fail, ok } from '../../../test/mock-fetch.ts';
import { HANDOFF, NOW, credentials, incompleteMe, me, sessionInfo } from '../../../test/fixtures.ts';
import { clearReturnTo, rememberReturnTo } from '../intent.ts';

// eslint-disable-next-line @typescript-eslint/no-require-imports -- jest.mock factories cannot use ESM imports
jest.mock('expo-router', () => require('../../../test/router.ts').expoRouterMock);

const CHALLENGE_ID = '1d6f0a3e-2b7c-4f8e-9a1d-3c5e7f9b2d40';
beforeEach(() => {
  resetRouter();
  clearReturnTo();
});

describe('SignInScreen (S03)', () => {
  it('Google: system browser → handoff → profile setup for a new account', async () => {
    const app = createTestApp();
    app.mock.on('POST', '/v1/auth/oauth/start', ok({ authorizationUrl: 'https://auth.example.test/a', stateTransactionId: CHALLENGE_ID }, 201));
    app.mock.on('POST', '/v1/auth/handoff', ok(credentials()));
    app.mock.on('GET', '/v1/auth/session', ok(sessionInfo(incompleteMe())));
    app.openAuthSession.mockResolvedValueOnce({ type: WebBrowserResultType.DISMISS } as never);
    app.openAuthSession.mockResolvedValueOnce({ type: 'success', url: `fancy://auth/callback?handoffCode=${HANDOFF}` });
    await renderApp(app, <SignInScreen />);

    await fireEvent.press(screen.getByRole('button', { name: 'Continue with Google' }));
    await waitFor(() => expect(app.openAuthSession).toHaveBeenCalledTimes(1));
    expect(mockRouter.replace).not.toHaveBeenCalled();
    expect(screen.queryByRole('alert')).toBeNull();

    await fireEvent.press(screen.getByRole('button', { name: 'Continue with Google' }));
    await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith('/profile-setup'));
    expect(app.openAuthSession).toHaveBeenLastCalledWith('https://auth.example.test/a', 'fancy://auth/callback');
    expect(app.store.value?.refreshToken).toBe(credentials().refreshToken);
  });

  it('returning member goes back to the remembered meal target (QA-AUTH-004)', async () => {
    const app = createTestApp();
    rememberReturnTo('/meals/6a1f6c32-6c4e-4c4d-9a51-6c1d0e5f9b11/apply');
    app.mock.on('POST', '/v1/auth/oauth/start', ok({ authorizationUrl: 'https://auth.example.test/a', stateTransactionId: CHALLENGE_ID }, 201));
    app.mock.on('POST', '/v1/auth/handoff', ok(credentials()));
    app.mock.on('GET', '/v1/auth/session', ok(sessionInfo(me())));
    app.openAuthSession.mockResolvedValueOnce({ type: 'success', url: `fancy://auth/callback?handoffCode=${HANDOFF}` });
    await renderApp(app, <SignInScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'Continue with Apple' }));
    await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith('/meals/6a1f6c32-6c4e-4c4d-9a51-6c1d0e5f9b11/apply'));
    expect(app.mock.callsTo('POST', /\/applications$/)).toHaveLength(0);
  });

  it('shows the community principles in a native sheet', async () => {
    await renderApp(createTestApp(), <SignInScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'Privacy & community principles' }));
    expect(screen.getByText(/Adults 18\+ meet for friendship over meals/)).toBeOnTheScreen();
  });
});

describe('EmailScreen (S04, QA-AUTH-002/003)', () => {
  it('validates the email, sends a code, enforces the resend cooldown and handles a wrong then right code', async () => {
    const app = createTestApp();
    app.mock.on('POST', '/v1/auth/email/start', ok({ challengeId: CHALLENGE_ID, expiresAt: new Date(NOW + 300_000).toISOString(), resendAfter: new Date(NOW + 30_000).toISOString() }, 201));
    app.mock.on('POST', '/v1/auth/email/verify', fail(422, 'VALIDATION_FAILED'), 1);
    app.mock.on('POST', '/v1/auth/email/verify', ok({ outcome: 'AUTHENTICATED', handoffCode: HANDOFF }));
    app.mock.on('POST', '/v1/auth/handoff', ok(credentials()));
    app.mock.on('GET', '/v1/auth/session', ok(sessionInfo(me())));
    await renderApp(app, <EmailScreen />);

    await fireEvent.changeText(screen.getByLabelText('Email address'), 'nope');
    await fireEvent.press(screen.getByRole('button', { name: 'Send code' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Enter a valid email address.');
    expect(app.mock.calls).toHaveLength(0);

    await fireEvent.changeText(screen.getByLabelText('Email address'), 'qa@example.com');
    await fireEvent.press(screen.getByRole('button', { name: 'Send code' }));
    expect(await screen.findByText('Enter the six-digit code for qa@example.com.')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Resend in 30s' })).toBeDisabled();

    await fireEvent.changeText(screen.getByLabelText('6-digit code'), '00a0000');
    expect(screen.getByLabelText('6-digit code')).toHaveDisplayValue('000000');
    await fireEvent.press(screen.getByRole('button', { name: 'Verify & continue' }));
    expect(await screen.findByText('That code doesn’t match. Check the six digits and try again.')).toBeOnTheScreen();
    expect(mockRouter.replace).not.toHaveBeenCalled();

    await fireEvent.changeText(screen.getByLabelText('6-digit code'), '123456');
    await fireEvent.press(screen.getByRole('button', { name: 'Verify & continue' }));
    await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith('/'));
  });
});
