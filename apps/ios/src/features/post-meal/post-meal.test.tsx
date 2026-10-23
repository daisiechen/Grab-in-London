import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { PostMealScreen, attendanceText } from './PostMealScreen.tsx';
import { createTestApp, renderApp, signIn } from '../../test/render.tsx';
import { mockRouter, resetRouter, routeParams } from '../../test/router.ts';
import { fail, networkDown, ok } from '../../test/mock-fetch.ts';
import { resetFeedbackMemory } from './FeedbackBlock.tsx';
import { HOST_ID, MEAL_ID, USER_ID, me, publicProfile } from '../../test/fixtures.ts';

// eslint-disable-next-line @typescript-eslint/no-require-imports -- jest.mock factories cannot use ESM imports
jest.mock('expo-router', () => require('../../test/router.ts').expoRouterMock);

const PATH = `/v1/meals/${MEAL_ID}/post-meal`;
const att = (subjectId: string, o: object = {}) => ({ subjectId, value: 'unknown' as const, source: null, selfValue: null, hostValue: null, version: '1', ...o });
function state(o: object = {}) {
  return {
    mealId: MEAL_ID, windowOpensAt: '2026-10-25T22:00:00Z', windowClosesAt: '2026-11-01T22:00:00Z', windowOpen: true,
    eligibleMembers: [publicProfile(USER_ID, 'Alex'), publicProfile(HOST_ID, 'Maya')],
    attendance: [att(USER_ID), att(HOST_ID, { value: 'absent', source: 'HOST', hostValue: 'absent' })],
    experience: null, reviews: [], reconnect: [{ subjectId: HOST_ID, selected: false, version: '1', connection: 'CLOSED' as const }],
    ...o,
  };
}

beforeEach(() => {
  resetFeedbackMemory();
  resetRouter();
  routeParams.current = { mealId: MEAL_ID };
});

describe('attendanceText', () => {
  it('keeps UNKNOWN distinct from absent and names the source', () => {
    expect(attendanceText(att(USER_ID))).toBe('Not reported yet');
    expect(attendanceText(att(USER_ID, { value: 'absent', source: 'HOST' }))).toBe('Didn’t come · host reported');
    expect(attendanceText(att(USER_ID, { value: 'present', source: 'SELF' }))).toBe('Came · they reported');
  });
});

describe('PostMealScreen (S19/S21)', () => {
  it('lets the host open an eligible table member profile even after the feedback window closes', async () => {
    const app = createTestApp(); await signIn(app, me({ id: HOST_ID }));
    app.mock.on('GET', PATH, ok(state({ windowOpen: false })));
    await renderApp(app, <PostMealScreen />);
    await fireEvent.press(await screen.findByRole('button', { name: 'View Alex’s profile' }));
    expect(mockRouter.push).toHaveBeenCalledWith(`/profiles/${USER_ID}`);
    expect(screen.queryByRole('button', { name: 'View Maya’s profile' })).toBeNull();
    expect(app.mock.callsTo('PUT', /reconnect|attendance/)).toHaveLength(0);
  });

  it('offers profiles only for authoritative eligible members, not unknown attendance subjects', async () => {
    const app = createTestApp(); await signIn(app, me());
    app.mock.on('GET', PATH, ok(state({ eligibleMembers: [publicProfile(USER_ID, 'Alex')], attendance: [att(USER_ID), att(HOST_ID)] })));
    await renderApp(app, <PostMealScreen />);
    await screen.findByText('You · Not reported yet');
    expect(screen.queryByRole('button', { name: /profile/ })).toBeNull();
  });

  it('describes a forbidden reconnect as neutral unavailability without retrying or exposing a block', async () => {
    const app = createTestApp(); await signIn(app, me());
    app.mock.on('GET', PATH, ok(state({ attendance: [att(USER_ID, { value: 'present', source: 'SELF' })] })));
    app.mock.on('PUT', `/v1/meals/${MEAL_ID}/reconnect/${HOST_ID}`, fail(403, 'FORBIDDEN'));
    await renderApp(app, <PostMealScreen />);
    await fireEvent.press(await screen.findByRole('checkbox', { name: 'I’d meet Maya again' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Save feedback for Maya' }));
    expect(await screen.findByText('Reconnect choice: Couldn’t be saved')).toBeOnTheScreen();
    expect(screen.queryByText(/blocked|blocking/i)).toBeNull();
    expect(app.mock.callsTo('PUT', /reconnect/)).toHaveLength(1);
    expect(screen.getByText('Not chosen')).toBeOnTheScreen();
  });

  it('self attendance uses If-Match; feedback opens only once present', async () => {
    const app = createTestApp();
    await signIn(app, me());
    app.mock.on('GET', PATH, ok(state()), 1);
    app.mock.on('GET', PATH, ok(state({ attendance: [att(USER_ID, { value: 'present', source: 'SELF', selfValue: 'present', version: '2' }), att(HOST_ID)] })));
    app.mock.on('PUT', `/v1/meals/${MEAL_ID}/attendance/${USER_ID}`, ok(att(USER_ID, { value: 'present', source: 'SELF', version: '2' })));
    await renderApp(app, <PostMealScreen />);
    expect(await screen.findByText('You · Not reported yet')).toBeOnTheScreen();
    expect(screen.getByText('Maya · Didn’t come · host reported')).toBeOnTheScreen();
    expect(screen.queryByText('How was the meal? (private)')).toBeNull();

    await fireEvent.press(screen.getByRole('button', { name: 'I came' }));
    expect(await screen.findByText('How was the meal? (private)')).toBeOnTheScreen();
    const [put] = app.mock.callsTo('PUT', /attendance/);
    expect(put).toMatchObject({ body: { value: 'present' }, headers: { 'if-match': '"1"' } });
    expect(put?.headers['idempotency-key']).toBeDefined();
  });

  it('a closed window is read-only and a conflict refreshes', async () => {
    const app = createTestApp();
    await signIn(app, me());
    app.mock.on('GET', PATH, ok(state({ windowOpen: false })));
    await renderApp(app, <PostMealScreen />);
    expect(await screen.findByText('The feedback window for this meal has closed.')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'I came' })).toBeNull();
  });

  it('meet-again version conflict reloads the latest state and keeps the draft', async () => {
    const app = createTestApp();
    await signIn(app, me());
    app.mock.on('GET', PATH, ok(state({ attendance: [att(USER_ID, { value: 'present', source: 'SELF' })] })));
    app.mock.on('PUT', `/v1/meals/${MEAL_ID}/reconnect/${HOST_ID}`, fail(409, 'VERSION_CONFLICT', { currentVersion: '2' }));
    await renderApp(app, <PostMealScreen />);
    await fireEvent.press(await screen.findByRole('checkbox', { name: 'I’d meet Maya again' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Save feedback for Maya' }));
    expect(await screen.findByText('Reconnect choice: Version conflict')).toBeOnTheScreen();
    await waitFor(() => expect(app.mock.callsTo('GET', PATH).length).toBeGreaterThanOrEqual(2));
    expect(app.mock.callsTo('PUT', /reconnect/)[0]).toMatchObject({ body: { selected: true }, headers: { 'if-match': '"1"' } });
    expect(screen.getByRole('checkbox', { name: 'I’d meet Maya again' }).props.accessibilityState.checked).toBe(true);
  });

  it('Save feedback writes only dirty items, reference first, and no-change writes nothing', async () => {
    const app = createTestApp();
    await signIn(app, me());
    app.mock.on('GET', PATH, ok(state({ attendance: [att(USER_ID, { value: 'present', source: 'SELF' })] })));
    app.mock.on('PUT', `/v1/meals/${MEAL_ID}/reviews/${HOST_ID}`, ok({ subjectId: HOST_ID, version: '1', publishAt: null, visibility: 'PENDING' }));
    app.mock.on('PUT', `/v1/meals/${MEAL_ID}/reconnect/${HOST_ID}`, ok({ subjectId: HOST_ID, selected: true, version: '2', connection: 'WAITING' }));
    await renderApp(app, <PostMealScreen />);
    await fireEvent.press(await screen.findByRole('button', { name: 'Save feedback for Maya' }));
    expect(await screen.findByText('No changes to save.')).toBeOnTheScreen();
    expect(app.mock.callsTo('PUT', /reviews|reconnect/)).toHaveLength(0);
    await fireEvent.changeText(screen.getByLabelText('Reference for Maya'), '  A generous host.  ');
    await fireEvent.press(screen.getByRole('checkbox', { name: 'I’d meet Maya again' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Save feedback for Maya' }));
    await waitFor(() => expect(app.mock.callsTo('PUT', /reconnect/)).toHaveLength(1));
    expect(app.mock.callsTo('PUT', /reviews|reconnect/).map((c) => c.path.includes('reviews') ? 'review' : 'reconnect')).toEqual(['review', 'reconnect']);
    expect(app.mock.callsTo('PUT', /reviews/)[0]).toMatchObject({ body: { body: 'A generous host.' }, headers: { 'if-match': '"0"' } });
  });

  it('a network failure on the reference is Status unknown and pauses the reconnect choice', async () => {
    const app = createTestApp();
    await signIn(app, me());
    app.mock.on('GET', PATH, ok(state({ attendance: [att(USER_ID, { value: 'present', source: 'SELF' })] })));
    app.mock.on('PUT', `/v1/meals/${MEAL_ID}/reviews/${HOST_ID}`, networkDown);
    await renderApp(app, <PostMealScreen />);
    await fireEvent.changeText(await screen.findByLabelText('Reference for Maya'), 'A generous host.');
    await fireEvent.press(screen.getByRole('checkbox', { name: 'I’d meet Maya again' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Save feedback for Maya' }));
    expect(await screen.findByText('Public reference: Status unknown')).toBeOnTheScreen();
    expect(screen.getByText('Reconnect choice: Not saved yet')).toBeOnTheScreen();
    expect(app.mock.callsTo('PUT', /reconnect/)).toHaveLength(0);
    expect(screen.getByRole('button', { name: 'Check status for Maya' })).toBeOnTheScreen();
  });

  it('withdrawing an OPEN connection after the window closed needs confirmation; Keep writes nothing', async () => {
    const app = createTestApp();
    await signIn(app, me());
    app.mock.on('GET', PATH, ok(state({ windowOpen: false, reconnect: [{ subjectId: HOST_ID, selected: true, version: '4', connection: 'OPEN' }] })));
    app.mock.on('POST', `/v1/connections/${HOST_ID}/revoke`, ok({ subjectId: HOST_ID, selected: false, version: '5', connection: 'CLOSED' }));
    await renderApp(app, <PostMealScreen />);
    await fireEvent.press(await screen.findByRole('checkbox', { name: 'I’d meet Maya again' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Save feedback for Maya' }));
    await fireEvent.press(await screen.findByRole('button', { name: 'Keep connection' }));
    expect(app.mock.callsTo('POST', /revoke/)).toHaveLength(0);
    await fireEvent.press(screen.getByRole('button', { name: 'Save feedback for Maya' }));
    await fireEvent.press(await screen.findByRole('button', { name: 'Withdraw connection' }));
    await waitFor(() => expect(app.mock.callsTo('POST', /revoke/)).toHaveLength(1));
    expect(app.mock.callsTo('POST', /revoke/)[0]!.headers['if-match']).toBe('"4"');
  });

  it('session end kills the old account runner: a held reference never continues to the reconnect write (P06-R02)', async () => {
    const app = createTestApp();
    await signIn(app, me());
    app.mock.on('GET', PATH, ok(state({ attendance: [att(USER_ID, { value: 'present', source: 'SELF' })] })));
    let release!: () => void;
    app.mock.on('PUT', `/v1/meals/${MEAL_ID}/reviews/${HOST_ID}`, () => new Promise((r) => { release = () => r(ok({ subjectId: HOST_ID, version: '1', publishAt: null, visibility: 'PENDING' })); }));
    app.mock.on('PUT', `/v1/meals/${MEAL_ID}/reconnect/${HOST_ID}`, ok({ subjectId: HOST_ID, selected: true, version: '2', connection: 'WAITING' }));
    await renderApp(app, <PostMealScreen />);
    await fireEvent.changeText(await screen.findByLabelText('Reference for Maya'), 'A generous host.');
    await fireEvent.press(screen.getByRole('checkbox', { name: 'I’d meet Maya again' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Save feedback for Maya' }));
    await waitFor(() => expect(app.mock.callsTo('PUT', /reviews/)).toHaveLength(1));
    expect(app.services.onSessionEnd.has(resetFeedbackMemory)).toBe(true);
    for (const end of app.services.onSessionEnd) end();
    release();
    await new Promise((r) => setTimeout(r, 10));
    expect(app.mock.callsTo('PUT', /reconnect/)).toHaveLength(0);
  });
});
