import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
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
    app.mock.on('POST', '/v1/auth/oauth/start', ok({ authorizationUrl: 'https://auth.example.test/a?state=provider-state', stateTransactionId: CHALLENGE_ID }, 201));
    app.mock.on('GET','/v1/auth/oauth/callback',ok({outcome:'AUTHENTICATED',handoffCode:HANDOFF}));
    app.mock.on('POST', '/v1/auth/handoff', ok(credentials()));
    app.mock.on('GET', '/v1/auth/session', ok(sessionInfo(incompleteMe())));
    app.openAuthSession.mockResolvedValueOnce({ type: WebBrowserResultType.DISMISS } as never);
    app.openAuthSession.mockResolvedValueOnce({ type: 'success', url: 'fancy://auth/callback?code=provider-code&state=provider-state' });
    await renderApp(app, <SignInScreen />);

    await fireEvent.press(screen.getByRole('button', { name: 'Continue with Google' }));
    await waitFor(() => expect(app.openAuthSession).toHaveBeenCalledTimes(1));
    expect(mockRouter.replace).not.toHaveBeenCalled();
    expect(screen.queryByRole('alert')).toBeNull();

    await fireEvent.press(screen.getByRole('button', { name: 'Continue with Google' }));
    await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith('/profile-setup'));
    expect(app.openAuthSession).toHaveBeenLastCalledWith('https://auth.example.test/a?state=provider-state', 'fancy://auth/callback');
    expect(app.store.value?.refreshToken).toBe(credentials().refreshToken);
  });

  it('returning member goes back to the remembered meal target (QA-AUTH-004)', async () => {
    const app = createTestApp();
    rememberReturnTo('/meals/6a1f6c32-6c4e-4c4d-9a51-6c1d0e5f9b11/apply');
    app.mock.on('POST', '/v1/auth/oauth/start', ok({ authorizationUrl: 'https://auth.example.test/a?state=provider-state', stateTransactionId: CHALLENGE_ID }, 201));
    app.mock.on('GET','/v1/auth/oauth/callback',ok({outcome:'AUTHENTICATED',handoffCode:HANDOFF}));
    app.mock.on('POST', '/v1/auth/handoff', ok(credentials()));
    app.mock.on('GET', '/v1/auth/session', ok(sessionInfo(me())));
    app.openAuthSession.mockResolvedValueOnce({ type: 'success', url: 'fancy://auth/callback?code=provider-code&state=provider-state' });
    await renderApp(app, <SignInScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'Continue with Apple' }));
    await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith('/meals/6a1f6c32-6c4e-4c4d-9a51-6c1d0e5f9b11/apply'));
    expect(app.mock.callsTo('POST', /\/applications$/)).toHaveLength(0);
  });

  it('opens on the brand welcome with every account choice on the first screen', async () => {
    await renderApp(createTestApp(), <SignInScreen />);
    expect(screen.getByLabelText('Fancy')).toBeOnTheScreen();
    expect(screen.getByLabelText('A sculptural green table with colourful chairs, laid for new friends')).toBeOnTheScreen();
    // No eyebrow above the title (shared page-title pattern).
    expect(screen.queryByText('THERE’S A SEAT FOR YOU HERE.')).toBeNull();
    expect(screen.getByText('Fancy a bite?')).toBeOnTheScreen();
    for (const name of ['Continue with email', 'Continue with Google', 'Continue with Apple']) expect(screen.getByRole('button', { name })).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Continue with email' }));
    expect(mockRouter.push).toHaveBeenCalledWith('/email');
  });

  it('Close and “Keep exploring” leave without an account', async () => {
    await renderApp(createTestApp(), <SignInScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'Close' }));
    expect(mockRouter.back).toHaveBeenCalledTimes(1);
    mockRouter.canGoBack.mockImplementation(() => false);
    await fireEvent.press(screen.getByRole('button', { name: 'Keep exploring without an account' }));
    expect(mockRouter.replace).toHaveBeenCalledWith('/');
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

    expect(screen.getByText('Code expires in 5:00')).toBeOnTheScreen();
    await fireEvent.changeText(screen.getByLabelText('6-digit code'), '123456');
    await fireEvent.press(screen.getByRole('button', { name: 'Verify & continue' }));
    await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith('/'));
  });
});

describe('EmailScreen code stage', () => {
  it('counts down on services.now, shows expiry and lets the member change the email', async () => {
    let clock = NOW;
    const app = createTestApp({ now: () => clock });
    app.mock.on('POST', '/v1/auth/email/start', ok({ challengeId: CHALLENGE_ID, expiresAt: new Date(NOW + 300_000).toISOString(), resendAfter: new Date(NOW + 30_000).toISOString() }, 201));
    jest.useFakeTimers();
    try {
      await renderApp(app, <EmailScreen />);
      await fireEvent.changeText(screen.getByLabelText('Email address'), 'qa@example.com');
      await fireEvent.press(screen.getByRole('button', { name: 'Send code' }));
      expect(await screen.findByText('Code expires in 5:00')).toBeOnTheScreen();
      clock = NOW + 31_000;
      await act(async () => { jest.advanceTimersByTime(1000); });
      expect(screen.getByText('Code expires in 4:29')).toBeOnTheScreen();
      expect(screen.getByRole('button', { name: 'Resend code' })).toBeEnabled();
      clock = NOW + 300_000;
      await act(async () => { jest.advanceTimersByTime(1000); });
      expect(screen.getByText('This code has expired. Request a new code.')).toBeOnTheScreen();
      await fireEvent.press(screen.getByRole('button', { name: 'Change email' }));
      expect(screen.getByText('Let’s keep in touch.')).toBeOnTheScreen();
      expect(screen.getByLabelText('Email address')).toHaveDisplayValue('qa@example.com');
    } finally {
      jest.useRealTimers();
    }
  });
});
