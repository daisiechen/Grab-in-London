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

  it('upcoming seat: host-reported booking status and the group chat link from the item', async () => {
    const app = createTestApp();
    await signIn(app, me());
    app.mock.on('GET', '/v1/me/meals', page([{ meal: meal({ bookingDeclaration: booked }), application: application({ state: 'CONFIRMED' }), role: 'GUEST', conversationId: CONVERSATION_ID }]));
    await renderApp(app, <MyMealsScreen />);
    expect(await screen.findByText('Seat confirmed · Restaurant booked')).toBeOnTheScreen();
    await fireEvent.press(await screen.findByRole('button', { name: 'Open group chat' }));
    expect(mockRouter.push).toHaveBeenCalledWith(`/chat/${CONVERSATION_ID}`);
    await fireEvent.press(screen.getByRole('button', { name: 'Open Sunday dinner' }));
    expect(mockRouter.push).toHaveBeenCalledWith(`/meals/${MEAL_ID}`);
    expect(screen.queryByText(/payment|deposit|refund/i)).toBeNull();
  });

  it('hosting row offers Manage; past row offers Leave feedback and its group chat', async () => {
    const app = createTestApp();
    await signIn(app, me());
    app.mock.on('GET', '/v1/me/meals', (c) => page(c.query.get('section') === 'HOSTING'
      ? [{ meal: meal({ title: 'Hosted lunch' }), application: null, role: 'HOST', conversationId: null }]
      : c.query.get('section') === 'PAST' ? [{ meal: meal({ title: 'A little supper club', status: 'COMPLETED', allowedActions: ['POST_MEAL', 'OPEN_GROUP'] }), application: application({ state: 'CONFIRMED' }), role: 'GUEST', conversationId: CONVERSATION_ID }] : []));
    await renderApp(app, <MyMealsScreen />);
    await fireEvent.press(await screen.findByRole('tab', { name: 'Hosting' }));
    expect(await screen.findByText('You’re hosting · Reservation not yet reported')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Manage' }));
    expect(mockRouter.push).toHaveBeenCalledWith(`/meals/${MEAL_ID}/host`);

    await fireEvent.press(screen.getByRole('tab', { name: 'Past' }));
    expect(await screen.findByText('Completed')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Leave feedback' }));
    expect(mockRouter.push).toHaveBeenCalledWith(`/post-meal/${MEAL_ID}`);
    await fireEvent.press(screen.getByRole('button', { name: 'Open group chat' }));
    expect(mockRouter.push).toHaveBeenCalledWith(`/chat/${CONVERSATION_ID}`);
    expect(screen.queryByRole('button', { name: 'Manage' })).toBeNull();
  });

  it('applications show application progress, no chat link, and the tab never loads the Inbox', async () => {
    const app = createTestApp();
    await signIn(app, me());
    app.mock.on('GET', '/v1/me/meals', (c) => page(c.query.get('section') === 'APPLICATIONS' ? [{ meal: meal(), application: application(), role: 'APPLICANT', conversationId: CONVERSATION_ID }] : []));
    await renderApp(app, <MyMealsScreen />);
    await waitFor(() => expect(app.mock.callsTo('GET', '/v1/me/meals')).toHaveLength(1));
    await fireEvent.press(screen.getByRole('tab', { name: 'Applications' }));
    expect(await screen.findByText('Application pending')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: /Open group chat/ })).toBeNull();
    expect(app.mock.callsTo('GET', '/v1/inbox')).toHaveLength(0);
  });

  it('status line covers cancellation before booking state', () => {
    expect(rowStatus({ meal: meal({ status: 'CANCELLED' }), application: application({ state: 'CONFIRMED' }), role: 'GUEST', conversationId: null }, 'CANCELLED')).toBe('Meal cancelled');
    expect(rowStatus({ meal: meal(), application: application({ state: 'CANCELLED' }), role: 'APPLICANT', conversationId: null }, 'CANCELLED')).toBe('Participation cancelled');
    expect(rowStatus({ meal: meal({ status: 'CANCELLED' }), application: null, role: 'HOST', conversationId: null }, 'HOSTING')).toBe('Meal cancelled');
    expect(rowStatus({ meal: meal({ bookingDeclaration: { ...booked, stale: true } }), application: null, role: 'HOST', conversationId: null }, 'UPCOMING')).toBe('You’re hosting · Host to update reservation');
  });
});
