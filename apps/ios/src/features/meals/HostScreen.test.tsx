import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { HostScreen } from './HostScreen.tsx';
import { createTestApp, renderApp, signIn } from '../../test/render.tsx';
import { mockRouter, resetRouter, routeParams } from '../../test/router.ts';
import { ok, page } from '../../test/mock-fetch.ts';
import { APP_ID, CONVERSATION_ID, MEAL_ID, application, meal, me, publicProfile } from '../../test/fixtures.ts';
import { layout, mockContentGeometry } from '../create/reveal-test-utils.ts';

// eslint-disable-next-line @typescript-eslint/no-require-imports -- jest.mock factories cannot use ESM imports
jest.mock('expo-router', () => require('../../test/router.ts').expoRouterMock);

const MEAL_PATH = `/v1/meals/${MEAL_ID}`;
const LEO_ID = '11111111-2222-4333-8444-555555555555';
const SAM_ID = '22222222-3333-4444-8555-666666666666';
const HOST_ACTIONS = ['REVIEW_APPLICATIONS', 'CANCEL', 'DECLARE_BOOKING'] as const;

beforeEach(() => {
  resetRouter();
  routeParams.current = { mealId: MEAL_ID };
});
afterEach(() => jest.restoreAllMocks());

type MealOverrides = Parameters<typeof meal>[0];
async function setup(overrides: MealOverrides = {}, apps: unknown[] = [], conversationId: string | null = CONVERSATION_ID) {
  const app = createTestApp();
  await signIn(app, me());
  app.mock.on('GET', MEAL_PATH, ok({ meal: meal({ allowedActions: [...HOST_ACTIONS], ...overrides }), myApplication: null, conversationId }));
  app.mock.on('GET', `${MEAL_PATH}/applications`, page(apps));
  await renderApp(app, <HostScreen />);
  return app;
}

const leoRequest = () => application({ applicant: { ...publicProfile(LEO_ID, 'Leo'), background: { work: 'Researcher', hometown: 'Lisbon' } }, message: 'I recently moved here and love trying new food.' });

describe('HostScreen · Your guest list (J02-R07)', () => {
  it('shows each request as a card with the applicant, their context and their message, plus seats progress', async () => {
    await setup({ members: [publicProfile(), publicProfile(SAM_ID, 'Sam')], confirmedCount: 2 }, [leoRequest()]);
    expect(await screen.findByLabelText('Request from Leo')).toBeOnTheScreen();
    expect(screen.getByText('Researcher · From Lisbon')).toBeOnTheScreen();
    expect(screen.getByText('“I recently moved here and love trying new food.”')).toBeOnTheScreen();
    expect(screen.getByText('Requests · 1')).toBeOnTheScreen();
    expect(screen.getByLabelText('2 of 4 seats confirmed, minimum 2')).toBeOnTheScreen();
    expect(screen.getByText('At the table')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'View Sam’s profile' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'You, the host, Maya' })).toBeOnTheScreen();
  });

  it('the whole request card and the avatar open the applicant’s public profile', async () => {
    await setup({}, [leoRequest()]);
    await fireEvent.press(await screen.findByLabelText('Request from Leo'));
    expect(mockRouter.push).toHaveBeenCalledWith(`/profiles/${LEO_ID}`);
    await fireEvent.press(screen.getByRole('button', { name: 'View Leo’s profile' }));
    expect(mockRouter.push).toHaveBeenCalledTimes(2);
  });

  it('approves with If-Match and reports the new seat; decline sends DECLINE', async () => {
    const app = await setup({}, [leoRequest()]);
    app.mock.on('POST', `/v1/applications/${APP_ID}/decision`, ok({ application: { ...leoRequest(), state: 'CONFIRMED', version: '3' }, mealVersion: '8', conversationId: CONVERSATION_ID }));
    await fireEvent.press(await screen.findByRole('button', { name: 'Approve Leo' }));
    expect(await screen.findByText('Leo has a seat.')).toBeOnTheScreen();
    const [approve] = app.mock.callsTo('POST', /decision/);
    expect(approve?.headers['if-match']).toBe('"2"');
    expect(approve?.body).toEqual({ decision: 'APPROVE' });
    await fireEvent.press(screen.getByRole('button', { name: 'Decline Leo' }));
    await waitFor(() => expect(app.mock.callsTo('POST', /decision/)).toHaveLength(2));
    expect(app.mock.callsTo('POST', /decision/)[1]?.body).toEqual({ decision: 'DECLINE' });
  });

  it('a full table cannot approve more guests, and confirmed guests are not listed twice', async () => {
    await setup({ confirmedCount: 4, capacity: 4 }, [leoRequest(), application({ id: '33333333-4444-4555-8666-777777777777', state: 'CONFIRMED', applicant: publicProfile(SAM_ID, 'Sam') })]);
    expect(await screen.findByRole('button', { name: 'Approve Leo' })).toBeDisabled();
    expect(screen.getByText('Your table is full, so new approvals aren’t possible.')).toBeOnTheScreen();
    expect(screen.queryByText('Earlier requests')).toBeNull();
  });

  it('updates the external reservation in place with the status and current guest count (If-Match)', async () => {
    const app = await setup({ confirmedCount: 3, version: '7', bookingDeclaration: { id: '44444444-5555-4666-8777-888888888888', revision: '1', status: 'REPORTED_CONFIRMED', declaredCount: 4, reportedAt: '2026-10-21T09:00:00Z', stale: true } });
    expect(await screen.findByText('3 people are confirmed now. Check with the restaurant and update your reservation.')).toBeOnTheScreen();
    app.mock.on('POST', `${MEAL_PATH}/booking-declarations`, ok(meal(), 201));
    await fireEvent.press(screen.getByRole('button', { name: 'Update reservation' }));
    const save = screen.getByRole('button', { name: 'Save reservation status' });
    expect(save).toBeDisabled();
    await fireEvent.press(screen.getByRole('radio', { name: 'Booked' }));
    await fireEvent.press(save);
    await waitFor(() => expect(app.mock.callsTo('POST', `${MEAL_PATH}/booking-declarations`)).toHaveLength(1));
    expect(app.mock.callsTo('POST', `${MEAL_PATH}/booking-declarations`)[0]).toMatchObject({ body: { status: 'REPORTED_CONFIRMED', count: 3 }, headers: { 'if-match': '"7"' } });
    expect(await screen.findByText('Reservation status updated.')).toBeOnTheScreen();
  });

  it('a current declaration for the table size does not nag the host to update it', async () => {
    await setup({ confirmedCount: 1, bookingDeclaration: { id: '44444444-5555-4666-8777-888888888888', revision: '1', status: 'REPORTED_CONFIRMED', declaredCount: 4, reportedAt: '2026-10-21T09:00:00Z', stale: false } });
    expect(await screen.findByText('Restaurant booked')).toBeOnTheScreen();
    expect(screen.getByText('For 4 people · reported Wed 21 Oct')).toBeOnTheScreen();
    expect(screen.queryByText(/confirmed now\. Check with the restaurant/)).toBeNull();
  });

  it('explains the arrangement lock before and after the first approval', async () => {
    await setup({ arrangementLocked: false });
    expect(await screen.findByText(/Nobody is approved yet\. Once you approve the first guest/)).toBeOnTheScreen();
  });

  it('a locked arrangement says to cancel and create a new meal', async () => {
    await setup({ arrangementLocked: true });
    expect(await screen.findByText(/locked after the first approval\. To change them, cancel and create a new meal\./)).toBeOnTheScreen();
  });

  it('pins the group chat as the primary action', async () => {
    await setup();
    await fireEvent.press(await screen.findByRole('button', { name: 'Open group chat' }));
    expect(mockRouter.push).toHaveBeenCalledWith(`/chat/${CONVERSATION_ID}`);
  });

  it('the header uses the app’s “London time” wording instead of a raw offset label', async () => {
    await setup();
    const header = await screen.findByText(/London time · /);
    expect(header).toHaveTextContent(/^\w{3} \d{1,2} \w{3} · \d{2}:\d{2} · London time · /);
    expect(header).not.toHaveTextContent(/GMT|BST/);
  });

  it('expanding “Update reservation” scrolls the form fully above the pinned chat button', async () => {
    const { scrollTo } = mockContentGeometry({ y: 900, height: 260 });
    await setup();
    await fireEvent(await screen.findByTestId('host-scroll'), 'layout', layout(560));
    await fireEvent.press(screen.getByRole('button', { name: 'Update reservation' }));
    expect(scrollTo).not.toHaveBeenCalled();
    await fireEvent(screen.getByTestId('reservation-form'), 'layout', layout(260));
    expect(scrollTo).toHaveBeenCalledWith({ y: 900 + 260 + 12 - 560, animated: true });
    expect(screen.getByRole('button', { name: 'Save reservation status' })).toBeOnTheScreen();
  });

  it('a cancelled meal says so, keeps the chat and offers no cancel or decisions', async () => {
    await setup({ status: 'CANCELLED', cancelReason: 'host', allowedActions: [] }, [leoRequest()]);
    expect(await screen.findByText(/This meal is cancelled\. Please cancel or adjust the restaurant reservation yourself/)).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Cancel meal for everyone' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Update reservation' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Approve Leo' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Open group chat' })).toBeOnTheScreen();
  });
});
