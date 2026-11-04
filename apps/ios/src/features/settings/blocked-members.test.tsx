import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { BlockedMembersScreen } from './BlockedMembersScreen.tsx';
import { createTestApp, renderApp, signIn } from '../../test/render.tsx';
import { mockRouter, resetRouter } from '../../test/router.ts';
import { fail, ok, page } from '../../test/mock-fetch.ts';
import { HOST_ID, me, publicProfile } from '../../test/fixtures.ts';

// eslint-disable-next-line @typescript-eslint/no-require-imports -- jest.mock factories cannot use ESM imports
jest.mock('expo-router', () => require('../../test/router.ts').expoRouterMock);

const row = { profile: publicProfile(), version: '3', blockedAt: '2026-10-20T10:00:00Z' };
beforeEach(() => resetRouter());

describe('BlockedMembersScreen', () => {
  it('lists blocked members; the name opens their profile', async () => {
    const app = createTestApp(); await signIn(app, me());
    app.mock.on('GET', '/v1/blocks', page([row]));
    await renderApp(app, <BlockedMembersScreen />);
    await fireEvent.press(await screen.findByRole('button', { name: 'Open Maya’s profile' }));
    expect(mockRouter.push).toHaveBeenCalledWith(`/profiles/${HOST_ID}`);
  });

  it('unblocks after confirmation with If-Match and refreshes the list', async () => {
    const app = createTestApp(); await signIn(app, me());
    app.mock.on('GET', '/v1/blocks', page([row]), 1);
    app.mock.on('GET', '/v1/blocks', page([]));
    app.mock.on('DELETE', `/v1/blocks/${HOST_ID}`, ok({ subjectId: HOST_ID, blocked: false, version: '4' }));
    await renderApp(app, <BlockedMembersScreen />);
    await fireEvent.press(await screen.findByRole('button', { name: 'Unblock' }));
    expect(screen.getByText(/previous choice to meet again isn’t restored/)).toBeOnTheScreen();
    expect(app.mock.callsTo('DELETE', `/v1/blocks/${HOST_ID}`)).toHaveLength(0);
    await fireEvent.press(screen.getAllByRole('button', { name: 'Unblock' }).at(-1)!);
    await waitFor(() => expect(app.mock.callsTo('DELETE', `/v1/blocks/${HOST_ID}`)).toHaveLength(1));
    expect(app.mock.callsTo('DELETE', `/v1/blocks/${HOST_ID}`)[0]).toMatchObject({ headers: { 'if-match': '"3"' } });
    expect(await screen.findByText('Maya is unblocked. Your previous connection isn’t restored.')).toBeOnTheScreen();
    expect(screen.getByText(/You haven’t blocked anyone/)).toBeOnTheScreen();
  });

  it('shows a retry when the list cannot load', async () => {
    const app = createTestApp(); await signIn(app, me());
    app.mock.on('GET', '/v1/blocks', fail(503, 'PROVIDER_UNAVAILABLE'));
    await renderApp(app, <BlockedMembersScreen />);
    expect(await screen.findByRole('button', { name: 'Try again' })).toBeOnTheScreen();
  });
});
