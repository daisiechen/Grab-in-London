import { act, render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import App from '../App.tsx';
import { createAdminApi } from '../api/admin-api.ts';
import { fail, list, mockFetch, ok, pageData, session, SNAP_A, snapshot, type Call } from '../test/mock-api.ts';

const A = snapshot(SNAP_A, '2026-10-18T12:00:00Z');
function setup(overview: (c: Call) => ReturnType<typeof ok>, url = '/?lang=en&languages=zh&sizes=2#overview') {
  history.replaceState(null, '', url);
  const mock = mockFetch({ 'GET /v1/auth/session': () => ok(session()), 'GET /v1/admin/snapshots': () => list([A]), 'GET /v1/admin/overview': overview });
  render(<App api={createAdminApi({ fetch: mock.fetch })} />);
  return mock;
}
const pageCalls = (calls: Call[]) => calls.filter((c) => c.path === '/v1/admin/overview');
const withRetryAfter = (seconds: number) => ({ status: 429, body: { error: { code: 'RATE_LIMITED', message: 'slow down', retryAfterSeconds: seconds }, meta: { requestId: 'req-429' } } });

describe('A08 page failures retry the same applied query', () => {
  afterEach(() => { vi.useRealTimers(); });
  it('503: retry re-requests the page with the identical snapshot and query, then shows it', async () => {
    let n = 0;
    const mock = setup(() => (n++ ? ok(pageData('overview', A)) : fail(503, 'PROVIDER_UNAVAILABLE')));
    await userEvent.click(await screen.findByRole('button', { name: 'Retry loading' }));
    await screen.findByLabelText('Page content');
    const [first, second] = pageCalls(mock.calls);
    expect(second).toBeDefined();
    expect(second!.query.toString()).toBe(first!.query.toString());
    expect(first!.query.get('languages')).toBe('zh');
  });

  it('429: retry stays disabled until the absolute Retry-After, then re-requests the same query', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    let n = 0;
    const mock = setup(() => (n++ ? ok(pageData('overview', A)) : withRetryAfter(30)) as ReturnType<typeof ok>);
    const retry = await screen.findByRole('button', { name: 'Retry loading' });
    expect((retry as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText(/retry in 30 s/)).toBeTruthy();
    await act(async () => { await vi.advanceTimersByTimeAsync(29_000); });
    expect((screen.getByRole('button', { name: 'Retry loading' }) as HTMLButtonElement).disabled).toBe(true);
    await act(async () => { await vi.advanceTimersByTimeAsync(1_500); });
    await waitFor(() => expect((screen.getByRole('button', { name: 'Retry loading' }) as HTMLButtonElement).disabled).toBe(false));
    screen.getByRole('button', { name: 'Retry loading' }).click();
    await screen.findByLabelText('Page content');
    expect(pageCalls(mock.calls)).toHaveLength(2);
    expect(pageCalls(mock.calls)[1]!.query.toString()).toBe(pageCalls(mock.calls)[0]!.query.toString());
  });

  it('switching language neither refetches nor changes the applied query', async () => {
    const mock = setup(() => ok(pageData('overview', A)));
    await screen.findByLabelText('Page content');
    const before = pageCalls(mock.calls).length;
    await userEvent.click(screen.getByRole('button', { name: 'Switch to Chinese' }));
    await screen.findByLabelText('页面内容');
    expect(pageCalls(mock.calls)).toHaveLength(before);
    expect(new URL(location.href).searchParams.get('languages')).toBe('zh');
  });
});
