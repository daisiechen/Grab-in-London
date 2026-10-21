import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { PostMealScreen, attendanceText } from './PostMealScreen.tsx';
import { createTestApp, renderApp, signIn } from '../../test/render.tsx';
import { resetRouter, routeParams } from '../../test/router.ts';
import { fail, ok } from '../../test/mock-fetch.ts';
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

  it('meet-again is private and reloads on 409', async () => {
    const app = createTestApp();
    await signIn(app, me());
    app.mock.on('GET', PATH, ok(state({ attendance: [att(USER_ID, { value: 'present', source: 'SELF' })] })));
    app.mock.on('PUT', `/v1/meals/${MEAL_ID}/reconnect/${HOST_ID}`, fail(409, 'STATE_CONFLICT'));
    await renderApp(app, <PostMealScreen />);
    await fireEvent.press(await screen.findByRole('button', { name: 'I’d meet Maya again' }));
    expect(await screen.findByText(/We’ve refreshed it/)).toBeOnTheScreen();
    await waitFor(() => expect(app.mock.callsTo('GET', PATH).length).toBeGreaterThanOrEqual(2));
    expect(app.mock.callsTo('PUT', /reconnect/)[0]).toMatchObject({ body: { selected: true }, headers: { 'if-match': '"1"' } });
  });
});
