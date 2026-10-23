import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { ProfileSetupScreen } from './ProfileSetupScreen.tsx';
import { MyProfileScreen } from './MyProfileScreen.tsx';
import { EditProfileScreen } from './EditProfileScreen.tsx';
import { SettingsScreen } from '../../settings/SettingsScreen.tsx';
import { createTestApp, renderApp, signIn } from '../../../test/render.tsx';
import { mockRouter, resetRouter } from '../../../test/router.ts';
import { fail, noContent, ok } from '../../../test/mock-fetch.ts';
import { incompleteMe, me } from '../../../test/fixtures.ts';
import { clearReturnTo, peekReturnTo, rememberReturnTo } from '../../auth/intent.ts';

// eslint-disable-next-line @typescript-eslint/no-require-imports -- jest.mock factories cannot use ESM imports
jest.mock('expo-router', () => require('../../../test/router.ts').expoRouterMock);

beforeEach(() => {
  resetRouter();
  clearReturnTo();
});

describe('ProfileSetupScreen (S05, QA-AUTH-005)', () => {
  it('flags missing items in place, then saves the same user with If-Match and policy versions', async () => {
    const app = createTestApp();
    await signIn(app, incompleteMe());
    rememberReturnTo('/create');
    const saved = me({ version: '4' });
    app.mock.on('PATCH', '/v1/me', ok(saved));
    await renderApp(app, <ProfileSetupScreen />);

    await fireEvent.press(screen.getByRole('button', { name: 'Take your seat' }));
    expect(screen.getAllByText('Add a name of 2–40 characters.').length).toBeGreaterThan(0);
    expect(app.mock.callsTo('PATCH', '/v1/me')).toHaveLength(0);

    await fireEvent.changeText(screen.getByLabelText('First name'), '  Alex ');
    await fireEvent.changeText(screen.getByLabelText('A little about you'), 'New to London and keen to share a table.');
    await fireEvent.press(screen.getByRole('radio', { name: 'New to London' }));
    await fireEvent.press(screen.getByRole('radio', { name: 'English & Mandarin' }));
    await fireEvent.press(screen.getByRole('checkbox', { name: 'Food' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Take your seat' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Confirm the age and community acknowledgement to continue.');
    expect(app.mock.callsTo('PATCH', '/v1/me')).toHaveLength(0);

    await fireEvent.press(screen.getByRole('checkbox', { name: /I’m 18 or older/ }));
    await fireEvent.press(screen.getByRole('button', { name: 'Take your seat' }));
    await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith('/create'));
    const [patch] = app.mock.callsTo('PATCH', '/v1/me');
    expect(patch?.headers['if-match']).toBe('"3"');
    expect(patch?.headers['idempotency-key']).toMatch(/^[0-9a-f-]{36}$/);
    expect(patch?.body).toEqual({
      displayName: 'Alex', bio: 'New to London and keen to share a table.', lifeStatus: 'NEW_TO_LONDON', languages: ['en', 'zh'], interests: ['FOOD'], background: {},
      ageConfirmedVersion: '2026-10-21', communityAcceptedVersion: '2026-10-21',
    });
    const state = app.services.session.getState();
    expect(state.status === 'signedIn' && state.session.user.id).toBe(incompleteMe().id);
  });

  it('a retried save after a network failure reuses the same Idempotency-Key', async () => {
    const app = createTestApp();
    await signIn(app, me());
    app.mock.on('PATCH', '/v1/me', () => {
      throw new TypeError('Network request failed');
    }, 1);
    app.mock.on('PATCH', '/v1/me', ok(me({ version: '4' })));
    await renderApp(app, <EditProfileScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'Save profile' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/Status unknown/);
    await fireEvent.press(screen.getByRole('button', { name: 'Save profile' }));
    await waitFor(() => expect(mockRouter.back).toHaveBeenCalled());
    const keys = app.mock.callsTo('PATCH', '/v1/me').map((c) => c.headers['idempotency-key']);
    expect(keys).toHaveLength(2);
    expect(keys[0]).toBe(keys[1]);
  });

  it('session end during an in-flight save fences the late response: no navigation, no user update (P04-R01)', async () => {
    const app = createTestApp();
    await signIn(app, me());
    let release!: () => void;
    app.mock.on('PATCH', '/v1/me', () => new Promise((r) => { release = () => r(ok(me({ version: '9', displayName: 'Late Name' }))); }));
    await renderApp(app, <EditProfileScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'Save profile' }));
    await waitFor(() => expect(app.mock.callsTo('PATCH', '/v1/me')).toHaveLength(1));
    for (const end of app.services.onSessionEnd) end();
    release();
    await new Promise((r) => setTimeout(r, 10));
    expect(mockRouter.back).not.toHaveBeenCalled();
    const state = app.services.session.getState();
    expect(state.status === 'signedIn' ? state.session.user.version : null).not.toBe('9');
  });

  it('Check status reads the original receipt; SUCCEEDED refreshes Me without writing again (P04)', async () => {
    const app = createTestApp();
    await signIn(app, me());
    app.mock.on('PATCH', '/v1/me', () => { throw new TypeError('Network request failed'); });
    app.mock.on('GET', /^\/v1\/me\/command-receipts\/updateMe\//, (c) => ok({ operation: 'updateMe', key: c.path.split('/').pop(), state: 'SUCCEEDED', retryable: false, expired: false, retryAfterSeconds: null, httpStatus: 200, errorCode: null, conflict: null, resourceId: null, resourceVersion: '4', currentVersion: null, completedAt: '2026-10-21T10:00:00Z', expiresAt: '2026-11-20T10:00:00Z' }));
    app.mock.on('GET', '/v1/me', ok(me({ version: '4' })));
    await renderApp(app, <EditProfileScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'Save profile' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/Status unknown/);
    await fireEvent.press(screen.getByRole('button', { name: 'Check status' }));
    await waitFor(() => expect(mockRouter.back).toHaveBeenCalled());
    expect(app.mock.callsTo('PATCH', '/v1/me')).toHaveLength(1);
    expect(app.mock.callsTo('GET', /command-receipts/)[0]!.path).toBe(`/v1/me/command-receipts/updateMe/${app.mock.callsTo('PATCH', '/v1/me')[0]!.headers['idempotency-key']}`);
  });

  it('a version conflict keeps the edits and refreshes Me for the next save', async () => {
    const app = createTestApp();
    await signIn(app, me());
    app.mock.on('PATCH', '/v1/me', fail(409, 'VERSION_CONFLICT', { currentVersion: '5' }), 1);
    app.mock.on('GET', '/v1/me', ok(me({ version: '5' })));
    await renderApp(app, <EditProfileScreen />);
    await fireEvent.changeText(screen.getByLabelText('First name'), 'Alexandra');
    await fireEvent.press(screen.getByRole('button', { name: 'Save profile' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/Your profile changed on another device/);
    expect(screen.getByLabelText('First name')).toHaveDisplayValue('Alexandra');
    const state = app.services.session.getState();
    expect(state.status === 'signedIn' && state.session.user.version).toBe('5');
    app.mock.on('PATCH', '/v1/me', ok(me({ version: '6', displayName: 'Alexandra' })));
    await fireEvent.press(screen.getByRole('button', { name: 'Save profile' }));
    await waitFor(() => expect(mockRouter.back).toHaveBeenCalled());
    const patches = app.mock.callsTo('PATCH', '/v1/me');
    expect(patches.map((c) => c.headers['if-match'])).toEqual(['"3"', '"5"']);
    expect(patches[0]?.headers['idempotency-key']).not.toBe(patches[1]?.headers['idempotency-key']);
  });
});

describe('MyProfileScreen and sign-out (QA-AUTH-006 / QA-AUTH-014)', () => {
  it('guests are asked to sign in with the profile remembered', async () => {
    await renderApp(createTestApp(), <MyProfileScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'Sign in or create an account' }));
    expect(mockRouter.push).toHaveBeenCalledWith('/sign-in');
    expect(peekReturnTo()).toBe('/profile');
  });

  it('cancelling sign-out keeps the session; confirming revokes, clears Keychain and cache', async () => {
    const app = createTestApp();
    await signIn(app, me());
    app.services.cache.set('meal:1', { private: true });
    app.mock.on('POST', '/v1/auth/logout', noContent());
    await renderApp(app, <SettingsScreen />);

    await fireEvent.press(screen.getByRole('button', { name: 'Sign out' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Stay signed in' }));
    expect(app.services.session.getState().status).toBe('signedIn');
    expect(app.mock.callsTo('POST', '/v1/auth/logout')).toHaveLength(0);

    await fireEvent.press(screen.getAllByRole('button', { name: 'Sign out' })[0]!);
    const buttons = screen.getAllByRole('button', { name: 'Sign out' });
    await fireEvent.press(buttons[buttons.length - 1]!);
    await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith('/'));
    expect(app.mock.callsTo('POST', '/v1/auth/logout')).toHaveLength(1);
    expect(app.store.value).toBeNull();
    expect(app.services.cache.size).toBe(0);
    expect(app.services.session.getState()).toEqual({ status: 'signedOut', reason: 'logout' });
  });
});


describe('account-scoped profile draft', () => {
  it('does not reuse the previous account name after expiry and a different login', async () => {
    const app = createTestApp();
    await signIn(app, me());
    await renderApp(app, <EditProfileScreen />);
    await fireEvent.changeText(screen.getByLabelText('First name'), 'Old account private draft');
    await act(async () => { await app.services.session.expire(); });
    await act(async () => { await signIn(app, me({ id: '00000000-0000-4000-8000-000000000099', displayName: 'Jamie' })); });
    expect(screen.getByLabelText('First name')).toHaveDisplayValue('Jamie');
  });
});
