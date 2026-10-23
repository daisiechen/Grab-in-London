import { act, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CommandReceipt } from '@fancy/client';
import { createAdminApi, type AdminApi } from '../api/admin-api.ts';
import { list, mockFetch, ok, pageData, session, snapshot, SNAP_A } from '../test/mock-api.ts';
import { ConsoleProvider, useConsole } from './console.tsx';
import { parseSearch } from './filters.ts';

const KEY = '00000000-0000-4000-8000-0000000000c1';
const TARGET = '20000000-0000-4000-8000-000000000001';
const receipt = (state: CommandReceipt['state'], retryAfterSeconds: number | null = null) => ({ operation: 'classifyUser', key: KEY, state, retryable: false, expired: false, retryAfterSeconds,
  httpStatus: null, errorCode: null, conflict: null, resourceId: null, resourceVersion: null, currentVersion: null, completedAt: null, expiresAt: null }) as CommandReceipt;

function Probe() {
  const c = useConsole();
  return (
    <>
      <button disabled={!c.session} onClick={() => {
        const intent = { accountId: c.session!.user.id, key: KEY, targetUserId: TARGET, classification: 'test' as const, reason: 'Synthetic delay', baseRevision: '0' };
        c.dispatchIntent({ type: 'submit', intent });
        c.dispatchIntent({ type: 'saveFailed', scope: { accountId: intent.accountId, key: KEY, targetUserId: TARGET }, kind: 'network', code: null, currentVersion: null });
      }}>start</button>
      <output aria-label="phase">{c.intents.byTarget[TARGET]?.phase ?? 'none'}</output>
    </>
  );
}
function mount(api: AdminApi) {
  function Harness() {
    const [id, setId] = useState<string | null>(SNAP_A);
    return <ConsoleProvider api={api} page="overview" filters={parseSearch('').filters} snapshotId={id} onSnapshotChange={setId} syncIntervalMs={1000}><Probe /></ConsoleProvider>;
  }
  return render(<Harness />);
}
const advance = (ms: number) => act(async () => { await vi.advanceTimersByTimeAsync(ms); });

describe('console reads unresolved intents at the pace of each response', () => {
  afterEach(() => { vi.useRealTimers(); });
  it('normal cadence for NONE, then a new Retry-After governs the next read, then cadence resumes', async () => {
    vi.useFakeTimers();
    const snap = snapshot(SNAP_A, '2026-10-18T12:00:00Z');
    const mock = mockFetch({ 'GET /v1/auth/session': () => ok(session()), 'GET /v1/admin/snapshots': () => list([snap]), 'GET /v1/admin/overview': () => ok(pageData('overview', snap)) });
    const api = createAdminApi({ fetch: mock.fetch });
    const replies = [receipt('NONE'), receipt('NONE'), receipt('PENDING', 30), receipt('NONE')];
    api.classifyReceipt = vi.fn(async () => replies.shift() ?? receipt('NONE'));
    const view = mount(api);
    try {
      await advance(0);
      fireEvent.click(screen.getByRole('button', { name: 'start' }));
      // Ticks every 1 s; checks sit between ticks. NONE keeps the 1 s cadence.
      await advance(1_500);
      expect(api.classifyReceipt).toHaveBeenCalledTimes(1);
      await advance(1_000);
      expect(api.classifyReceipt).toHaveBeenCalledTimes(2);
      await advance(1_000); // third read (t≈3 s) returns PENDING with Retry-After 30 s
      expect(api.classifyReceipt).toHaveBeenCalledTimes(3);
      await advance(29_000); // t≈32.5 s: still inside the 30 s wait
      expect(api.classifyReceipt).toHaveBeenCalledTimes(3);
      await advance(1_000); // t≈33.5 s: the wait has passed
      expect(api.classifyReceipt).toHaveBeenCalledTimes(4);
      await advance(1_000); // NONE again: cadence resumes
      expect(api.classifyReceipt).toHaveBeenCalledTimes(5);
      expect(screen.getByLabelText('phase').textContent).toBe('unknown');
    } finally { view.unmount(); }
  });
});
