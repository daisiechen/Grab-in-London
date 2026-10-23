import type { CommandReceipt } from '@fancy/client';
import type { StatisticsRefresh } from '../../api/admin-api.ts';
import type { FailureKind } from '../../api/failure.ts';

/**
 * PATCH-006 P09 classification intent book (pure state; no I/O).
 *
 * One frozen intent per target user, bound to the signed-in account. The rules it enforces:
 * - Unknown resolves only by reading the original actor+operation+key receipt. NONE, a failed read or
 *   an equal current value never imply success or failure, and nothing is ever re-sent from here.
 * - Accepted means the classification is committed; afterwards only statistics may be retried.
 * - Events carry the scope they were issued for; anything for another account, another key or a
 *   target whose intent was replaced is dropped (late responses after switching user/account).
 * - Later draft edits never touch the frozen payload/revision.
 */
export type ClassificationValue = 'regular' | 'test' | 'staff';

export interface FrozenIntent {
  readonly accountId: string;
  readonly key: string;
  readonly targetUserId: string;
  readonly classification: ClassificationValue;
  readonly reason: string;
  readonly baseRevision: string;
}

export type StatisticsRefreshView = StatisticsRefresh;

export type StatsState =
  | { status: 'locating'; lookupFailed: boolean }
  | { status: 'pending' | 'ready' | 'failed'; refresh: StatisticsRefreshView; lookupFailed: boolean };

export type UnknownReason = 'network' | 'pending' | 'none' | 'read_failed' | 'reauth';
export type RejectedReason = 'not_found' | 'forbidden' | 'invalid' | 'expired' | 'other';

export type IntentState =
  | { phase: 'saving'; intent: FrozenIntent }
  | { phase: 'unknown'; intent: FrozenIntent; reason: UnknownReason; retryAfterSeconds: number | null }
  | { phase: 'accepted'; intent: FrozenIntent; acceptedRevision: string; stats: StatsState }
  | { phase: 'conflict'; intent: FrozenIntent; currentVersion: string | null }
  | { phase: 'rejected'; intent: FrozenIntent; reason: RejectedReason };

export interface IntentBook {
  readonly accountId: string | null;
  readonly byTarget: Readonly<Record<string, IntentState>>;
}

export interface Scope { accountId: string; targetUserId: string; key: string }

export type IntentEvent =
  | { type: 'accountChanged'; accountId: string | null }
  | { type: 'submit'; intent: FrozenIntent }
  | { type: 'saved'; scope: Scope; revision: string; statisticsRefresh: StatisticsRefreshView }
  | { type: 'saveFailed'; scope: Scope; kind: FailureKind; code: string | null; currentVersion: string | null }
  | { type: 'receipt'; scope: Scope; receipt: CommandReceipt }
  | { type: 'receiptFailed'; scope: Scope; kind: FailureKind }
  | { type: 'stats'; scope: Scope; refresh: StatisticsRefreshView }
  | { type: 'statsFailed'; scope: Scope }
  | { type: 'dismiss'; targetUserId: string };

export const emptyBook = (accountId: string | null = null): IntentBook => ({ accountId, byTarget: {} });

const freeze = (intent: FrozenIntent): FrozenIntent => Object.freeze({ ...intent, targetUserId: intent.targetUserId.toLowerCase(), key: intent.key.toLowerCase() });

/** True while the target has an intent whose outcome is not settled; a new classify is refused. */
export function isUnsettled(state: IntentState | undefined): boolean {
  return state?.phase === 'saving' || state?.phase === 'unknown';
}

/** The only actions each phase permits (the UI derives buttons from this, never from guesses). */
export function allowedActions(state: IntentState | undefined): ReadonlySet<'submit' | 'queryReceipt' | 'locateStats' | 'retryStats' | 'reload'> {
  if (!state) return new Set(['submit']);
  switch (state.phase) {
    case 'saving': return new Set();
    case 'unknown': return new Set(['queryReceipt']);
    case 'accepted':
      if (state.stats.status === 'locating') return new Set(['locateStats']);
      if (state.stats.status === 'failed') return new Set(['retryStats', 'locateStats', 'submit']);
      return new Set(state.stats.status === 'ready' ? ['submit'] : ['locateStats']);
    case 'conflict': return new Set(['reload']);
    case 'rejected': return new Set(state.reason === 'expired' ? ['reload'] : ['submit', 'reload']);
  }
}

function current(book: IntentBook, scope: Scope): IntentState | null {
  if (book.accountId === null || scope.accountId !== book.accountId) return null;
  const state = book.byTarget[scope.targetUserId.toLowerCase()];
  return state && state.intent.key === scope.key.toLowerCase() ? state : null;
}

const put = (book: IntentBook, state: IntentState): IntentBook => ({ ...book, byTarget: { ...book.byTarget, [state.intent.targetUserId]: state } });

const rejectedReason = (kind: FailureKind | null, code: string | null): RejectedReason => {
  if (kind === 'not_found' || code === 'NOT_FOUND') return 'not_found';
  if (kind === 'forbidden' || code === 'FORBIDDEN') return 'forbidden';
  if (kind === 'invalid' || code === 'VALIDATION_FAILED') return 'invalid';
  return 'other';
};

function statsFrom(intent: FrozenIntent, acceptedRevision: string, refresh: StatisticsRefreshView, lookupFailed = false): StatsState | null {
  // A refresh for another user or another revision is not this intent's statistics.
  if (refresh.targetUserId.toLowerCase() !== intent.targetUserId || refresh.acceptedRevision !== acceptedRevision) return null;
  return { status: refresh.state, refresh, lookupFailed };
}

export function reduceIntents(book: IntentBook, event: IntentEvent): IntentBook {
  switch (event.type) {
    case 'accountChanged':
      // Another account never sees, resolves or inherits these intents.
      return event.accountId === book.accountId ? book : emptyBook(event.accountId);
    case 'dismiss': {
      const state = book.byTarget[event.targetUserId.toLowerCase()];
      // An unsettled intent, or accepted statistics not yet ready, stays until resolved.
      if (!state || !settled(state)) return book;
      return { ...book, byTarget: Object.fromEntries(Object.entries(book.byTarget).filter(([id]) => id !== state.intent.targetUserId)) };
    }
    case 'submit': {
      const intent = freeze(event.intent);
      if (book.accountId === null || intent.accountId !== book.accountId) return book;
      const existing = book.byTarget[intent.targetUserId];
      if (!allowedActions(existing).has('submit')) return book;
      return put(book, { phase: 'saving', intent });
    }
    case 'saved': {
      const state = current(book, event.scope);
      if (!state || (state.phase !== 'saving' && state.phase !== 'unknown')) return book;
      const stats = statsFrom(state.intent, event.revision, event.statisticsRefresh) ?? { status: 'locating' as const, lookupFailed: false };
      return put(book, { phase: 'accepted', intent: state.intent, acceptedRevision: event.revision, stats });
    }
    case 'saveFailed': {
      const state = current(book, event.scope);
      if (!state || state.phase !== 'saving') return book;
      const { intent } = state;
      if (event.code === 'VERSION_CONFLICT') return put(book, { phase: 'conflict', intent, currentVersion: event.currentVersion });
      if (event.code === 'INTENT_IN_PROGRESS') return put(book, { phase: 'unknown', intent, reason: 'pending', retryAfterSeconds: null });
      if (event.kind === 'signed_out' || event.kind === 'reauth') return put(book, { phase: 'unknown', intent, reason: 'reauth', retryAfterSeconds: null });
      if (event.kind === 'network' || event.kind === 'unavailable' || event.kind === 'rate_limited' || event.kind === 'error')
        return put(book, { phase: 'unknown', intent, reason: 'network', retryAfterSeconds: null });
      return put(book, { phase: 'rejected', intent, reason: rejectedReason(event.kind, event.code) });
    }
    case 'receipt': {
      const state = current(book, event.scope);
      const { receipt } = event;
      if (!state || state.phase !== 'unknown' || receipt.operation !== 'classifyUser' || receipt.key !== state.intent.key) return book;
      const { intent } = state;
      switch (receipt.state) {
        case 'SUCCEEDED':
          if (receipt.resourceId?.toLowerCase() !== intent.targetUserId || !receipt.resourceVersion) return put(book, { ...state, reason: 'read_failed' });
          return put(book, { phase: 'accepted', intent, acceptedRevision: receipt.resourceVersion, stats: { status: 'locating', lookupFailed: false } });
        case 'NONE':
          // No record is not a failure: keep the original intent unresolved, never re-send it from here.
          return put(book, { ...state, reason: 'none', retryAfterSeconds: null });
        case 'PENDING':
          if (receipt.expired) return put(book, { phase: 'rejected', intent, reason: 'expired' });
          return put(book, { ...state, reason: 'pending', retryAfterSeconds: receipt.retryAfterSeconds });
        case 'REJECTED':
          if (receipt.conflict === 'VERSION') return put(book, { phase: 'conflict', intent, currentVersion: receipt.currentVersion });
          if (receipt.conflict === 'IN_PROGRESS') return receipt.expired
            ? put(book, { phase: 'rejected', intent, reason: 'expired' })
            : put(book, { ...state, reason: 'pending', retryAfterSeconds: receipt.retryAfterSeconds });
          return put(book, { phase: 'rejected', intent, reason: rejectedReason(null, receipt.errorCode) });
      }
      return book;
    }
    case 'receiptFailed': {
      const state = current(book, event.scope);
      if (!state || state.phase !== 'unknown') return book;
      return put(book, { ...state, reason: event.kind === 'signed_out' || event.kind === 'reauth' ? 'reauth' : 'read_failed' });
    }
    case 'stats': {
      const state = current(book, event.scope);
      if (!state || state.phase !== 'accepted') return book;
      const stats = statsFrom(state.intent, state.acceptedRevision, event.refresh);
      return stats ? put(book, { ...state, stats }) : book;
    }
    case 'statsFailed': {
      const state = current(book, event.scope);
      if (!state || state.phase !== 'accepted') return book;
      return put(book, { ...state, stats: { ...state.stats, lookupFailed: true } });
    }
  }
}

const settled = (s: IntentState) => s.phase === 'conflict' || s.phase === 'rejected' || (s.phase === 'accepted' && s.stats.status === 'ready');

/** Old statistics may only be shown when no intent of this account awaits a refresh. */
export function statisticsSettled(book: IntentBook): boolean {
  return Object.values(book.byTarget).every(settled);
}

export const scopeOf = (intent: FrozenIntent): Scope => ({ accountId: intent.accountId, targetUserId: intent.targetUserId, key: intent.key });
