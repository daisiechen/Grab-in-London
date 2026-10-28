import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { ApplicationStatusScreen, applicationSteps } from './ApplicationStatusScreen.tsx';
import { ApplyScreen } from './ApplyScreen.tsx';
import { createTestApp, renderApp, signIn } from '../../test/render.tsx';
import { mockRouter, resetRouter, routeParams } from '../../test/router.ts';
import { networkDown, ok } from '../../test/mock-fetch.ts';
import { APP_ID, CONVERSATION_ID, MEAL_ID, application, meal, me } from '../../test/fixtures.ts';

// eslint-disable-next-line @typescript-eslint/no-require-imports -- jest.mock factories cannot use ESM imports
jest.mock('expo-router', () => require('../../test/router.ts').expoRouterMock);

const MEAL_PATH = `/v1/meals/${MEAL_ID}`;
beforeEach(() => {
  resetRouter();
  routeParams.current = { mealId: MEAL_ID };
});

describe('applicationSteps', () => {
  it('tracks Sent → Host reviewing → outcome', () => {
    expect(applicationSteps('PENDING').map((s) => [s.label, s.tone])).toEqual([['Sent', 'done'], ['Host reviewing', 'current'], ['Seat confirmed', 'todo']]);
    expect(applicationSteps('CONFIRMED').map((s) => s.tone)).toEqual(['done', 'done', 'done']);
    expect(applicationSteps('DECLINED')[2]).toMatchObject({ label: 'Declined', tone: 'stopped' });
    expect(applicationSteps('EXPIRED')[2]).toMatchObject({ label: 'Expired', tone: 'stopped' });
    expect(applicationSteps('WITHDRAWN')[2]).toMatchObject({ label: 'Withdrawn', tone: 'stopped' });
    expect(applicationSteps('CANCELLED')[2]).toMatchObject({ label: 'Cancelled', tone: 'stopped' });
  });
});

describe('ApplicationStatusScreen (Your application)', () => {
  it('pending: shows progress, next steps, budget and pay-at-venue copy; links back to the meal', async () => {
    const app = createTestApp();
    await signIn(app, me());
    app.mock.on('GET', MEAL_PATH, ok({ meal: meal({ allowedActions: ['WITHDRAW'] }), myApplication: application({ message: 'I recently moved here and love trying new food.' }), conversationId: null }));
    await renderApp(app, <ApplicationStatusScreen />);
    expect(await screen.findByText('Your hello is on its way.')).toBeOnTheScreen();
    expect(screen.getByLabelText('Application progress: Sent, done; Host reviewing, in progress; Seat confirmed')).toBeOnTheScreen();
    expect(screen.getByText(/Maya will review your introduction/)).toBeOnTheScreen();
    expect(screen.getByText('Expected £20–35 per person')).toBeOnTheScreen();
    expect(screen.getByText('Reservation not yet reported')).toBeOnTheScreen();
    expect(screen.getByText('Application pending')).toBeOnTheScreen();
    expect(screen.getByText('“I recently moved here and love trying new food.”')).toBeOnTheScreen();
    expect(screen.getByText('No payment is due in the app. Everyone pays their own share at the restaurant.')).toBeOnTheScreen();
    expect(screen.queryByText(/deposit|refund|checkout/i)).toBeNull();

    await fireEvent.press(screen.getByRole('button', { name: 'View Sunday dinner' }));
    expect(mockRouter.back).toHaveBeenCalled();
    await fireEvent.press(screen.getByRole('button', { name: 'Track in Inbox' }));
    expect(mockRouter.navigate).toHaveBeenCalledWith('/inbox');
  });

  it('withdraw asks for confirmation, then sends If-Match with a stable key and refreshes', async () => {
    const app = createTestApp();
    await signIn(app, me());
    app.mock.on('GET', MEAL_PATH, ok({ meal: meal({ allowedActions: ['WITHDRAW'] }), myApplication: application(), conversationId: null }), 2);
    app.mock.on('GET', MEAL_PATH, ok({ meal: meal({ allowedActions: ['APPLY'] }), myApplication: application({ state: 'WITHDRAWN', version: '3' }), conversationId: null }));
    app.mock.on('POST', `/v1/applications/${APP_ID}/withdraw`, networkDown, 1);
    app.mock.on('POST', `/v1/applications/${APP_ID}/withdraw`, ok(application({ state: 'WITHDRAWN', version: '3' })));
    await renderApp(app, <ApplicationStatusScreen />);

    await fireEvent.press(await screen.findByRole('button', { name: 'Withdraw request' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Keep my request' }));
    expect(app.mock.callsTo('POST', /withdraw/)).toHaveLength(0);

    const confirmWithdraw = async () => {
      await fireEvent.press(screen.getAllByRole('button', { name: 'Withdraw request' })[0]!);
      const buttons = screen.getAllByRole('button', { name: 'Withdraw request' });
      await fireEvent.press(buttons[buttons.length - 1]!);
    };
    await confirmWithdraw();
    await waitFor(() => expect(app.mock.callsTo('POST', /withdraw/)).toHaveLength(1));
    expect(await screen.findByRole('alert')).toBeOnTheScreen();
    await confirmWithdraw();
    expect(await screen.findByText('Your request is withdrawn.')).toBeOnTheScreen();
    const calls = app.mock.callsTo('POST', /withdraw/);
    expect(calls).toHaveLength(2);
    expect(calls.map((c) => c.headers['if-match'])).toEqual(['"2"', '"2"']);
    expect(calls[0]?.headers['idempotency-key']).toBe(calls[1]?.headers['idempotency-key']);
    expect(screen.queryByRole('button', { name: 'Withdraw request' })).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Apply again' }));
    expect(mockRouter.replace).toHaveBeenCalledWith(`/meals/${MEAL_ID}/apply`);
  });

  it('confirmed: opens the group chat', async () => {
    const app = createTestApp();
    await signIn(app, me());
    app.mock.on('GET', MEAL_PATH, ok({ meal: meal({ allowedActions: ['OPEN_GROUP', 'LEAVE'] }), myApplication: application({ state: 'CONFIRMED' }), conversationId: CONVERSATION_ID }));
    await renderApp(app, <ApplicationStatusScreen />);
    expect(await screen.findByText('You’re at the table.')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Withdraw request' })).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Open group chat' }));
    expect(mockRouter.push).toHaveBeenCalledWith(`/chat/${CONVERSATION_ID}`);
  });

  it('declined or expired: points to another table', async () => {
    const app = createTestApp();
    await signIn(app, me());
    app.mock.on('GET', MEAL_PATH, ok({ meal: meal({ allowedActions: [] }), myApplication: application({ state: 'DECLINED' }), conversationId: null }));
    await renderApp(app, <ApplicationStatusScreen />);
    expect(await screen.findByText('Another table awaits.')).toBeOnTheScreen();
    expect(screen.getByLabelText(/Declined$/)).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Find another table' }));
    expect(mockRouter.navigate).toHaveBeenCalledWith('/');
  });

  it('without an application it offers the meal instead', async () => {
    const app = createTestApp();
    await signIn(app, me());
    app.mock.on('GET', MEAL_PATH, ok({ meal: meal(), myApplication: null, conversationId: null }));
    mockRouter.canGoBack.mockImplementation(() => false);
    await renderApp(app, <ApplicationStatusScreen />);
    expect(await screen.findByText('No application yet.')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'View the table' }));
    expect(mockRouter.replace).toHaveBeenCalledWith(`/meals/${MEAL_ID}`);
  });
});

describe('ApplyScreen (Request a seat) layout', () => {
  it('shows the meal summary, a live 20–300 counter and the profile line', async () => {
    const app = createTestApp();
    await signIn(app, me());
    app.mock.on('GET', MEAL_PATH, ok({ meal: meal(), myApplication: null, conversationId: null }));
    await renderApp(app, <ApplyScreen />);
    expect(await screen.findByText('Pull up a chair.')).toBeOnTheScreen();
    expect(screen.getByText('£20–35 per person · 1 of 4 confirmed')).toBeOnTheScreen();
    expect(screen.getByTestId('intro-counter')).toHaveTextContent('0/300');
    await fireEvent.changeText(screen.getByLabelText('Your introduction'), '  Hello there, nice to meet!  ');
    expect(screen.getByTestId('intro-counter')).toHaveTextContent('26/300');
    expect(screen.getByText(/Applying doesn’t reserve a seat or charge you/)).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Edit profile' }));
    expect(mockRouter.push).toHaveBeenCalledWith('/profile-edit');
    await fireEvent.press(screen.getByRole('button', { name: 'View Sunday dinner' }));
    expect(mockRouter.back).toHaveBeenCalled();
  });

  it('an existing pending request offers its status instead of a second request', async () => {
    const app = createTestApp();
    await signIn(app, me());
    app.mock.on('GET', MEAL_PATH, ok({ meal: meal({ allowedActions: ['WITHDRAW'] }), myApplication: application(), conversationId: null }));
    await renderApp(app, <ApplyScreen />);
    expect(await screen.findByText('You’ve already sent a request for this table.')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Send request' })).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'View application' }));
    expect(mockRouter.replace).toHaveBeenCalledWith(`/meals/${MEAL_ID}/status`);
    await waitFor(() => expect(app.mock.callsTo('POST', /applications/)).toHaveLength(0));
  });
});
