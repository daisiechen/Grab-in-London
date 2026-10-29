import { render, screen, waitFor, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import App from '../../App.tsx';
import { createAdminApi } from '../../api/admin-api.ts';
import { fail, list, mockFetch, ok, session, snapshot, SNAP_A, type Call } from '../../test/mock-api.ts';

const R1 = '33333333-3333-4333-8333-333333333333';
const R2 = '44444444-4444-4444-8444-444444444444';
const CASE = '55555555-5555-4555-8555-555555555555';
const MEAL = '66666666-6666-4666-8666-666666666666';
const HOST = '77777777-7777-4777-8777-777777777777';
const GUEST = '88888888-8888-4888-8888-888888888888';
const USER = '99999999-9999-4999-8999-999999999999';
const hoursAgo = (h: number) => new Date(Date.now() - h * 3600_000).toISOString();
const due = (created: string) => new Date(Date.parse(created) + 24 * 3600_000).toISOString();

const summary = (over: Record<string, unknown> = {}) => {
  const createdAt = (over.createdAt as string | undefined) ?? hoursAgo(30);
  return { reportId: R1, caseId: CASE, caseVersion: '3', targetType: 'USER', reason: 'private_concern', reportStatus: 'IN_REVIEW', caseStatus: 'OPEN', createdAt, dueAt: due(createdAt),
    autoActioned: false, autoClosed: false, contentLimited: false, reporterCount: 1, claimedByMe: false, subjectStatus: 'ACTIVE', ...over };
};
const report = (over: Record<string, unknown> = {}, sum: Record<string, unknown> = {}) => ({
  summary: summary({ claimedByMe: true, caseStatus: 'IN_REVIEW', ...sum }), reporterId: GUEST, details: 'Synthetic private concern text.', publicOutcome: 'Thanks — received.',
  privacyRedacted: false, subject: { userId: USER, accountStatus: 'ACTIVE' },
  user: { userId: USER, accountStatus: 'ACTIVE', displayName: 'Reported Member', bio: 'A synthetic bio that is long enough.', hasPhoto: false, photoUrl: null, languages: ['en'], interests: ['FOOD'], profileHidden: false },
  meal: null, message: null, history: [], allowedActions: ['UPHOLD', 'RESTORE', 'HIDE_CONTENT', 'RESET_PROFILE_TEXT', 'SUSPEND_USER'], ...over,
});
const caseInfo = (version = '3', status = 'IN_REVIEW') => ({ id: CASE, version, status, reportId: R1, targetType: 'MEAL', targetId: MEAL, details: 'Synthetic', createdAt: hoursAgo(30) });
const attendance = (opensAt = hoursAgo(1), version = '2') => ({
  caseId: CASE, mealId: MEAL, mealStatus: 'COMPLETED', scheduledEndAt: new Date(Date.parse(opensAt) - 7 * 86_400_000).toISOString(), correctionOpensAt: opensAt,
  roster: [
    { subjectId: HOST, isHost: true, selfValue: 'present', hostValue: null, supportValue: null, value: 'present', source: 'SELF', version: '1' },
    { subjectId: GUEST, isHost: false, selfValue: 'absent', hostValue: 'present', supportValue: null, value: 'absent', source: 'SELF', version },
  ],
});

type Routes = Parameters<typeof mockFetch>[0];
function setup(routes: Routes, url = '/?lang=zh#moderation') {
  history.replaceState(null, '', url);
  const mock = mockFetch({ 'GET /v1/auth/session': () => ok(session(['support'])), ...routes });
  render(<App api={createAdminApi({ fetch: mock.fetch })} />);
  return mock;
}
const posts = (calls: Call[], suffix: string) => calls.filter((c) => c.method === 'POST' && c.path.endsWith(suffix));

describe('moderation workspace', () => {
  it('support-only staff see only the report queue: oldest first, 24h target, no analytics calls or personal data', async () => {
    const mock = setup({ 'GET /v1/moderation/reports': () => list([summary(), summary({ reportId: R2, createdAt: hoursAgo(2), targetType: 'MESSAGE', autoActioned: true, reporterCount: 2 })]) }, '/?lang=zh#overview');
    const table = await screen.findByRole('table', { name: '举报队列' });
    expect(location.hash).toBe('#moderation');
    expect(screen.queryByRole('navigation', { name: '主导航' })).toBeNull();
    expect(within(screen.getByRole('navigation', { name: '安全与支持' })).getByRole('link').getAttribute('href')).toBe('#moderation');
    const rows = within(table).getAllByRole('row').slice(1);
    expect(rows[0]!.textContent).toContain('已超时');
    expect(rows[1]!.textContent).toContain('剩余');
    expect(rows[1]!.textContent).toContain('已自动限制');
    expect(mock.calls.some((c) => c.path.startsWith('/v1/admin/'))).toBe(false);
    expect(mock.calls.find((c) => c.path === '/v1/moderation/reports')!.query.get('status')).toBe('OPEN');
    await userEvent.selectOptions(screen.getByLabelText('对象类型'), 'MEAL');
    await waitFor(() => expect(mock.calls.filter((c) => c.path === '/v1/moderation/reports').at(-1)!.query.get('targetType')).toBe('MEAL'));
    await userEvent.click(screen.getByLabelText('只看我领取的'));
    await waitFor(() => expect(mock.calls.filter((c) => c.path === '/v1/moderation/reports').at(-1)!.query.get('claimed')).toBe('me'));
  });

  it('analyst-only sessions get no report navigation', async () => {
    setup({ 'GET /v1/auth/session': () => ok(session(['analyst'])), 'GET /v1/admin/snapshots': () => list([snapshot(SNAP_A, '2026-10-18T12:00:00Z')]), 'GET /v1/admin/overview': () => fail(500, 'INTERNAL_ERROR') }, '/?lang=zh#overview');
    await screen.findByRole('navigation', { name: '主导航' });
    expect(screen.queryByRole('navigation', { name: '安全与支持' })).toBeNull();
  });

  it('one-tap Uphold claims then acts with the case version and a preset note; Suspend asks to confirm', async () => {
    const mock = setup({
      'GET /v1/moderation/reports': () => list([summary()]),
      'POST /v1/moderation/reports/[^/]+/claim': () => ok(report()),
      'POST /v1/moderation/reports/[^/]+/actions': () => ok(report({}, { caseStatus: 'RESOLVED' })),
    });
    await screen.findByRole('table', { name: '举报队列' });
    await userEvent.click(screen.getByRole('button', { name: '维持' }));
    await screen.findByText(/已处理并通知举报人/);
    const action = posts(mock.calls, '/actions')[0]!;
    expect(action.headers['if-match']).toBe('"3"');
    expect(action.headers['idempotency-key']).toMatch(/^[0-9a-f-]{36}$/);
    expect(action.body).toEqual({ action: 'UPHOLD', note: expect.stringContaining('Upheld') });
    expect(posts(mock.calls, '/claim')).toHaveLength(1);

    await userEvent.click(screen.getByRole('button', { name: '停用' }));
    expect(posts(mock.calls, '/actions')).toHaveLength(1);
    await userEvent.click(screen.getByRole('button', { name: '确认停用' }));
    await waitFor(() => expect(posts(mock.calls, '/actions')).toHaveLength(2));
    expect(posts(mock.calls, '/actions')[1]!.body).toMatchObject({ action: 'SUSPEND_USER' });
  });

  it('asks to claim an unclaimed report, then shows minimum context and audited actions', async () => {
    let claimed = false;
    const mock = setup({
      [`GET /v1/moderation/reports/${R1}`]: () => (claimed ? ok(report()) : fail(404, 'NOT_FOUND')),
      [`POST /v1/moderation/reports/${R1}/claim`]: () => { claimed = true; return ok(report()); },
      [`POST /v1/moderation/reports/${R1}/actions`]: () => ok(report({ allowedActions: ['UPHOLD', 'RESTORE', 'UNSUSPEND_USER'], subject: { userId: USER, accountStatus: 'SUSPENDED' }, history: [{ id: R2, kind: 'SUSPEND_USER', actorId: HOST, note: 'Serious breach.', publicOutcome: 'We took action.', createdAt: hoursAgo(0) }] }, { caseStatus: 'RESOLVED', caseVersion: '4' })),
      [`GET /v1/support/cases/${CASE}`]: () => ok(caseInfo()),
    }, `/?lang=zh#moderation/${R1}`);
    await userEvent.click(await screen.findByRole('button', { name: '领取此举报' }));
    expect(await screen.findByText('Synthetic private concern text.')).toBeTruthy();
    expect(screen.getByText('Reported Member')).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/@/);
    await userEvent.click(screen.getByRole('button', { name: '停用账号' }));
    const note = screen.getByLabelText('内部备注');
    const form = within(note.closest('form')!);
    await userEvent.clear(note);
    expect((form.getByRole('button', { name: '停用账号' }) as HTMLButtonElement).disabled).toBe(true);
    await userEvent.type(note, 'Serious breach.');
    await userEvent.type(screen.getByLabelText('举报人可见的回复'), 'We took action.');
    await userEvent.click(form.getByRole('button', { name: '停用账号' }));
    expect(posts(mock.calls, '/actions')).toHaveLength(0);
    await userEvent.click(screen.getByRole('button', { name: '确认：停用账号' }));
    await screen.findByText(/已执行并关闭/);
    expect(posts(mock.calls, '/actions')[0]!.body).toEqual({ action: 'SUSPEND_USER', note: 'Serious breach.', publicOutcome: 'We took action.' });
    expect(screen.getByRole('button', { name: '恢复账号' })).toBeTruthy();
    expect(screen.getByText(/内部备注：Serious breach./)).toBeTruthy();
  });

  it('reloads the report on a version conflict and keeps the decision unapplied', async () => {
    let reads = 0;
    const mock = setup({
      [`GET /v1/moderation/reports/${R1}`]: () => { reads++; return ok(report({}, { caseVersion: reads > 1 ? '5' : '3' })); },
      [`POST /v1/moderation/reports/${R1}/actions`]: () => fail(409, 'VERSION_CONFLICT'),
      [`GET /v1/support/cases/${CASE}`]: () => ok(caseInfo()),
    }, `/?lang=en#moderation/${R1}`);
    await userEvent.click(await screen.findByRole('button', { name: 'Hide content' }));
    await userEvent.click(screen.getAllByRole('button', { name: 'Hide content' }).at(-1)!);
    expect((await screen.findByRole('alert')).textContent).toContain('changed meanwhile');
    await waitFor(() => expect(reads).toBe(2));
    expect(mock.calls.filter((c) => c.path.endsWith('/actions'))[0]!.headers['if-match']).toBe('"3"');
  });

  it('shows the reported message with its neighbours and the target highlighted', async () => {
    const message = { messageId: R2, conversationId: CASE, senderId: USER, hidden: true, context: [
      { messageId: R1, senderId: HOST, body: 'Before line', createdAt: hoursAgo(2), hidden: false, isTarget: false },
      { messageId: R2, senderId: USER, body: 'Reported line', createdAt: hoursAgo(1), hidden: true, isTarget: true },
    ] };
    setup({ [`GET /v1/moderation/reports/${R1}`]: () => ok(report({ user: null, message }, { targetType: 'MESSAGE', contentLimited: true })), [`GET /v1/support/cases/${CASE}`]: () => ok(caseInfo()) }, `/?lang=zh#moderation/${R1}`);
    const target = (await screen.findByText('Reported line')).closest('li')!;
    expect(target.getAttribute('aria-current')).toBe('true');
    expect(screen.getByText('Before line').closest('li')!.getAttribute('aria-current')).toBeNull();
  });
});

describe('J09 support case in the admin', () => {
  const mealReport = () => ok(report({ user: null, meal: { mealId: MEAL, hostId: HOST, title: 'Supper', description: 'A synthetic supper.', status: 'COMPLETED', startsAt: hoursAgo(200), areaCode: 'soho', hidden: false } }, { targetType: 'MEAL' }));

  it('blocks corrections inside the 7-day self-report window', async () => {
    setup({ [`GET /v1/moderation/reports/${R1}`]: mealReport, [`GET /v1/support/cases/${CASE}/attendance`]: () => ok(attendance(new Date(Date.now() + 3600_000).toISOString())), [`GET /v1/support/cases/${CASE}`]: () => ok(caseInfo()) }, `/?lang=zh#moderation/${R1}`);
    expect((await screen.findByRole('note')).textContent).toContain('仍在7天自助窗口内');
    expect((screen.getByRole('button', { name: '追加修订并核对影响' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('appends a revision with the effective revision as expectedVersion and shows its impact', async () => {
    const mock = setup({
      [`GET /v1/moderation/reports/${R1}`]: mealReport, [`GET /v1/support/cases/${CASE}`]: () => ok(caseInfo()),
      [`GET /v1/support/cases/${CASE}/attendance`]: () => ok(attendance()),
      [`POST /v1/support/cases/${CASE}/attendance-corrections`]: () => ({ status: 201, body: { data: { mealId: MEAL, subjectId: GUEST, value: 'present', version: '3', correctedAt: hoursAgo(0) }, meta: { requestId: 'r', serverNow: hoursAgo(0) } } }),
    }, `/?lang=zh#moderation/${R1}`);
    await userEvent.type(await screen.findByLabelText('纠错原因'), 'Receipt and host confirmation reviewed.');
    await userEvent.click(screen.getByRole('button', { name: '追加修订并核对影响' }));
    expect((await screen.findByText(/修订已追加（版本 3）/)).closest('[role="status"]')!.textContent).toContain('原始本人/发起人报告保留');
    const call = posts(mock.calls, '/attendance-corrections')[0]!;
    expect(call.body).toEqual({ mealId: MEAL, subjectId: GUEST, value: 'present', reason: 'Receipt and host confirmation reviewed.', expectedVersion: '2' });
    expect(call.headers['if-match']).toBeUndefined();
  });

  it('keeps the reason on a revision conflict, shows the window refusal and clears facts when denied', async () => {
    let attempt = 0, reads = 0;
    const mock = setup({
      [`GET /v1/moderation/reports/${R1}`]: mealReport, [`GET /v1/support/cases/${CASE}`]: () => ok(caseInfo()),
      [`GET /v1/support/cases/${CASE}/attendance`]: () => { reads++; return ok(attendance(hoursAgo(1), reads > 1 ? '4' : '2')); },
      [`POST /v1/support/cases/${CASE}/attendance-corrections`]: () => { attempt++; return attempt === 1 ? fail(409, 'VERSION_CONFLICT') : attempt === 2 ? fail(409, 'CORRECTION_WINDOW_OPEN') : fail(403, 'FORBIDDEN'); },
    }, `/?lang=zh#moderation/${R1}`);
    const reason = await screen.findByLabelText('纠错原因');
    await userEvent.type(reason, 'Reviewed the attendance evidence.');
    await userEvent.click(screen.getByRole('button', { name: '追加修订并核对影响' }));
    expect((await screen.findByText(/记录已发生变化/)).textContent).toContain('原因与选择已保留');
    expect((screen.getByLabelText('纠错原因') as HTMLTextAreaElement).value).toBe('Reviewed the attendance evidence.');
    await waitFor(() => expect(screen.getAllByRole('row').some((r) => r.textContent?.includes('4'))).toBe(true));
    await userEvent.click(screen.getByRole('button', { name: '追加修订并核对影响' }));
    expect(posts(mock.calls, '/attendance-corrections')[1]!.body).toMatchObject({ expectedVersion: '4' });
    expect(await screen.findByText(/仍在7天自助窗口内，未执行纠错/)).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: '追加修订并核对影响' }));
    expect(await screen.findByText(/无权查看此个案的出席事实/)).toBeTruthy();
    expect(screen.queryByRole('table', { name: '开始名单出席记录' })).toBeNull();
  });

  it('saves a reporter-visible reply with the current case version', async () => {
    const mock = setup({
      [`GET /v1/moderation/reports/${R1}`]: () => ok(report()), [`GET /v1/support/cases/${CASE}`]: () => ok(caseInfo('7')),
      [`POST /v1/support/cases/${CASE}/status`]: () => ok(caseInfo('8', 'RESOLVED')),
    }, `/?lang=zh#moderation/${R1}`);
    await userEvent.type(await screen.findByLabelText('提交者可见回复'), 'We reviewed your report and took action.');
    await userEvent.type(screen.getByLabelText('内部原因'), 'Checked the evidence.');
    await userEvent.click(screen.getByRole('button', { name: '保存处理结果与回复' }));
    await screen.findByText(/处理结果与回复已保存/);
    const call = posts(mock.calls, '/status')[0]!;
    expect(call.headers['if-match']).toBe('"7"');
    expect(call.body).toEqual({ status: 'RESOLVED', publicOutcome: 'We reviewed your report and took action.', reason: 'Checked the evidence.' });
    expect(screen.getByText('已回复')).toBeTruthy();
  });
});

describe('staff sign-in', () => {
  it('signs in with an email code on this origin and then loads the console', async () => {
    let signedIn = false;
    const mock = setup({
      'GET /v1/auth/session': () => (signedIn ? ok(session(['support'])) : fail(401, 'AUTH_REQUIRED')),
      'POST /v1/auth/email/start': () => ({ status: 201, body: { data: { challengeId: CASE, expiresAt: hoursAgo(-1), resendAfter: hoursAgo(0) }, meta: { requestId: 'r', serverNow: hoursAgo(0) } } }),
      'POST /v1/auth/email/verify': () => { signedIn = true; return ok({ outcome: 'AUTHENTICATED', authProof: R1, session: session(['support']) }); },
      'GET /v1/moderation/reports': () => list([]),
    });
    expect((await screen.findByRole('alert')).textContent).toContain('请重新登录');
    await userEvent.type(screen.getByLabelText('员工邮箱'), 'staff@example.invalid');
    await userEvent.click(screen.getByRole('button', { name: '发送验证码' }));
    await userEvent.type(await screen.findByLabelText('邮件中的6位验证码'), '000000');
    await userEvent.click(screen.getByRole('button', { name: '登录' }));
    expect(await screen.findByText('没有待处理的举报')).toBeTruthy();
    expect(posts(mock.calls, '/auth/email/start')[0]!.body).toMatchObject({ email: 'staff@example.invalid', client: 'WEB' });
    expect(posts(mock.calls, '/auth/email/verify')[0]!.body).toMatchObject({ challengeId: CASE, code: '000000' });
  });
});
