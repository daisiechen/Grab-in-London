import { ApiError } from '@fancy/client';
import type { AdminApi } from '../../api/admin-api.ts';
import { toFailure } from '../../api/failure.ts';
import { scopeOf, type IntentEvent, type IntentState } from './intent.ts';

export const SYNC_INTERVAL_MS = 4000;

/**
 * Whether the console should read anything for this intent now (reads only; never a write). A ready
 * refresh not bound to the selected snapshot keeps being read, because the server re-binds it to
 * the newest snapshot sealing it.
 */
export function needsSync(state: IntentState, selectedSnapshotId: string | null = null): boolean {
  if (state.phase === 'unknown') return state.reason !== 'reauth';
  if (state.phase !== 'accepted' || state.stats.status === 'failed') return false;
  return state.stats.status !== 'ready' || state.stats.refresh.snapshotId !== selectedSnapshotId;
}

/**
 * Delay before the next read of this intent, taken from the response just received: a receipt's
 * Retry-After (PENDING / in progress) wins, otherwise the poll interval. The caller makes it an
 * absolute deadline at receipt time, so a new Retry-After applies to the very next read.
 */
export function delayAfter(event: IntentEvent | null, intervalMs = SYNC_INTERVAL_MS): number {
  const seconds = event?.type === 'receipt' ? event.receipt.retryAfterSeconds : null;
  return seconds ? Math.max(seconds * 1000, intervalMs) : intervalMs;
}

/**
 * One read for an unresolved intent: the original-intent receipt while unknown, then this intent's
 * statistics refresh (located by key + frozen target + accepted revision until its id is known).
 * Every result carries the intent's scope so the reducer can drop it once superseded.
 */
export async function syncIntent(api: AdminApi, state: IntentState): Promise<IntentEvent | null> {
  const scope = scopeOf(state.intent);
  if (state.phase === 'unknown') {
    try { return { type: 'receipt', scope, receipt: await api.classifyReceipt(state.intent.key) }; } catch (error) { return { type: 'receiptFailed', scope, kind: toFailure(error).kind }; }
  }
  if (state.phase !== 'accepted') return null;
  try {
    const refresh = state.stats.status === 'locating'
      ? await api.findStatisticsRefresh(state.intent.key, state.intent.targetUserId, state.acceptedRevision)
      : await api.statisticsRefresh(state.stats.refresh.refreshId);
    return { type: 'stats', scope, refresh };
  } catch { return { type: 'statsFailed', scope }; }
}

/** Accepted classification with failed statistics: reopen the statistics only (same key per click intent). */
export async function retryStatistics(api: AdminApi, state: IntentState, idempotencyKey: string): Promise<IntentEvent | null> {
  if (state.phase !== 'accepted' || state.stats.status === 'locating') return null;
  const scope = scopeOf(state.intent);
  try { return { type: 'stats', scope, refresh: await api.retryStatisticsRefresh(state.stats.refresh.refreshId, idempotencyKey) }; } catch { return { type: 'statsFailed', scope }; }
}

/** Save outcome of the original classify request, mapped to the frozen intent's scope. */
export function saveFailure(state: IntentState, error: unknown): IntentEvent {
  const failure = toFailure(error);
  return { type: 'saveFailed', scope: scopeOf(state.intent), kind: failure.kind,
    code: error instanceof ApiError ? error.code : null, currentVersion: error instanceof ApiError ? error.currentVersion ?? null : null };
}
