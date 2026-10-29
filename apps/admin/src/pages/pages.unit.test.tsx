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
    series: { 'cohort.retention': [{ key: '2026-09-28', value: { numerator: 1, denominator: 2 } }, { key: '2026-10-12', value: null },{key:'2026-10-19',value:{numerator:0,denominator:0}}] },
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
  it('labels the latest visible week and warns when it is clipped or still in progress',async()=>{
    const previous=pages.overview!;
    pages.overview={...previous,metrics:{...previous.metrics,weekly:1},series:{'weekly.trend':[{key:'2026-10-05',value:2},{key:'2026-10-12',value:1}]}};
    try {
      setup('/?lang=en#overview');
      const content=await screen.findByLabelText('Page content');
      const card=within(content).getByRole('button',{name:/Weekly attended users/});
      expect(card.querySelector('.metric-value')?.textContent).toBe('1');
      expect(card.textContent).toContain('2026-10-12 · Latest visible week · Partial week');
    } finally {pages.overview=previous;}
  });
  it('shows form errors by fixed step and field and opens snapshot-bound source rows',async()=>{
    pages.journey={...pageData('journey',A,{formErrors:3}),series:{'form.errors.byStep':[{key:'arrange',value:2},{key:'introduce',value:1}],'form.errors.byField':[{key:'venue',value:2},{key:'title',value:1}]}};
    const mock=setup('/?lang=en#journey',{'GET /v1/admin/drilldowns/.+':()=>list([drillRow('event-one',{step:'arrange',field:'venue',errorCode:'required'})])});
    const content=await screen.findByLabelText('Page content');
    await userEvent.click(within(content).getByRole('button',{name:'Host a meal'}));
    expect(within(content).getByRole('heading',{name:'Form errors by step'})).toBeTruthy();
    expect(within(content).getByRole('heading',{name:'Form errors by field'})).toBeTruthy();
    await waitFor(()=>expect(mock.calls.some(call=>call.path==='/v1/admin/drilldowns/formErrors')).toBe(true));
    expect(mock.calls.find(call=>call.path==='/v1/admin/drilldowns/formErrors')?.query.get('snapshotId')).toBe(SNAP_A);
    expect(await within(content).findByText('required')).toBeTruthy();
  });
  it('overview: ratio with zero denominator is "—", numbers and the trend come from the snapshot', async () => {
    setup('/?lang=en#overview');
    const content = await screen.findByLabelText('Page content');
    const cards = within(content).getAllByRole('button').filter((b) => b.className === 'metric-card');
    // v5: the "this week" row (signups, meals published, first applications, meals held, weekly) comes first.
    expect(cards.map((c) => c.querySelector('.metric-value')!.textContent)).toEqual(['—', '—', '—', '—', '12', '37.5%', '—']);
    expect(cards[5]!.textContent).toContain('3 / 8');
    expect(within(content).getByText('90.0%')).toBeTruthy();
    expect(within(content).getByRole('img', { name: 'Weekly attended user trend' })).toBeTruthy();
    expect(content.querySelector('.chart-values')!.textContent).toContain('10-12 —');
  });

  it('overview: the this-week row shows server counts with last week, the platform split and the week start', async () => {
    const previous = pages.overview!;
    pages.overview = { ...previous, metrics: { ...previous.metrics, signups: 5, mealsPublished: 3, firstApplications: 2, mealsHeld: { numerator: 1, denominator: 2 } },
      series: { ...previous.series, 'ops.previousWeek': [{ key: 'signups', value: 4 }, { key: 'mealsPublished', value: 1 }, { key: 'firstApplications', value: 0 }, { key: 'mealsHeld', value: { numerator: 2, denominator: 2 } }, { key: 'weekly', value: 7 }],
        'signups.platform': [{ key: 'IOS', value: 3 }, { key: 'WEB', value: 2 }, { key: 'unknown', value: 0 }] } };
    try {
      setup('/?lang=en#overview');
      const content = await screen.findByLabelText('Page content');
      const row = within(content).getByRole('region', { name: 'This week' });
      const signups = within(row).getByRole('button', { name: /New members this week/ });
      expect(signups.querySelector('.metric-value')?.textContent).toBe('5');
      // Snapshot 2026-10-18 (a Sunday) belongs to the London week starting Monday 2026-10-12.
      expect(signups.textContent).toContain('Week of 2026-10-12 · Last week 4 · iOS 3 · Web 2 · Unknown 0');
      expect(within(row).getByRole('button', { name: /Meals held this week/ }).textContent).toContain('1 / 2');
      expect(within(row).getByRole('button', { name: /Weekly attended users/ }).textContent).toContain('Last week 7');
      expect(within(row).queryByRole('button', { name: /Analytics consent coverage/ })).toBeNull();
    } finally { pages.overview = previous; }
  });

  it('labels consent-sample cards and cites consent coverage without drawing it as a card', async () => {
    const previous = pages.supply!;
    pages.supply = { ...previous, metrics: { ...previous.metrics, consentCoverage: { numerator: 1, denominator: 4 } } };
    try {
      setup('/?lang=en#supply');
      const content = await screen.findByLabelText('Page content');
      const discovery = within(content).getAllByRole('button').find((b) => b.className === 'metric-card' && b.textContent!.includes('2 / 40'))!;
      expect(discovery.textContent).toContain('Consent sample only · consent coverage 25.0%');
      expect(within(content).getByRole('button', { name: /Meal formation|formation/i }).textContent).not.toContain('Consent sample only');
      expect(within(content).queryByRole('button', { name: /Analytics consent coverage/ })).toBeNull();
    } finally { pages.supply = previous; }
  });

  it('shows an empty state (no stale charts) when the snapshot has no data for the filters', async () => {
    pages.journey = pageData('journey', A, { applications: null, confirmed: { numerator: 0, denominator: 0 } });
    setup('/?lang=en#journey');
    const content = await screen.findByLabelText('Page content');
    expect(within(content).getByText('No calculable metrics')).toBeTruthy();
    expect(within(content).getByText(/immature cohorts or incomplete sources/)).toBeTruthy();
    expect(within(content).queryByRole('img')).toBeNull();
  });
  it('renders server decision P90/P50 in hours and keeps a true zero pending count distinct from null waiting time',async()=>{
    pages.journey={...pageData('journey',A,{approval:12,approvalP50:5,pendingApplications:0,oldestPendingHours:null}),series:{'features.usage':[{key:'map_opened',value:0},{key:'chat_opened',value:2}]}};
    setup('/?lang=en#journey',{'GET /v1/admin/drilldowns/.+':()=>list([])});
    const content=await screen.findByLabelText('Page content');
    const p90=within(content).getByRole('button',{name:/Decision time P90 \(hours\)/});
    const p50=within(content).getByRole('button',{name:/Decision time P50 \(hours\)/});
    expect(p90.querySelector('.metric-value')?.textContent).toBe('12');
    expect(p50.querySelector('.metric-value')?.textContent).toBe('5');
    expect(within(content).getByRole('button',{name:/Pending applications/}).querySelector('.metric-value')?.textContent).toBe('0');
    const wait=within(content).getByRole('button',{name:/Oldest pending wait/});
    expect(wait.querySelector('.metric-value')?.textContent).toBe('—');
    expect(wait.textContent).toContain('Unavailable or not applicable');
    expect(within(content).getByText('Map opened')).toBeTruthy();
    expect(within(content).getByText(/cannot detect deployment configuration/)).toBeTruthy();
    await userEvent.click(p50);
    expect(await screen.findByText(/Median hours from successful application/)).toBeTruthy();
  });
  it('does not draw a line across missing trend periods',async()=>{
    const previous=pages.overview!;
    pages.overview={...previous,series:{'weekly.trend':[{key:'2026-09-28',value:5},{key:'2026-10-05',value:null},{key:'2026-10-12',value:7}]}};
    try {
      setup('/?lang=en#overview');
      const chart=await screen.findByRole('img',{name:'Weekly attended user trend'});
      const lines=chart.querySelectorAll('path[fill="none"]');
      expect(lines).toHaveLength(2);
      expect([...lines].every(line=>!line.getAttribute('d')?.includes('L'))).toBe(true);
    } finally {pages.overview=previous;}
  });

  it('retention: unmatured cohorts show "Observing", cohort week opens the cohort users drilldown', async () => {
    const mock = setup('/?lang=en#retention', { 'GET /v1/admin/drilldowns/.+': () => list([]) });
    const content = await screen.findByLabelText('Page content');
    expect(within(content).getByText('Observing')).toBeTruthy();
    expect(within(content).getByText('Unavailable')).toBeTruthy();
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
