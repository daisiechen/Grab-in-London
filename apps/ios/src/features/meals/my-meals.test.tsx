import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { MyMealsScreen, rowStatus } from './MyMealsScreen.tsx';
import { createTestApp, renderApp, signIn } from '../../test/render.tsx';
import { mockRouter, resetRouter } from '../../test/router.ts';
import { page } from '../../test/mock-fetch.ts';
import { CONVERSATION_ID, MEAL_ID, application, meal, me } from '../../test/fixtures.ts';
import { clearReturnTo, peekReturnTo } from '../auth/intent.ts';

// eslint-disable-next-line @typescript-eslint/no-require-imports -- jest.mock factories cannot use ESM imports
jest.mock('expo-router', () => require('../../test/router.ts').expoRouterMock);

const booked = { id: '11111111-1111-4111-8111-111111111111', revision: '1', status: 'REPORTED_CONFIRMED' as const, declaredCount: 4, reportedAt: '2026-10-20T10:00:00Z', stale: false };
const group = (o: object = {}) => ({ id: CONVERSATION_ID, version: '1', kind: 'GROUP' as const, mealId: MEAL_ID, title: 'Sunday dinner', canSend: true, dissolved: false, head: '3', ...o });

beforeEach(() => { resetRouter(); clearReturnTo(); });

describe('MyMealsScreen (demo Meals tab)', () => {
  it('signed out: demo heading and a sign-in action that returns to Meals', async () => {
    const app = createTestApp();
    await renderApp(app, <MyMealsScreen />);
    expect(screen.getByRole('header', { name: 'Your next good meal.' })).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Sign in' }));
    expect(mockRouter.push).toHaveBeenCalledWith('/sign-in');
    expect(peekReturnTo()).toBe('/meals');
  });

  it('shows five category tabs with the selected state and per-section empty copy', async () => {
    const app = createTestApp();
    await signIn(app, me());
    app.mock.on('GET', '/v1/me/meals', page([]));
    app.mock.on('GET', '/v1/inbox', page([]));
    await renderApp(app, <MyMealsScreen />);
    expect(await screen.findByText('A good meal is waiting.')).toBeOnTheScreen();
    expect(screen.getByText('Find a table that fits your evening.')).toBeOnTheScreen();
    for (const name of ['Upcoming', 'Applications', 'Hosting', 'Past', 'Cancelled']) expect(screen.getByRole('tab', { name })).toBeOnTheScreen();
    expect(screen.getByRole('tab', { name: 'Upcoming' })).toBeSelected();
    await fireEvent.press(screen.getByRole('button', { name: 'Explore meals' }));
    expect(mockRouter.navigate).toHaveBeenCalledWith('/');

    await fireEvent.press(screen.getByRole('tab', { name: 'Hosting' }));
    expect(await screen.findByText('Your table starts with you.')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Create a meal' }));
    expect(mockRouter.push).toHaveBeenCalledWith('/create');

    await fireEvent.press(screen.getByRole('tab', { name: 'Applications' }));
    expect(await screen.findByText('Your requests will appear here.')).toBeOnTheScreen();
  });

  it('upcoming seat: host-reported booking status and the group chat link from the Inbox', async () => {
    const app = createTestApp();
    await signIn(app, me());
    app.mock.on('GET', '/v1/me/meals', page([{ meal: meal({ bookingDeclaration: booked }), application: application({ state: 'CONFIRMED' }), role: 'GUEST' }]));
    app.mock.on('GET', '/v1/inbox', page([{ conversation: group(), lastMessage: null, unreadCount: 0 }]));
    await renderApp(app, <MyMealsScreen />);
    expect(await screen.findByText('Seat confirmed · Restaurant booked')).toBeOnTheScreen();
    await fireEvent.press(await screen.findByRole('button', { name: 'Open group chat' }));
    expect(mockRouter.push).toHaveBeenCalledWith(`/chat/${CONVERSATION_ID}`);
    await fireEvent.press(screen.getByRole('button', { name: 'Open Sunday dinner' }));
    expect(mockRouter.push).toHaveBeenCalledWith(`/meals/${MEAL_ID}`);
    expect(screen.queryByText(/payment|deposit|refund/i)).toBeNull();
  });

  it('hosting row offers Manage; past row offers Leave feedback and the read-only group history', async () => {
    const app = createTestApp();
    await signIn(app, me());
    app.mock.on('GET', '/v1/me/meals', (c) => page(c.query.get('section') === 'HOSTING'
      ? [{ meal: meal({ title: 'Hosted lunch' }), application: null, role: 'HOST' }]
      : c.query.get('section') === 'PAST' ? [{ meal: meal({ title: 'A little supper club', status: 'COMPLETED', allowedActions: ['POST_MEAL', 'OPEN_GROUP'] }), application: application({ state: 'CONFIRMED' }), role: 'GUEST' }] : []));
    app.mock.on('GET', '/v1/inbox', page([{ conversation: group({ canSend: false }), lastMessage: null, unreadCount: 0 }]));
    await renderApp(app, <MyMealsScreen />);
    await fireEvent.press(await screen.findByRole('tab', { name: 'Hosting' }));
    expect(await screen.findByText('You’re hosting · Reservation not yet reported')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Manage' }));
    expect(mockRouter.push).toHaveBeenCalledWith(`/meals/${MEAL_ID}/host`);

    await fireEvent.press(screen.getByRole('tab', { name: 'Past' }));
    expect(await screen.findByText('Completed')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Leave feedback' }));
    expect(mockRouter.push).toHaveBeenCalledWith(`/post-meal/${MEAL_ID}`);
    await fireEvent.press(screen.getByRole('button', { name: 'Open group chat · read-only history' }));
    expect(mockRouter.push).toHaveBeenCalledWith(`/chat/${CONVERSATION_ID}`);
    expect(screen.queryByRole('button', { name: 'Manage' })).toBeNull();
  });

  it('applications show application progress and never load the Inbox for chat links', async () => {
    const app = createTestApp();
    await signIn(app, me());
    app.mock.on('GET', '/v1/me/meals', (c) => page(c.query.get('section') === 'APPLICATIONS' ? [{ meal: meal(), application: application(), role: 'APPLICANT' }] : []));
    app.mock.on('GET', '/v1/inbox', page([]));
    await renderApp(app, <MyMealsScreen />);
    await waitFor(() => expect(app.mock.callsTo('GET', '/v1/inbox')).toHaveLength(1));
    await fireEvent.press(screen.getByRole('tab', { name: 'Applications' }));
    expect(await screen.findByText('Application pending')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: /Open group chat/ })).toBeNull();
    expect(app.mock.callsTo('GET', '/v1/inbox')).toHaveLength(1);
  });

  it('status line covers cancellation before booking state', () => {
    expect(rowStatus({ meal: meal({ status: 'CANCELLED' }), application: application({ state: 'CONFIRMED' }), role: 'GUEST' }, 'CANCELLED')).toBe('Meal cancelled');
    expect(rowStatus({ meal: meal(), application: application({ state: 'CANCELLED' }), role: 'APPLICANT' }, 'CANCELLED')).toBe('Participation cancelled');
    expect(rowStatus({ meal: meal({ status: 'CANCELLED' }), application: null, role: 'HOST' }, 'HOSTING')).toBe('Meal cancelled');
    expect(rowStatus({ meal: meal({ bookingDeclaration: { ...booked, stale: true } }), application: null, role: 'HOST' }, 'UPCOMING')).toBe('You’re hosting · Host to update reservation');
  });
});
