import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { MealDetailScreen } from './MealDetailScreen.tsx';
import { ApplyScreen } from './ApplyScreen.tsx';
import { HostScreen } from './HostScreen.tsx';
import { MyMealsScreen } from './MyMealsScreen.tsx';
import { createTestApp, renderApp, signIn } from '../../test/render.tsx';
import { mockRouter, resetRouter, routeParams } from '../../test/router.ts';
import { fail, ok, page } from '../../test/mock-fetch.ts';
import { APP_ID, MEAL_ID, application, incompleteMe, meal, me, publicProfile } from '../../test/fixtures.ts';
import { clearReturnTo, peekReturnTo } from '../auth/intent.ts';

// eslint-disable-next-line @typescript-eslint/no-require-imports -- jest.mock factories cannot use ESM imports
jest.mock('expo-router', () => require('../../test/router.ts').expoRouterMock);

const MEAL_PATH = `/v1/meals/${MEAL_ID}`;
beforeEach(() => {
  resetRouter();
  clearReturnTo();
  routeParams.current = { mealId: MEAL_ID };
});

describe('MealDetailScreen (S06)', () => {
  it('guest sees public detail with P-05 “Not provided”; Request to join goes to sign-in without applying (QA-AUTH-001)', async () => {
    const app = createTestApp();
    app.mock.on('GET', MEAL_PATH, ok({ meal: meal(), myApplication: null, conversationId: null }));
    await renderApp(app, <MealDetailScreen />);
    expect(await screen.findByText('Sunday dinner')).toBeOnTheScreen();
    expect(screen.getByText('Sun 25 Oct · 19:00 GMT')).toBeOnTheScreen();
    expect(screen.getByText('Cuisine: Not provided · Dietary: Not provided')).toBeOnTheScreen();
    expect(screen.getByText('£20–£35 per person · Pay at the restaurant')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Request to join' }));
    expect(mockRouter.push).toHaveBeenCalledWith('/sign-in');
    expect(peekReturnTo()).toBe(`/meals/${MEAL_ID}/apply`);
    expect(app.mock.callsTo('POST', /applications/)).toHaveLength(0);
  });

  it('shows the unavailable-restaurant notice instead of stale provider data', async () => {
    const app = createTestApp();
    const m = meal();
    app.mock.on('GET', MEAL_PATH, ok({ meal: { ...m, venue: { ...m.venue, available: false, name: null, address: null, location: null } }, myApplication: null, conversationId: null }));
    await renderApp(app, <MealDetailScreen />);
    expect(await screen.findByText('Restaurant information temporarily unavailable')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Open in Google Maps' })).toBeNull();
  });

  it('withdraw requires confirmation and sends If-Match of the application', async () => {
    const app = createTestApp();
    await signIn(app, me());
    app.mock.on('GET', MEAL_PATH, ok({ meal: meal({ allowedActions: ['WITHDRAW'] }), myApplication: application(), conversationId: null }));
    app.mock.on('POST', `/v1/applications/${APP_ID}/withdraw`, ok(application({ state: 'WITHDRAWN', version: '3' })));
    await renderApp(app, <MealDetailScreen />);
    await fireEvent.press(await screen.findByRole('button', { name: 'Withdraw request' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Keep my request' }));
    expect(app.mock.callsTo('POST', /withdraw/)).toHaveLength(0);
    await fireEvent.press(screen.getAllByRole('button', { name: 'Withdraw request' })[0]!);
    const confirm = screen.getAllByRole('button', { name: 'Withdraw request' });
    await fireEvent.press(confirm[confirm.length - 1]!);
    await waitFor(() => expect(app.mock.callsTo('POST', /withdraw/)).toHaveLength(1));
    expect(app.mock.callsTo('POST', /withdraw/)[0]?.headers['if-match']).toBe('"2"');
  });
});

describe('ApplyScreen (S07, QA-INPUT-017..020)', () => {
  it('enforces 20–300 characters, keeps the draft across remounts and reports a full table', async () => {
    const app = createTestApp();
    await signIn(app, me());
    app.mock.on('GET', MEAL_PATH, ok({ meal: meal(), myApplication: null, conversationId: null }));
    app.mock.on('POST', `${MEAL_PATH}/applications`, fail(409, 'MEAL_FULL'), 1);
    const first = await renderApp(app, <ApplyScreen />);
    await fireEvent.changeText(await screen.findByLabelText('Your introduction'), 'x'.repeat(19));
    await fireEvent.press(screen.getByRole('button', { name: 'Send request' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Write a short introduction of 20–300 characters.');
    expect(app.mock.callsTo('POST', /applications/)).toHaveLength(0);

    await fireEvent.changeText(screen.getByLabelText('Your introduction'), 'I recently moved here and love trying new food.');
    await first.unmount();
    await renderApp(app, <ApplyScreen />);
    expect(await screen.findByLabelText('Your introduction')).toHaveDisplayValue('I recently moved here and love trying new food.');
    await fireEvent.press(screen.getByRole('button', { name: 'Send request' }));
    expect(await screen.findByText('This table is full.')).toBeOnTheScreen();
    expect(mockRouter.replace).not.toHaveBeenCalled();
  });

  it('an incomplete profile is sent to setup with the application remembered, nothing submitted', async () => {
    const app = createTestApp();
    await signIn(app, incompleteMe());
    app.mock.on('GET', MEAL_PATH, ok({ meal: meal(), myApplication: null, conversationId: null }));
    await renderApp(app, <ApplyScreen />);
    await fireEvent.changeText(await screen.findByLabelText('Your introduction'), 'I recently moved here and love trying new food.');
    await fireEvent.press(screen.getByRole('button', { name: 'Send request' }));
    expect(mockRouter.push).toHaveBeenCalledWith('/profile-setup');
    expect(peekReturnTo()).toBe(`/meals/${MEAL_ID}/apply`);
    expect(app.mock.callsTo('POST', /applications/)).toHaveLength(0);
  });

  it('a successful request clears the draft and returns to the meal', async () => {
    const app = createTestApp();
    await signIn(app, me());
    app.mock.on('GET', MEAL_PATH, ok({ meal: meal(), myApplication: null, conversationId: null }));
    app.mock.on('POST', `${MEAL_PATH}/applications`, ok(application(), 201));
    await renderApp(app, <ApplyScreen />);
    await fireEvent.changeText(await screen.findByLabelText('Your introduction'), 'I recently moved here and love trying new food.');
    await fireEvent.press(screen.getByRole('button', { name: 'Send request' }));
    await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith(`/meals/${MEAL_ID}`));
    expect(app.mock.callsTo('POST', /applications/)[0]?.body).toEqual({ message: 'I recently moved here and love trying new food.' });
    expect(app.services.drafts.get(`apply:${MEAL_ID}`)).toBeUndefined();
  });
});

describe('HostScreen (S10/S11)', () => {
  it('approves with If-Match; a last-seat conflict refreshes instead of replaying (QA-DB-001)', async () => {
    const app = createTestApp();
    await signIn(app, me());
    const pending = application({ applicant: publicProfile('11111111-2222-4333-8444-555555555555', 'Leo'), message: 'I recently moved here and love trying new food.' });
    app.mock.on('GET', MEAL_PATH, ok({ meal: meal({ allowedActions: ['REVIEW_APPLICATIONS', 'CANCEL', 'DECLARE_BOOKING'] }), myApplication: null, conversationId: null }));
    app.mock.on('GET', `${MEAL_PATH}/applications`, page([pending]));
    app.mock.on('POST', `/v1/applications/${APP_ID}/decision`, fail(409, 'MEAL_FULL'));
    await renderApp(app, <HostScreen />);
    await fireEvent.press(await screen.findByRole('button', { name: 'Approve Leo' }));
    expect(await screen.findByText('This table is full.')).toBeOnTheScreen();
    const [decision] = app.mock.callsTo('POST', /decision/);
    expect(decision?.headers['if-match']).toBe('"2"');
    expect(decision?.body).toEqual({ decision: 'APPROVE' });
    expect(app.mock.callsTo('GET', `${MEAL_PATH}/applications`).length).toBeGreaterThanOrEqual(2);
  });

  it('cancelling the meal needs a reason and a separate confirmation', async () => {
    const app = createTestApp();
    await signIn(app, me());
    app.mock.on('GET', MEAL_PATH, ok({ meal: meal({ allowedActions: ['CANCEL'] }), myApplication: null, conversationId: null }));
    app.mock.on('GET', `${MEAL_PATH}/applications`, page([]));
    app.mock.on('POST', `${MEAL_PATH}/cancel`, ok(meal({ status: 'CANCELLED', cancelReason: 'host' })));
    await renderApp(app, <HostScreen />);
    await fireEvent.press(await screen.findByRole('button', { name: 'Cancel meal for everyone' }));
    const confirmButtons = screen.getAllByRole('button', { name: 'Cancel meal for everyone' });
    expect(confirmButtons[confirmButtons.length - 1]).toBeDisabled();
    await fireEvent.press(screen.getByRole('radio', { name: 'I can’t make it' }));
    await fireEvent.press(confirmButtons[confirmButtons.length - 1]!);
    await waitFor(() => expect(app.mock.callsTo('POST', `${MEAL_PATH}/cancel`)).toHaveLength(1));
    expect(app.mock.callsTo('POST', `${MEAL_PATH}/cancel`)[0]).toMatchObject({ body: { reason: 'host' }, headers: { 'if-match': '"7"' } });
  });
});

describe('MyMealsScreen', () => {
  it('loads each section from the server', async () => {
    const app = createTestApp();
    await signIn(app, me());
    app.mock.on('GET', '/v1/me/meals', (c) => page(c.query.get('section') === 'HOSTING' ? [{ meal: meal({ title: 'Hosted lunch' }), application: null, role: 'HOST' }] : []));
    await renderApp(app, <MyMealsScreen />);
    expect(await screen.findByText('Nothing here yet.')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('radio', { name: 'Hosting' }));
    expect(await screen.findByText('Hosted lunch')).toBeOnTheScreen();
    expect(app.mock.calls.filter((c) => c.path === '/v1/me/meals').map((c) => c.query.get('section'))).toEqual(['UPCOMING', 'HOSTING']);
  });
});
