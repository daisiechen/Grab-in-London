import { render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import App from './App.tsx';
import { createAdminApi } from './api/admin-api.ts';
import { list, mockFetch, ok, pageData, session, SNAP_A, SNAP_B, snapshot, type Call } from './test/mock-api.ts';

const USER = '33333333-3333-4333-8333-333333333333';
const A = snapshot(SNAP_A, '2026-10-18T12:00:00Z');
const B = snapshot(SNAP_B, '2026-10-19T12:00:00Z');

/** P10-R02 / A05: a ready job never unlocks the old selected snapshot; its sealed snapshot does, for page, drilldown and export alike. */
describe('statistics gate follows the selected snapshot, not the job', () => {
  it('keeps old statistics, drilldowns and export hidden until the ready snapshot is explicitly selected', async () => {
    // The older snapshot A is explicitly selected; B exists and will be the ready refresh's snapshot.
    history.replaceState(null, '', `/?lang=en&snapshot=${SNAP_A}#quality`);
    const mock = mockFetch({
      'GET /v1/auth/session': () => ok(session(['analyst', 'data_admin'])),
      'GET /v1/admin/snapshots': () => list([A, B]),
      'GET /v1/admin/(overview|journey|supply|retention|quality)': (c: Call) => ok(pageData(c.path.split('/').pop()!, c.query.get('snapshotId') === SNAP_B ? B : A)),
      'GET /v1/admin/classifications/.+': () => ok({ userId: USER, classification: 'regular', revision: '3', snapshotPending: false }),
      'PUT /v1/admin/classifications/.+': () => ok({ userId: USER, classification: 'test', revision: '4', snapshotPending: true,
        statisticsRefresh: { refreshId: '99999999-9999-4999-8999-999999999999', targetUserId: USER, acceptedRevision: '4', state: 'ready', snapshotId: SNAP_B, failureCode: null, updatedAt: '2026-10-19T12:00:00Z' } }),
    });
    render(<App api={createAdminApi({ fetch: mock.fetch })} />);
    expect((await screen.findByLabelText('Page content')).getAttribute('data-snapshot')).toBe(SNAP_A);
    await userEvent.type(screen.getByLabelText('Classification user ID'), USER);
    await userEvent.click(screen.getByRole('button', { name: 'Load current class' }));
    await screen.findByText(/rev 3/);
    await userEvent.selectOptions(screen.getByLabelText('Account class'), 'test');
    await userEvent.type(screen.getByLabelText('Classification reason'), 'qa account');
    await userEvent.click(screen.getByRole('button', { name: 'Save classification' }));
    await screen.findByText(/Statistics are updated in a new snapshot/);
    const selected = () => new URL(location.href).searchParams.get('snapshot');
    expect(selected()).toBe(SNAP_A);
    expect(screen.queryByLabelText('Page content')).toBeNull();
    expect((screen.getByRole('button', { name: 'Export metrics' }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByRole('button', { name: 'Dismiss' })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Switch to the snapshot with this classification' }));
    await waitFor(() => expect(selected()).toBe(SNAP_B));
    const section = await screen.findByLabelText('Page content');
    expect(section.getAttribute('data-snapshot')).toBe(SNAP_B);
    await waitFor(() => expect((screen.getByRole('button', { name: 'Export metrics' }) as HTMLButtonElement).disabled).toBe(false));
  });
});
