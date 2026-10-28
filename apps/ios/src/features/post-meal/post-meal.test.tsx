import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { PostMealScreen, attendanceText } from './PostMealScreen.tsx';
import { createTestApp, renderApp, signIn } from '../../test/render.tsx';
import { mockRouter, resetRouter, routeParams } from '../../test/router.ts';
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
    expect(attendanceText(att(USER_ID, { value: 'present', source: 'SELF' }), true)).toBe('Came · you reported');
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
    await fireEvent.press(await screen.findByRole('checkbox', { name: 'I’d like to share a table again with Maya' }));
    expect(await screen.findByText('This action isn’t available to you right now.')).toBeOnTheScreen();
    expect(screen.queryByText(/Please try again|blocked|blocking/i)).toBeNull();
    expect(app.mock.callsTo('PUT', /reconnect/)).toHaveLength(1);
    expect(app.mock.callsTo('GET', PATH)).toHaveLength(1);
    expect(screen.getByRole('checkbox', { name: 'I’d like to share a table again with Maya' }).props.accessibilityState.checked).toBe(false);
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
    expect(screen.queryByText('How was the meal?')).toBeNull();
    expect(screen.getByText('Confirm that you attended within the reporting window to share your meal experience.')).toBeOnTheScreen();
    expect(screen.queryByLabelText('Reference for Maya')).toBeNull();

    await fireEvent.press(screen.getByRole('radio', { name: 'I attended' }));
    expect(await screen.findByText('How was the meal?')).toBeOnTheScreen();
    expect(screen.getByRole('radio', { name: 'I attended' }).props.accessibilityState.selected).toBe(true);
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
    expect(screen.queryByRole('radio', { name: 'I attended' })).toBeNull();
    expect(screen.queryByLabelText('Reference for Maya')).toBeNull();
  });

  it('meet-again is private and reloads on 409', async () => {
    const app = createTestApp();
    await signIn(app, me());
    app.mock.on('GET', PATH, ok(state({ attendance: [att(USER_ID, { value: 'present', source: 'SELF' })] })));
    app.mock.on('PUT', `/v1/meals/${MEAL_ID}/reconnect/${HOST_ID}`, fail(409, 'STATE_CONFLICT'));
    await renderApp(app, <PostMealScreen />);
    await fireEvent.press(await screen.findByRole('checkbox', { name: 'I’d like to share a table again with Maya' }));
    expect(await screen.findByText(/We’ve refreshed it/)).toBeOnTheScreen();
    await waitFor(() => expect(app.mock.callsTo('GET', PATH).length).toBeGreaterThanOrEqual(2));
    expect(app.mock.callsTo('PUT', /reconnect/)[0]).toMatchObject({ body: { selected: true }, headers: { 'if-match': '"1"' } });
  });

  const present = (o: object = {}) => state({ attendance: [att(USER_ID, { value: 'present', source: 'SELF', selfValue: 'present' }), att(HOST_ID, { value: 'present', source: 'SELF' })], ...o });
  const reconnectRow = (o: object) => ({ subjectId: HOST_ID, selected: false, version: '1', connection: 'CLOSED' as const, ...o });

  it('never reveals the other side: an unselected WAITING row reads exactly like CLOSED', async () => {
    const copy: string[][] = [];
    for (const connection of ['CLOSED', 'WAITING'] as const) {
      const app = createTestApp(); await signIn(app, me());
      app.mock.on('GET', PATH, ok(present({ reconnect: [reconnectRow({ connection })] })));
      const view = await renderApp(app, <PostMealScreen />);
      await screen.findByRole('checkbox', { name: 'I’d like to share a table again with Maya' });
      expect(screen.queryByText(/both want|chose you|wants to/i)).toBeNull();
      expect(screen.queryByTestId('reconnect-mutual')).toBeNull();
      copy.push(screen.getAllByText(/./).map((n) => String(n.props.children)));
      await view.unmount();
    }
    expect(copy[1]).toEqual(copy[0]);
  });

  it('a one-sided own choice stays private and explains the never-reveal rule', async () => {
    const app = createTestApp(); await signIn(app, me());
    app.mock.on('GET', PATH, ok(present({ reconnect: [reconnectRow({ selected: true, connection: 'WAITING', version: '2' })] })));
    app.mock.on('PUT', `/v1/meals/${MEAL_ID}/reconnect/${HOST_ID}`, ok(reconnectRow({ selected: false, version: '3' })));
    await renderApp(app, <PostMealScreen />);
    expect(await screen.findByText('Your choice is private. Maya is never told unless they choose you too.')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Say hello to Maya' })).toBeNull();
    await fireEvent.press(screen.getByRole('checkbox', { name: 'I’d like to share a table again with Maya' }));
    await waitFor(() => expect(app.mock.callsTo('PUT', /reconnect/)).toHaveLength(1));
    expect(app.mock.callsTo('PUT', /reconnect/)[0]).toMatchObject({ body: { selected: false }, headers: { 'if-match': '"2"' } });
    expect(app.mock.callsTo('POST', /revoke/)).toHaveLength(0);
  });

  it('a mutual choice links to the direct chat; withdrawing it is confirmed and uses revoke with If-Match', async () => {
    const app = createTestApp(); await signIn(app, me());
    const CONV = '7a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d';
    app.mock.on('GET', PATH, ok(present({ reconnect: [reconnectRow({ selected: true, connection: 'OPEN', version: '4' })] })));
    app.mock.on('GET', `/v1/connections/${HOST_ID}/conversation`, ok({ id: CONV, version: '1', kind: 'DIRECT', mealId: null, title: 'Maya', canSend: true, dissolved: false, head: '0' }));
    await renderApp(app, <PostMealScreen />);
    expect(await screen.findByText('You and Maya both want to meet again.')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Say hello to Maya' }));
    await waitFor(() => expect(mockRouter.push).toHaveBeenCalledWith(`/chat/${CONV}`));

    await fireEvent.press(screen.getByRole('checkbox', { name: 'I’d like to share a table again with Maya' }));
    expect(screen.getByRole('header', { name: 'Withdraw your connection?' })).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Keep things as they are' }));
    expect(app.mock.callsTo('POST', /revoke/)).toHaveLength(0);
    expect(app.mock.callsTo('PUT', /reconnect/)).toHaveLength(0);

    app.mock.on('POST', `/v1/connections/${HOST_ID}/revoke`, ok(reconnectRow({ version: '5' })));
    await fireEvent.press(screen.getByRole('checkbox', { name: 'I’d like to share a table again with Maya' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Withdraw connection' }));
    expect(await screen.findByText('Connection withdrawn. Private messages are now read-only.')).toBeOnTheScreen();
    expect(app.mock.callsTo('POST', /revoke/)[0]?.headers['if-match']).toBe('"4"');
  });

  it('keeps one tablemate on screen at a time, with per-member drafts and a private report link', async () => {
    const app = createTestApp(); await signIn(app, me());
    const EMMA = '00000000-0000-4000-8000-0000000000e1';
    app.mock.on('GET', PATH, ok(present({ eligibleMembers: [publicProfile(USER_ID, 'Alex'), publicProfile(HOST_ID, 'Maya'), publicProfile(EMMA, 'Emma')], attendance: [att(USER_ID, { value: 'present', source: 'SELF', selfValue: 'present' }), att(HOST_ID), att(EMMA)] })));
    await renderApp(app, <PostMealScreen />);
    await fireEvent.changeText(await screen.findByLabelText('Reference for Maya'), 'Lovely company');
    expect(screen.queryByLabelText('Reference for Emma')).toBeNull();
    await fireEvent.press(screen.getByRole('radio', { name: 'Emma' }));
    expect(screen.getByText('Sharing a table with Emma')).toBeOnTheScreen();
    expect(screen.getByLabelText('Reference for Emma')).toHaveDisplayValue('');
    await fireEvent.press(screen.getByRole('button', { name: 'Share private feedback or report a concern' }));
    expect(mockRouter.push).toHaveBeenCalledWith(`/report?targetType=USER&targetId=${EMMA}`);
    await fireEvent.press(screen.getByRole('radio', { name: 'Maya' }));
    expect(screen.getByLabelText('Reference for Maya')).toHaveDisplayValue('Lovely company');
  });

  it('saves the private whole-meal score with If-Match', async () => {
    const app = createTestApp(); await signIn(app, me());
    app.mock.on('GET', PATH, ok(present()));
    app.mock.on('PUT', `/v1/meals/${MEAL_ID}/experience`, ok({ version: '1', updatedAt: '2026-10-26T10:00:00Z' }));
    await renderApp(app, <PostMealScreen />);
    await fireEvent.press(await screen.findByRole('radio', { name: '4' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Save meal experience' }));
    expect(await screen.findByText('Thank you. Your private meal experience is saved.')).toBeOnTheScreen();
    expect(app.mock.callsTo('PUT', /experience/)[0]).toMatchObject({ body: { score: 4 }, headers: { 'if-match': '"0"' } });
  });
});
