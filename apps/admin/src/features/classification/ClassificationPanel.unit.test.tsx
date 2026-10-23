import { render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { createAdminApi } from '../../api/admin-api.ts';
import { ConsoleProvider, useConsole } from '../../state/console.tsx';
import { parseSearch } from '../../state/filters.ts';
import { fail, list, mockFetch, ok, pageData, session, snapshot, SNAP_A, SNAP_B, type Call } from '../../test/mock-api.ts';
import { ClassificationPanel } from './ClassificationPanel.tsx';

const USER = '33333333-3333-4333-8333-333333333333';
const REFRESH = '99999999-9999-4999-8999-999999999999';
const A = snapshot(SNAP_A, '2026-10-18T12:00:00Z');
const B = snapshot(SNAP_B, '2026-10-19T12:00:00Z');
const refresh = (state: 'pending' | 'ready' | 'failed', revision = '4') => ({ refreshId: REFRESH, targetUserId: USER, acceptedRevision: revision, state,
  snapshotId: state === 'ready' ? SNAP_B : null, failureCode: state === 'failed' ? 'SNAPSHOT_FAILED' : null, updatedAt: '2026-10-19T12:00:00Z' });
const receipt = (state: string, extra: Record<string, unknown> = {}) => ({ operation: 'classifyUser', key: '', state, retryable: false, expired: false, retryAfterSeconds: null, httpStatus: null, errorCode: null, conflict: null,
  resourceId: null, resourceVersion: null, currentVersion: null, completedAt: null, expiresAt: null, ...extra });

function Settled() { const c = useConsole(); return <output aria-label="settled">{String(c.statisticsSettled)}</output>; }
function setup(routes: Record<string, (c: Call) => ReturnType<typeof ok> | Promise<ReturnType<typeof ok>>>) {
  const snapshots = [A];
  const mock = mockFetch({
    'GET /v1/auth/session': () => ok(session(['data_admin'])),
    'GET /v1/admin/snapshots': () => list(snapshots),
    'GET /v1/admin/overview': () => ok(pageData('overview', A)),
    'GET /v1/admin/classifications/.+': () => ok({ userId: USER, classification: 'regular', revision: '3', snapshotPending: false }),
    ...routes,
  });
  function Harness() {
    const [id, setId] = useState<string | null>(SNAP_A);
    return <ConsoleProvider api={createAdminApi({ fetch: mock.fetch })} page="overview" filters={parseSearch('').filters} snapshotId={id} onSnapshotChange={setId} syncIntervalMs={10}>
      <Settled /><output aria-label="snapshot">{id}</output><ClassificationPanel t={(_zh, en) => en} />
    </ConsoleProvider>;
  }
  render(<Harness />);
  return { mock, addSnapshot: () => snapshots.push(B) };
}
async function saveTest() {
  await userEvent.type(await screen.findByLabelText('Classification user ID'), USER);
  await userEvent.click(screen.getByRole('button', { name: 'Load current class' }));
  await screen.findByText(/rev 3/);
  await userEvent.selectOptions(screen.getByLabelText('Account class'), 'test');
  await userEvent.type(screen.getByLabelText('Classification reason'), 'qa account');
  await userEvent.click(screen.getByRole('button', { name: 'Save classification' }));
}
const puts = (calls: Call[]) => calls.filter((c) => c.method === 'PUT');

describe('A01/A03/A05 classification recovery through the real console', () => {
  it('lost response: NONE stays unknown, SUCCEEDED recovers the same refresh, ready re-enables statistics; one PUT only', async () => {
    let receiptState = 'NONE';
    let refreshState: 'pending' | 'ready' = 'pending';
    const { mock, addSnapshot } = setup({
      'PUT /v1/admin/classifications/.+': () => { throw new TypeError('offline: response lost'); },
      'GET /v1/me/command-receipts/classifyUser/.+': (c) => ok(receipt(receiptState, receiptState === 'SUCCEEDED' ? { key: c.path.split('/').pop(), httpStatus: 200, resourceId: USER, resourceVersion: '4' } : { key: c.path.split('/').pop() })),
      'GET /v1/admin/statistics-refresh-intents/.+': () => ok(refresh(refreshState)),
      'GET /v1/admin/statistics-refresh/[^/]+': () => ok(refresh(refreshState)),
    });
    // The PUT's response is lost in transit (network error); its outcome is unknown.
    await saveTest();
    await screen.findByText(/checking the original request only/);
    expect(screen.getByLabelText('settled').textContent).toBe('false');
    await waitFor(() => expect(mock.calls.filter((c) => c.path.startsWith('/v1/me/command-receipts')).length).toBeGreaterThan(1));
    expect(screen.getByText(/checking the original request only/)).toBeTruthy();
    const key = puts(mock.calls)[0]!.headers['idempotency-key'];
    expect(mock.calls.filter((c) => c.path.startsWith('/v1/me/command-receipts')).every((c) => c.path.endsWith(`/classifyUser/${key}`))).toBe(true);
    receiptState = 'SUCCEEDED';
    await screen.findByText(/Statistics are updating; old statistics are hidden/);
    const locate = await waitFor(() => { const call = mock.calls.find((c) => c.path.startsWith('/v1/admin/statistics-refresh-intents/')); expect(call).toBeDefined(); return call!; });
    expect(locate.path).toBe(`/v1/admin/statistics-refresh-intents/${key}/${USER}/4`);
    addSnapshot(); refreshState = 'ready';
    await screen.findByText(/Statistics are updated in a new snapshot/);
    expect(screen.getByLabelText('settled').textContent).toBe('true');
    await userEvent.click(await screen.findByRole('button', { name: 'Switch to the snapshot with this classification' }));
    expect(screen.getByLabelText('snapshot').textContent).toBe(SNAP_B);
    expect(puts(mock.calls)).toHaveLength(1);
  });

  it('failed statistics: retry posts only the statistics retry, never another classification', async () => {
    let state: 'failed' | 'pending' = 'failed';
    const { mock } = setup({
      'PUT /v1/admin/classifications/.+': () => ok({ userId: USER, classification: 'test', revision: '4', snapshotPending: true, statisticsRefresh: refresh('pending') }),
      'GET /v1/admin/statistics-refresh/[^/]+': () => ok(refresh(state)),
      'POST /v1/admin/statistics-refresh/.+/retry': () => { state = 'pending'; return ok(refresh('pending')); },
    });
    await saveTest();
    await userEvent.click(await screen.findByRole('button', { name: 'Retry statistics update' }));
    await screen.findByText(/Statistics are updating/);
    expect(mock.calls.filter((c) => c.method === 'POST' && c.path.endsWith('/retry'))).toHaveLength(1);
    expect(puts(mock.calls)).toHaveLength(1);
    expect(screen.getByLabelText('settled').textContent).toBe('false');
  });

  it('a version conflict reloads the latest version and needs an explicit new save', async () => {
    let gets = 0;
    const { mock } = setup({
      'GET /v1/admin/classifications/.+': () => ok({ userId: USER, classification: gets++ ? 'staff' : 'regular', revision: gets > 1 ? '9' : '3', snapshotPending: false }),
      'PUT /v1/admin/classifications/.+': () => fail(409, 'VERSION_CONFLICT'),
    });
    await saveTest();
    await screen.findByText(/changed meanwhile/);
    await screen.findByText(/rev 9/);
    expect(screen.getByLabelText('settled').textContent).toBe('true');
    expect(puts(mock.calls)).toHaveLength(1);
  });
});
