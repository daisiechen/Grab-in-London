import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import App from '../App.tsx';
import { createAdminApi } from '../api/admin-api.ts';
import { fail, HASH, list, mockFetch, ok, pageData, session, SNAP_A, snapshot, type Call } from '../test/mock-api.ts';

const A = snapshot(SNAP_A, '2026-10-18T12:00:00Z');
const MEAL = '33333333-3333-4333-8333-333333333333';
const USER = '44444444-4444-4444-8444-444444444444';

const pages: Record<string, ReturnType<typeof pageData>> = {
  overview: {
    ...pageData('overview', A, { weekly: 12, activation: { numerator: 3, denominator: 8 }, retention: { numerator: 0, denominator: 0 }, coverage: { numerator: 9, denominator: 10 } }),
    series: { 'weekly.trend': [{ key: '2026-09-28', value: 5 }, { key: '2026-10-05', value: 7 }, { key: '2026-10-12', value: null }] },
  },
  supply: {
    ...pageData('supply', A, { discovery: { numerator: 2, denominator: 40 }, formation: null, cancellation: { numerator: 1, denominator: 6 }, coverage: { numerator: 9, denominator: 10 }, mealsWithAttendance: 4 }),
    series: { 'attendance.distribution': [{ key: 'present', value: 9 }, { key: 'unknown', value: 1 }], 'area.compare': [{ key: 'soho', value: { numerator: 1, denominator: 4 } }] },
  },
  retention: {
    ...pageData('retention', A, { retention: { numerator: 1, denominator: 2 } }),
    series: { 'cohort.retention': [{ key: '2026-09-28', value: { numerator: 1, denominator: 2 } }, { key: '2026-10-12', value: null }] },
  },
  journey: pageData('journey', A, {}),
  quality: pageData('quality', A, { missingRequired: 2, duplicates: 1, excluded: 3, receiveLatencyP90: 4 }),
};

const drillRow = (rowId: string, attributes: Record<string, unknown>) => ({ rowId, inNumerator: true, inDenominator: true, attributes });

function setup(url: string, extra: Record<string, (c: Call) => ReturnType<typeof ok>> = {}, roles = ['analyst']) {
  history.replaceState(null, '', url);
  const mock = mockFetch({
    ...extra,
    'GET /v1/auth/session': () => ok(session(roles)),
    'GET /v1/admin/snapshots': () => list([A]),
    'GET /v1/admin/(overview|journey|supply|retention|quality)': (c) => ok(pages[c.path.split('/').pop()!]),
  });
  render(<App api={createAdminApi({ fetch: mock.fetch })} />);
  return mock;
}

afterEach(() => vi.restoreAllMocks());

describe('page bodies render server values only', () => {
  it('overview: ratio with zero denominator is "—", numbers and the trend come from the snapshot', async () => {
    setup('/?lang=en#overview');
    const content = await screen.findByLabelText('Page content');
    const cards = within(content).getAllByRole('button').filter((b) => b.className === 'metric-card');
    expect(cards.map((c) => c.querySelector('.metric-value')!.textContent)).toEqual(['12', '37.5%', '—']);
    expect(cards[1]!.textContent).toContain('3 / 8');
    expect(within(content).getByText('90.0%')).toBeTruthy();
    expect(within(content).getByRole('img', { name: 'Weekly attended user trend' })).toBeTruthy();
    expect(content.querySelector('.chart-values')!.textContent).toContain('10-12 —');
  });

  it('shows an empty state (no stale charts) when the snapshot has no data for the filters', async () => {
    pages.journey = pageData('journey', A, { applications: null, approved: { numerator: 0, denominator: 0 } });
    setup('/?lang=en#journey');
    const content = await screen.findByLabelText('Page content');
    expect(within(content).getByText('No matching records')).toBeTruthy();
    expect(within(content).queryByRole('img')).toBeNull();
  });

  it('retention: unmatured cohorts show "Observing", cohort week opens the cohort users drilldown', async () => {
    const mock = setup('/?lang=en#retention', { 'GET /v1/admin/drilldowns/.+': () => list([]) });
    const content = await screen.findByLabelText('Page content');
    expect(within(content).getByText('Observing')).toBeTruthy();
    expect(content.querySelector('.cohort-cell.mature')!.textContent).toBe('50.0%');
    await userEvent.click(within(content).getByRole('button', { name: '2026-09-28' }));
    await waitFor(() => expect(mock.calls.some((c) => c.path === '/v1/admin/drilldowns/cohort.users')).toBe(true));
    const call = mock.calls.find((c) => c.path === '/v1/admin/drilldowns/cohort.users')!;
    expect(call.query.get('cohortWeek')).toBe('2026-09-28');
    expect(call.query.get('filterHash')).toBe(HASH);
    expect(call.query.get('snapshotId')).toBe(SNAP_A);
  });
});

describe('drilldowns stay on one snapshot + filter hash', () => {
  it('supply meal list: attendance filter, server paging and nested meal evidence', async () => {
    const mock = setup('/?lang=en&areas=soho#supply', {
      'GET /v1/admin/drilldowns/meals': (c) => c.query.get('cursor')
        ? { status: 200, body: { data: [drillRow('M-2', { mealId: MEAL, area: 'soho' })], page: { nextCursor: null, hasMore: false }, meta: { requestId: 'r', serverNow: '2026-10-18T13:00:00Z' } } }
        : { status: 200, body: { data: [drillRow('M-1', { mealId: MEAL, area: 'soho', status: 'unknown' })], page: { nextCursor: 'cur-2', hasMore: true }, meta: { requestId: 'r', serverNow: '2026-10-18T13:00:00Z' } } },
      'GET /v1/admin/drilldowns/attendance': () => list([drillRow('P-1', { userId: USER, selfReport: 'present', hostReport: null })]),
    });
    await screen.findByText('M-1');
    await userEvent.selectOptions(screen.getByLabelText('Attendance filter (list only)'), 'unknown');
    await waitFor(() => expect(mock.calls.some((c) => c.path === '/v1/admin/drilldowns/meals' && c.query.get('attendanceStatus') === 'unknown')).toBe(true));
    await screen.findByText('M-1');
    await userEvent.click(screen.getByRole('button', { name: 'Next page' }));
    await screen.findByText('M-2');
    const meals = mock.calls.filter((c) => c.path === '/v1/admin/drilldowns/meals');
    const last = meals.at(-1)!;
    expect(last.query.get('cursor')).toBe('cur-2');
    expect(last.query.get('limit')).toBe('6');
    for (const c of meals) {
      expect(c.query.get('snapshotId')).toBe(SNAP_A);
      expect(c.query.get('filterHash')).toBe(HASH);
      expect(c.query.get('areas')).toBe('soho');
    }
    // Aggregates were requested once: the list filter never re-requests page metrics.
    expect(mock.calls.filter((c) => c.path === '/v1/admin/supply')).toHaveLength(1);

    await userEvent.click(screen.getByRole('button', { name: 'View M-2' }));
    const dialog = await screen.findByRole('dialog');
    await within(dialog).findByText('P-1');
    expect(mock.calls.find((c) => c.path === '/v1/admin/drilldowns/attendance')!.query.get('mealId')).toBe(MEAL);
    await userEvent.click(within(dialog).getByRole('button', { name: `View P-1` }));
    await waitFor(() => expect(mock.calls.filter((c) => c.path === '/v1/admin/drilldowns/attendance').at(-1)!.query.get('userId')).toBe(USER));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Back to previous detail' }));
    expect(within(dialog).getByRole('heading', { level: 2 }).textContent).toContain(MEAL);
  });

  it('a 410 during a drilldown clears data and opens the snapshot picker', async () => {
    setup('/?lang=en#supply', { 'GET /v1/admin/drilldowns/meals': () => fail(410, 'SNAPSHOT_REVOKED') });
    const picker = await screen.findByRole('dialog');
    expect(within(picker).getByRole('alert').textContent).toContain('revoked');
    expect(screen.queryByLabelText('Page content')).toBeNull();
  });
});

describe('export (T23)', () => {
  it('exports the page summary for the same snapshot and filters, then downloads the server CSV', async () => {
    const EXPORT = '55555555-5555-4555-8555-555555555555';
    const mock = setup('/?lang=en&languages=zh#overview', {
      'POST /v1/admin/exports': () => ({ status: 201, body: { data: { exportId: EXPORT, snapshotId: SNAP_A, expiresAt: '2026-10-18T13:10:00Z' }, meta: { requestId: 'r', serverNow: '2026-10-18T13:00:00Z' } } }),
      'GET /v1/admin/exports/[^/]+': () => ({ status: 200, body: 'snapshotId,' + SNAP_A + '\r\nmetric,numerator\r\n', contentType: 'text/csv; charset=utf-8' }),
    });
    const blobs: Blob[] = [];
    Object.assign(URL, { createObjectURL: vi.fn((b: Blob) => { blobs.push(b); return 'blob:export'; }), revokeObjectURL: vi.fn() });
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    await screen.findByLabelText('Page content');
    await userEvent.click(screen.getByRole('button', { name: 'Export metrics' }));
    await screen.findByText('Exported metrics for this snapshot and filters');
    const post = mock.calls.find((c) => c.method === 'POST' && c.path === '/v1/admin/exports')!;
    expect(post.body).toEqual({ snapshotId: SNAP_A, metric: 'summary.overview', filters: { from: '2026-09-21', to: '2026-10-18', languages: 'zh' } });
    expect(post.headers['idempotency-key']).toMatch(/^[0-9a-f-]{36}$/);
    expect(mock.calls.some((c) => c.method === 'GET' && c.path === `/v1/admin/exports/${EXPORT}`)).toBe(true);
    expect(await blobs[0]!.text()).toContain(SNAP_A);
    expect((click.mock.contexts[0] as HTMLAnchorElement).download).toBe(`fancy-summary.overview-${SNAP_A}.csv`);
  });

  it('a revoked snapshot fails the export and asks for a new snapshot', async () => {
    setup('/?lang=en#overview', { 'POST /v1/admin/exports': () => fail(410, 'SNAPSHOT_REVOKED') });
    await screen.findByLabelText('Page content');
    await userEvent.click(screen.getByRole('button', { name: 'Export metrics' }));
    const picker = await screen.findByRole('dialog');
    expect(within(picker).getByText(/Choose a new snapshot/)).toBeTruthy();
  });
});

describe('classification (data_admin only, server-enforced)', () => {
  it('analysts see no form', async () => {
    setup('/?lang=en#quality');
    await screen.findByLabelText('Page content');
    expect(screen.getByText('Only data admins can change classifications.')).toBeTruthy();
    expect(screen.queryByLabelText('Classification user ID')).toBeNull();
  });

  it('requires a reason, sends If-Match + idempotency key, and announces the pending snapshot', async () => {
    let revision = '3';
    const mock = setup('/?lang=en#quality', {
      'GET /v1/admin/classifications/.+': () => ok({ userId: USER, classification: 'regular', revision, snapshotPending: false }),
      'PUT /v1/admin/classifications/.+': (c) => {
        if (c.headers['if-match'] !== `"${revision}"`) return fail(409, 'VERSION_CONFLICT');
        revision = '4';
        return ok({ userId: USER, classification: (c.body as { classification: string }).classification, revision, snapshotPending: true });
      },
    }, ['data_admin']);
    await screen.findByLabelText('Page content');
    await userEvent.type(screen.getByLabelText('Classification user ID'), USER);
    await userEvent.click(screen.getByRole('button', { name: 'Load current class' }));
    await screen.findByText(/rev 3/);
    await userEvent.selectOptions(screen.getByLabelText('Account class'), 'test');
    const save = screen.getByRole('button', { name: 'Save classification' }) as HTMLButtonElement;
    await userEvent.type(screen.getByLabelText('Classification reason'), 'qa');
    expect(save.disabled).toBe(true);
    await userEvent.type(screen.getByLabelText('Classification reason'), ' account');
    expect(save.disabled).toBe(false);
    const snapshotCalls = mock.calls.filter((c) => c.path === '/v1/admin/snapshots').length;
    await userEvent.click(save);
    await screen.findByText(/A new snapshot is being built/);
    const put = mock.calls.find((c) => c.method === 'PUT')!;
    expect(put.headers['if-match']).toBe('"3"');
    expect(put.headers['idempotency-key']).toMatch(/^[0-9a-f-]{36}$/);
    expect(put.body).toEqual({ classification: 'test', reason: 'qa account' });
    await waitFor(() => expect(mock.calls.filter((c) => c.path === '/v1/admin/snapshots').length).toBeGreaterThan(snapshotCalls));
    // Displayed numbers are untouched: the page was requested once for the original snapshot.
    expect(mock.calls.filter((c) => c.path === '/v1/admin/quality').every((c) => c.query.get('snapshotId') === SNAP_A)).toBe(true);
  });

  it('a version conflict reloads the current revision instead of overwriting', async () => {
    let gets = 0;
    setup('/?lang=en#quality', {
      'GET /v1/admin/classifications/.+': () => ok({ userId: USER, classification: gets++ ? 'staff' : 'regular', revision: gets > 1 ? '9' : '3', snapshotPending: false }),
      'PUT /v1/admin/classifications/.+': () => fail(409, 'VERSION_CONFLICT'),
    }, ['data_admin']);
    await screen.findByLabelText('Page content');
    fireEvent.change(screen.getByLabelText('Classification user ID'), { target: { value: USER } });
    await userEvent.click(screen.getByRole('button', { name: 'Load current class' }));
    await screen.findByText(/rev 3/);
    await userEvent.selectOptions(screen.getByLabelText('Account class'), 'test');
    fireEvent.change(screen.getByLabelText('Classification reason'), { target: { value: 'mark as test' } });
    await userEvent.click(screen.getByRole('button', { name: 'Save classification' }));
    await screen.findByText(/changed meanwhile/);
    await screen.findByText(/rev 9/);
  });
});
