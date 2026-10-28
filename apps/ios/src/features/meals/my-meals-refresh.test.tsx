import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { MyMealsScreen } from './MyMealsScreen.tsx';
import { createTestApp, renderApp, signIn } from '../../test/render.tsx';
import { page } from '../../test/mock-fetch.ts';
import { application, meal, me } from '../../test/fixtures.ts';

let mockFocus: (() => void | (() => void)) | undefined;
// eslint-disable-next-line @typescript-eslint/no-require-imports -- jest.mock factories cannot use ESM imports
jest.mock('expo-router', () => ({ ...require('../../test/router.ts').expoRouterMock, useFocusEffect: (cb: () => void | (() => void)) => { require('react').useEffect(() => { mockFocus = cb; return cb(); }, [cb]); } }));

const sectionCalls = (app: ReturnType<typeof createTestApp>) => app.mock.calls.filter((c) => c.path === '/v1/me/meals').map((c) => c.query.get('section'));

describe('MyMealsScreen refresh', () => {
  it('refetches the current section when the tab regains focus, not when switching sections', async () => {
    const app = createTestApp();
    await signIn(app, me());
    app.mock.on('GET', '/v1/me/meals', page([]), 1);
    app.mock.on('GET', '/v1/me/meals', page([{ meal: meal({ title: 'Just confirmed' }), application: application({ state: 'CONFIRMED' }), role: 'GUEST', conversationId: null }]));
    await renderApp(app, <MyMealsScreen />);
    expect(await screen.findByText('A good meal is waiting.')).toBeOnTheScreen();
    await act(async () => { mockFocus?.(); });
    // A background refetch never drives the pull-to-refresh spinner (it left the list offset on iOS).
    expect(screen.getByTestId('my-meals').props.refreshing).toBe(false);
    expect(await screen.findByText('Just confirmed')).toBeOnTheScreen();
    expect(sectionCalls(app)).toEqual(['UPCOMING', 'UPCOMING']);
    await fireEvent.press(screen.getByRole('tab', { name: 'Past' }));
    await waitFor(() => expect(sectionCalls(app)).toEqual(['UPCOMING', 'UPCOMING', 'PAST']));
  });

  it('Applications lists requests without a seat; confirmed rounds stay in Upcoming', async () => {
    const app = createTestApp();
    await signIn(app, me());
    app.mock.on('GET', '/v1/me/meals', (c) => page(c.query.get('section') === 'APPLICATIONS' ? [
      { meal: meal({ title: 'Seat held' }), application: application({ state: 'CONFIRMED' }), role: 'GUEST', conversationId: null },
      { meal: meal({ title: 'Still waiting' }), application: application(), role: 'APPLICANT', conversationId: null },
    ] : []));
    await renderApp(app, <MyMealsScreen />);
    await fireEvent.press(await screen.findByRole('tab', { name: 'Applications' }));
    expect(await screen.findByText('Still waiting')).toBeOnTheScreen();
    expect(screen.queryByText('Seat held')).toBeNull();
  });
});
