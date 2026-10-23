import { describe, expect, it } from 'vitest';
import { ApiError } from '@fancy/client';
import { createAdminApi } from '../../api/admin-api.ts';
import { fail, mockFetch, ok } from '../../test/mock-api.ts';
import type { FrozenIntent, IntentState, StatisticsRefreshView } from './intent.ts';
import { delayAfter, needsSync, retryStatistics, saveFailure, syncIntent } from './sync.ts';

const intent: FrozenIntent = { accountId: '00000000-0000-4000-8000-0000000000a1', key: '00000000-0000-4000-8000-0000000000c1', targetUserId: '00000000-0000-4000-8000-0000000000b1', classification: 'test', reason: 'Synthetic', baseRevision: '3' };
const refresh: StatisticsRefreshView = { refreshId: '00000000-0000-4000-8000-0000000000d1', targetUserId: intent.targetUserId, acceptedRevision: '7', state: 'pending', snapshotId: null, failureCode: null, updatedAt: '2026-10-23T12:00:00.000Z' };
const scope = { accountId: intent.accountId, targetUserId: intent.targetUserId, key: intent.key };
const receipt = { operation: 'classifyUser', key: intent.key, state: 'SUCCEEDED', retryable: false, expired: false, retryAfterSeconds: null, httpStatus: 200, errorCode: null, conflict: null, resourceId: intent.targetUserId, resourceVersion: '7', currentVersion: null, completedAt: '2026-10-23T12:00:00.000Z', expiresAt: '2026-11-22T12:00:00.000Z' };

describe('classification intent sync (reads only)', () => {
  it('unknown reads only the original classifyUser receipt of the same key', async () => {
    const mock = mockFetch({ 'GET /v1/me/command-receipts/classifyUser/.+': () => ok(receipt) });
    const event = await syncIntent(createAdminApi({ fetch: mock.fetch }), { phase: 'unknown', intent, reason: 'network', retryAfterSeconds: null });
    expect(event).toEqual({ type: 'receipt', scope, receipt });
    expect(mock.calls.map((c) => `${c.method} ${c.path}`)).toEqual([`GET /v1/me/command-receipts/classifyUser/${intent.key}`]);
  });
  it('a failed receipt read stays a read failure, never a write', async () => {
    const mock = mockFetch({ 'GET /v1/me/command-receipts/classifyUser/.+': () => fail(503, 'PROVIDER_UNAVAILABLE') });
    expect(await syncIntent(createAdminApi({ fetch: mock.fetch }), { phase: 'unknown', intent, reason: 'none', retryAfterSeconds: null })).toEqual({ type: 'receiptFailed', scope, kind: 'unavailable' });
    expect(mock.calls.every((c) => c.method === 'GET')).toBe(true);
  });
  it('locates the refresh by key + frozen target + accepted revision, then follows it by id', async () => {
    const mock = mockFetch({
      'GET /v1/admin/statistics-refresh-intents/.+': () => ok(refresh),
      'GET /v1/admin/statistics-refresh/[^/]+': () => ok({ ...refresh, state: 'ready', snapshotId: '00000000-0000-4000-8000-0000000000e1' }),
    });
    const api = createAdminApi({ fetch: mock.fetch });
    expect(await syncIntent(api, { phase: 'accepted', intent, acceptedRevision: '7', stats: { status: 'locating', lookupFailed: false } })).toEqual({ type: 'stats', scope, refresh });
    expect(mock.calls[0]!.path).toBe(`/v1/admin/statistics-refresh-intents/${intent.key}/${intent.targetUserId}/7`);
    const next = await syncIntent(api, { phase: 'accepted', intent, acceptedRevision: '7', stats: { status: 'pending', refresh, lookupFailed: false } });
    expect(next).toMatchObject({ type: 'stats', refresh: { state: 'ready' } });
    expect(mock.calls[1]!.path).toBe(`/v1/admin/statistics-refresh/${refresh.refreshId}`);
  });
  it('a 404 locating the refresh keeps the intent accepted and only flags the lookup', async () => {
    const mock = mockFetch({ 'GET /v1/admin/statistics-refresh-intents/.+': () => fail(404, 'NOT_FOUND') });
    expect(await syncIntent(createAdminApi({ fetch: mock.fetch }), { phase: 'accepted', intent, acceptedRevision: '7', stats: { status: 'locating', lookupFailed: false } })).toEqual({ type: 'statsFailed', scope });
  });
  it('statistics retry posts only the retry endpoint with the given key', async () => {
    const mock = mockFetch({ 'POST /v1/admin/statistics-refresh/.+/retry': () => ok(refresh) });
    const state: IntentState = { phase: 'accepted', intent, acceptedRevision: '7', stats: { status: 'failed', refresh: { ...refresh, state: 'failed', failureCode: 'SNAPSHOT_FAILED' }, lookupFailed: false } };
    expect(await retryStatistics(createAdminApi({ fetch: mock.fetch }), state, '00000000-0000-4000-8000-0000000000f1')).toEqual({ type: 'stats', scope, refresh });
    expect(mock.calls).toHaveLength(1);
    expect(mock.calls[0]!.headers['idempotency-key']).toBe('00000000-0000-4000-8000-0000000000f1');
    expect(mock.calls.some((c) => c.path.startsWith('/v1/admin/classifications'))).toBe(false);
  });
  it('polls only unresolved intents and honours the receipt Retry-After', () => {
    expect(needsSync({ phase: 'unknown', intent, reason: 'reauth', retryAfterSeconds: null })).toBe(false);
    expect(needsSync({ phase: 'unknown', intent, reason: 'none', retryAfterSeconds: null })).toBe(true);
    expect(needsSync({ phase: 'accepted', intent, acceptedRevision: '7', stats: { status: 'failed', refresh, lookupFailed: false } })).toBe(false);
    expect(needsSync({ phase: 'conflict', intent, currentVersion: '9' })).toBe(false);
    const ready: IntentState = { phase: 'accepted', intent, acceptedRevision: '7', stats: { status: 'ready', refresh: { ...refresh, state: 'ready', snapshotId: '00000000-0000-4000-8000-0000000000e1' }, lookupFailed: false } };
    expect(needsSync(ready, '00000000-0000-4000-8000-0000000000e1')).toBe(false);
    expect(needsSync(ready, '00000000-0000-4000-8000-0000000000e0')).toBe(true);
    // The delay comes from the response just received, not from the state before the read.
    expect(delayAfter({ type: 'receipt', scope, receipt: { ...receipt, state: 'PENDING', retryAfterSeconds: 12 } as never }, 10)).toBe(12000);
    expect(delayAfter({ type: 'receipt', scope, receipt: { ...receipt, state: 'NONE' } as never }, 10)).toBe(10);
    expect(delayAfter({ type: 'receiptFailed', scope, kind: 'network' }, 10)).toBe(10);
    expect(delayAfter(null, 10)).toBe(10);
  });
  it('maps save errors with their code and current version', () => {
    expect(saveFailure({ phase: 'saving', intent }, new ApiError({ status: 409, code: 'VERSION_CONFLICT', message: 'x', currentVersion: '9' }))).toEqual({ type: 'saveFailed', scope, kind: 'conflict', code: 'VERSION_CONFLICT', currentVersion: '9' });
  });
});
