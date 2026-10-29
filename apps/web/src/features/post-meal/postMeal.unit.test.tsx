import { describe, expect, it } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { createFetchStub, fail, ok } from '../../test/fetchStub.ts';
import { renderApp } from '../../test/render.tsx';
import { HOST_ID, MEAL_ID, USER_ID, meal, publicProfile, session } from '../../test/fixtures.ts';
import { attendanceStatus } from './PostMealPage.tsx';

const EMMA = '16161616-1616-4161-8161-161616161616';
const DIRECT = '17171717-1717-4171-8171-171717171717';

function state(over: Record<string, unknown> = {}) {
  return {
    mealId: MEAL_ID, windowOpensAt: '2026-10-23T20:30:00.000Z', windowClosesAt: '2026-10-30T20:30:00.000Z', windowOpen: true,
    eligibleMembers: [publicProfile(USER_ID, 'Sam Rivera'), publicProfile(HOST_ID, 'Maya Chen'), publicProfile(EMMA, 'Emma Hill')],
    attendance: [{ subjectId: USER_ID, value: 'unknown', source: null, selfValue: null, hostValue: null, version: '0' }],
    experience: null, reviews: [], reconnect: [],
    ...over,
  };
}

function stub(pm: Record<string, unknown>, me = USER_ID, extra: Record<string, unknown> = {}) {
  let current: Record<string, unknown> = state(pm);
  const s = createFetchStub({
    getSession: () => ok(session({ id: me })),
    getMeal: () => ok({ meal: meal(), myApplication: null, conversationId: null }),
    postMealState: () => ok(current),
    reportAttendance: (c) => {
      const value = (c.body as { value: string }).value;
      const row = { subjectId: c.params.subjectId!, value, source: 'SELF', selfValue: value, hostValue: null, version: '1' };
      current = { ...current, attendance: [row] };
      return ok(row);
    },
    rateExperience: () => ok({ version: '1', updatedAt: '2026-10-24T10:00:00.000Z' }),
    reviewPerson: (c) => ok({ subjectId: c.params.subjectId!, version: '1', publishAt: null, visibility: 'PENDING' }),
    selectReconnect: (c) => {
      const row = { subjectId: c.params.subjectId!, selected: (c.body as { selected: boolean }).selected, version: '1', connection: 'WAITING' };
      current = { ...current, reconnect: [row] };
      return ok(row);
    },
    revokeConnection: (c) => ok({ subjectId: c.params.subjectId!, selected: false, version: '3', connection: 'CLOSED' }),
    getDirect: () => ok({ id: DIRECT, version: '1', kind: 'DIRECT', mealId: null, title: 'Maya Chen', canSend: true, dissolved: false, head: '0' }),
    inbox: () => ({ status: 200, body: { data: [], page: { nextCursor: null, hasMore: false }, meta: { requestId: 'r', serverNow: '2026-10-21T12:00:00.000Z' } } }),
    ...extra,
  });
  return { s, set: (over: Record<string, unknown>) => { current = state({ ...pm, ...over }); } };
}

describe('attendance status (T13)', () => {
  it('keeps unknown separate from absent and explains SELF priority', () => {
    expect(attendanceStatus(undefined)).toBe('Unknown · no report yet');
    expect(attendanceStatus({ subjectId: USER_ID, value: 'unknown', source: null, selfValue: null, hostValue: null, version: '0' })).toBe('Unknown · no report yet');
    expect(attendanceStatus({ subjectId: USER_ID, value: 'present', source: 'HOST', selfValue: null, hostValue: 'present', version: '1' })).toMatch(/reported by your host. Your own report takes priority/);
    expect(attendanceStatus({ subjectId: USER_ID, value: 'absent', source: 'SELF', selfValue: 'absent', hostValue: 'present', version: '2' })).toBe('Didn’t attend · your report');
  });
});

describe('post-meal page (T13/T14/T15)', () => {
  it('reports own attendance with If-Match "0" on the first write, with no default selection', async () => {
    const { s } = stub({});
    renderApp(s.fetch, `/post-meal/${MEAL_ID}`);
    const group = await screen.findByRole('group', { name: 'Your attendance' });
    expect(within(group).getAllByRole('radio').every((r) => !(r as HTMLInputElement).checked)).toBe(true);
    expect(screen.getByText(/Unknown · no report yet/)).toBeTruthy();
    expect(screen.getByText(/Confirm that you attended/)).toBeTruthy();
    await userEvent.click(within(group).getByLabelText('I attended'));
    await waitFor(() => expect(s.callsTo('reportAttendance')).toHaveLength(1));
    const call = s.callsTo('reportAttendance')[0]!;
    expect(call.params).toEqual({ mealId: MEAL_ID, subjectId: USER_ID });
    expect(call.body).toEqual({ value: 'present' });
    expect(call.headers['if-match']).toBe('"0"');
    expect(await screen.findByRole('group', { name: 'How was the meal?' })).toBeTruthy();
  });

  it('rates 1–5 privately only when attended, using the experience revision', async () => {
    const { s } = stub({
      attendance: [{ subjectId: USER_ID, value: 'present', source: 'SELF', selfValue: 'present', hostValue: null, version: '1' }],
      experience: { score: 3, version: '2' },
    });
    renderApp(s.fetch, `/post-meal/${MEAL_ID}`);
    const group = await screen.findByRole('group', { name: 'How was the meal?' });
    await userEvent.click(within(group).getByLabelText('5'));
    await waitFor(() => expect(s.callsTo('rateExperience')).toHaveLength(1));
    expect(s.callsTo('rateExperience')[0]!.body).toEqual({ score: 5 });
    expect(s.callsTo('rateExperience')[0]!.headers['if-match']).toBe('"2"');
  });

  it('closed window: no attendance controls, support correction hint', async () => {
    const { s } = stub({ windowOpen: false });
    renderApp(s.fetch, `/post-meal/${MEAL_ID}`);
    expect(await screen.findByText(/7-day reporting window has closed/)).toBeTruthy();
    expect(screen.queryByRole('group', { name: 'Your attendance' })).toBeNull();
  });

  it('saves a public reference and shows it as pending until mutual or 7 days', async () => {
    const { s, set } = stub({ attendance: [{ subjectId: USER_ID, value: 'present', source: 'SELF', selfValue: 'present', hostValue: null, version: '1' }] });
    renderApp(s.fetch, `/post-meal/${MEAL_ID}`);
    await userEvent.type(await screen.findByLabelText(/A public reference/), 'Made everyone feel included.');
    set({ attendance: [{ subjectId: USER_ID, value: 'present', source: 'SELF', selfValue: 'present', hostValue: null, version: '1' }], reviews: [{ subjectId: HOST_ID, version: '1', visibility: 'PENDING' }] });
    await userEvent.click(screen.getByRole('button', { name: /Save reference/ }));
    await waitFor(() => expect(s.callsTo('reviewPerson')).toHaveLength(1));
    expect(s.callsTo('reviewPerson')[0]!.params.subjectId).toBe(HOST_ID);
    expect(s.callsTo('reviewPerson')[0]!.headers['if-match']).toBe('"0"');
    expect(await screen.findByText(/waiting to be published/)).toBeTruthy();
  });

  it('a reconnect choice stays private: WAITING never reveals the other side', async () => {
    const { s } = stub({});
    renderApp(s.fetch, `/post-meal/${MEAL_ID}`);
    await userEvent.click(await screen.findByRole('checkbox', { name: /share a table again/ }));
    await waitFor(() => expect(s.callsTo('selectReconnect')[0]?.body).toEqual({ selected: true }));
    expect(await screen.findByText('Your wish to meet again is private until mutual.')).toBeTruthy();
    expect(screen.queryByText(/both want to meet again/)).toBeNull();
    expect(screen.queryByRole('button', { name: /Say hello/ })).toBeNull();
  });

  it('a mutual connection opens the direct conversation; withdrawing needs confirmation', async () => {
    const { s } = stub({ reconnect: [{ subjectId: HOST_ID, selected: true, version: '2', connection: 'OPEN' }] });
    renderApp(s.fetch, `/post-meal/${MEAL_ID}`);
    expect(await screen.findByText(/both want to meet again/)).toBeTruthy();
    await userEvent.click(screen.getByRole('checkbox', { name: /share a table again/ }));
    const dialog = await screen.findByRole('dialog', { name: 'Withdraw your connection?' });
    expect(s.callsTo('selectReconnect')).toHaveLength(0);
    await userEvent.click(within(dialog).getByRole('button', { name: 'Withdraw connection' }));
    await waitFor(() => expect(s.callsTo('revokeConnection')).toHaveLength(1));
    expect(s.callsTo('revokeConnection')[0]!.headers['if-match']).toBe('"2"');
  });

  it('“Say hello” resolves the direct conversation and navigates to it', async () => {
    const { s } = stub({ reconnect: [{ subjectId: HOST_ID, selected: true, version: '2', connection: 'OPEN' }] });
    renderApp(s.fetch, `/post-meal/${MEAL_ID}`);
    await userEvent.click(await screen.findByRole('button', { name: /Say hello to Maya Chen/ }));
    await waitFor(() => expect(s.callsTo('getDirect')[0]?.params.subjectId).toBe(HOST_ID));
  });

  it('the host can report others; each member’s own report still wins', async () => {
    const { s } = stub({}, HOST_ID, { getMeal: () => ok({ meal: meal(), myApplication: null, conversationId: null }) });
    s.on('getSession', () => ok(session({ id: HOST_ID })));
    renderApp(s.fetch, `/post-meal/${MEAL_ID}`);
    const fieldset = await screen.findByRole('group', { name: 'Report your table’s attendance' });
    await userEvent.click(within(within(fieldset).getByRole('group', { name: 'Emma Hill' })).getByLabelText('Attended'));
    await waitFor(() => expect(s.callsTo('reportAttendance')[0]?.params.subjectId).toBe(EMMA));
  });

  it('shows server rejections instead of assuming eligibility', async () => {
    const { s } = stub({}, USER_ID, { reportAttendance: () => fail(403, 'FORBIDDEN') });
    renderApp(s.fetch, `/post-meal/${MEAL_ID}`);
    await userEvent.click(within(await screen.findByRole('group', { name: 'Your attendance' })).getByLabelText('I didn’t attend'));
    expect((await screen.findByRole('alert')).textContent).toBe('This action isn’t available to you right now.');
  });
});

describe('report and block (T15/T18)', () => {
  it('reports privately with a receipt, then blocks with confirmation', async () => {
    const s = createFetchStub({
      getSession: () => ok(session()),
      getPublicProfile: () => ok({ profile: publicProfile(), reviews: [], nextReviewCursor: null }),
      createReport: () => ok({ id: '18181818-1818-4181-8181-181818181818', receipt: 'FR-7Q2K9', status: 'RECEIVED', targetType: 'USER', publicOutcome: null, createdAt: '2026-10-21T12:00:00.000Z' }, 201),
      getBlock: () => ok({ subjectId: HOST_ID, blocked: false, version: '0' }),
      block: () => ok({ subjectId: HOST_ID, blocked: true, version: '1' }),
    });
    renderApp(s.fetch, `/profiles/${HOST_ID}`);
    await userEvent.click(await screen.findByRole('link', { name: 'Report this profile' }));
    expect(await screen.findByRole('heading', { name: 'Share a private concern' })).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Submit report' }));
    expect(await screen.findByText('Choose what the report is about.')).toBeTruthy();
    expect(s.callsTo('createReport')).toHaveLength(0);
    await userEvent.click(screen.getByLabelText('Harassment or hate'));
    await userEvent.type(screen.getByLabelText(/What would you like us to know\?/), 'Made an unwelcome comment.');
    await userEvent.click(screen.getByRole('button', { name: 'Submit report' }));
    expect(await screen.findByText('FR-7Q2K9')).toBeTruthy();
    expect(s.callsTo('createReport')[0]!.body).toEqual({ targetType: 'USER', targetId: HOST_ID, reason: 'harassment', details: 'Made an unwelcome comment.' });
    await userEvent.click(screen.getByRole('button', { name: 'Done' }));

    await userEvent.click(await screen.findByRole('button', { name: 'Block Maya Chen' }));
    const confirm = await screen.findByRole('dialog', { name: 'Block Maya Chen?' });
    expect(within(confirm).getByText(/Your previous connection will not be restored/)).toBeTruthy();
    await userEvent.click(within(confirm).getByRole('button', { name: 'Confirm block' }));
    expect(await screen.findByText(/You have blocked Maya Chen/)).toBeTruthy();
    expect(s.callsTo('getBlock')[0]!.params).toEqual({subjectId:HOST_ID});
    expect(s.callsTo('block')[0]!.headers['if-match']).toBe('"0"');
  });

  it('own profile has no report/block entry', async () => {
    const s = createFetchStub({
      getSession: () => ok(session({ id: HOST_ID })),
      getPublicProfile: () => ok({ profile: publicProfile(), reviews: [], nextReviewCursor: null }),
    });
    renderApp(s.fetch, `/profiles/${HOST_ID}`);
    await screen.findByRole('heading', { level: 1, name: 'Maya Chen' });
    expect(screen.queryByRole('button', { name: 'Report or block this member' })).toBeNull();
  });
});
