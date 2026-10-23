import { describe, expect, it } from 'vitest';
import type { CommandReceipt } from '@fancy/client';
import type { FailureKind } from '../../api/failure.ts';
import { allowedActions, emptyBook, reduceIntents, scopeOf, statisticsSettled, type FrozenIntent, type IntentBook, type IntentEvent, type StatisticsRefreshView } from './intent.ts';

const ACCOUNT = '00000000-0000-4000-8000-0000000000a1';
const OTHER_ACCOUNT = '00000000-0000-4000-8000-0000000000a2';
const TARGET = '00000000-0000-4000-8000-0000000000b1';
const OTHER_TARGET = '00000000-0000-4000-8000-0000000000b2';
const KEY = '00000000-0000-4000-8000-0000000000c1';

const intent = (over: Partial<FrozenIntent> = {}): FrozenIntent => ({ accountId: ACCOUNT, key: KEY, targetUserId: TARGET, classification: 'test', reason: 'Synthetic account', baseRevision: '0', ...over });
const refresh = (over: Partial<StatisticsRefreshView> = {}): StatisticsRefreshView => ({ refreshId: '00000000-0000-4000-8000-0000000000d1', targetUserId: TARGET, acceptedRevision: '7', state: 'pending', snapshotId: null, failureCode: null, updatedAt: '2026-10-23T12:00:00.000Z', ...over });
const receipt = (over: Partial<CommandReceipt> = {}): CommandReceipt => ({ operation: 'classifyUser', key: KEY, state: 'NONE', retryable: false, expired: false, retryAfterSeconds: null, httpStatus: null, errorCode: null, conflict: null,
  resourceId: null, resourceVersion: null, currentVersion: null, completedAt: null, expiresAt: null, ...over } as CommandReceipt);
const run = (book: IntentBook, ...events: IntentEvent[]) => events.reduce(reduceIntents, book);
const scope = scopeOf(intent());
const target = (book: IntentBook, id = TARGET) => book.byTarget[id];
const unknownBook = () => run(emptyBook(ACCOUNT), { type: 'submit', intent: intent() }, { type: 'saveFailed', scope, kind: 'network', code: null, currentVersion: null });

describe('A01 unknown resolves only through the original intent receipt', () => {
  it('network failure becomes unknown whose only action is to query the receipt (never re-classify)', () => {
    const book = unknownBook();
    expect(target(book)).toMatchObject({ phase: 'unknown', reason: 'network' });
    expect([...allowedActions(target(book))]).toEqual(['queryReceipt']);
    // A second submit for the same target is refused while unknown, even with a new key.
    expect(run(book, { type: 'submit', intent: intent({ key: '00000000-0000-4000-8000-0000000000c9' }) })).toBe(book);
  });
  it('NONE and failed receipt reads keep the intent unknown; nothing implies success or failure', () => {
    let book = run(unknownBook(), { type: 'receipt', scope, receipt: receipt({ state: 'NONE' }) });
    expect(target(book)).toMatchObject({ phase: 'unknown', reason: 'none' });
    book = run(book, { type: 'receiptFailed', scope, kind: 'network' });
    expect(target(book)).toMatchObject({ phase: 'unknown', reason: 'read_failed' });
    book = run(book, { type: 'receiptFailed', scope, kind: 'signed_out' });
    expect(target(book)).toMatchObject({ phase: 'unknown', reason: 'reauth' });
    expect(statisticsSettled(book, '00000000-0000-4000-8000-0000000000e1')).toBe(false);
  });
  it('SUCCEEDED accepts with the receipt revision only when it names the frozen target', () => {
    const wrong = run(unknownBook(), { type: 'receipt', scope, receipt: receipt({ state: 'SUCCEEDED', resourceId: OTHER_TARGET, resourceVersion: '7' }) });
    expect(target(wrong)).toMatchObject({ phase: 'unknown', reason: 'read_failed' });
    const book = run(unknownBook(), { type: 'receipt', scope, receipt: receipt({ state: 'SUCCEEDED', resourceId: TARGET, resourceVersion: '7' }) });
    expect(target(book)).toMatchObject({ phase: 'accepted', acceptedRevision: '7', stats: { status: 'locating' } });
    expect([...allowedActions(target(book))]).toEqual(['locateStats']);
  });
  it('PENDING waits, REJECTED version conflict reloads, expired pending can never be resent', () => {
    expect(target(run(unknownBook(), { type: 'receipt', scope, receipt: receipt({ state: 'PENDING', retryAfterSeconds: 5 }) }))).toMatchObject({ phase: 'unknown', reason: 'pending', retryAfterSeconds: 5 });
    expect(target(run(unknownBook(), { type: 'receipt', scope, receipt: receipt({ state: 'REJECTED', httpStatus: 409, errorCode: 'VERSION_CONFLICT', conflict: 'VERSION', currentVersion: '9' }) }))).toMatchObject({ phase: 'conflict', currentVersion: '9' });
    expect(target(run(unknownBook(), { type: 'receipt', scope, receipt: receipt({ state: 'REJECTED', httpStatus: 409, errorCode: 'INTENT_IN_PROGRESS', conflict: 'IN_PROGRESS', retryAfterSeconds: 3 }) }))).toMatchObject({ phase: 'unknown', reason: 'pending' });
    const expired = run(unknownBook(), { type: 'receipt', scope, receipt: receipt({ state: 'PENDING', expired: true }) });
    expect(target(expired)).toMatchObject({ phase: 'rejected', reason: 'expired' });
    expect([...allowedActions(target(expired))]).toEqual(['reload']);
    expect(target(run(unknownBook(), { type: 'receipt', scope, receipt: receipt({ state: 'REJECTED', httpStatus: 404, errorCode: 'NOT_FOUND' }) }))).toMatchObject({ phase: 'rejected', reason: 'not_found' });
  });
  it('ignores a receipt for another operation or key', () => {
    const book = unknownBook();
    expect(run(book, { type: 'receipt', scope, receipt: receipt({ operation: 'updateMe', state: 'SUCCEEDED', resourceId: TARGET, resourceVersion: '7' }) })).toBe(book);
    expect(run(book, { type: 'receipt', scope, receipt: receipt({ key: '00000000-0000-4000-8000-0000000000c9', state: 'SUCCEEDED', resourceId: TARGET, resourceVersion: '7' }) })).toBe(book);
  });
});

describe('A02 frozen payload and late responses', () => {
  it('freezes payload/revision at submit; later draft edits cannot reach it', () => {
    const draft = { ...intent() };
    const book = run(emptyBook(ACCOUNT), { type: 'submit', intent: draft });
    draft.classification = 'staff';
    draft.baseRevision = '99';
    expect(target(book)!.intent).toMatchObject({ classification: 'test', baseRevision: '0' });
    expect(Object.isFrozen(target(book)!.intent)).toBe(true);
  });
  it('drops late responses after an account switch and never shows intents to another account', () => {
    const saving = run(emptyBook(ACCOUNT), { type: 'submit', intent: intent() });
    const switched = run(saving, { type: 'accountChanged', accountId: OTHER_ACCOUNT });
    expect(switched.byTarget).toEqual({});
    expect(run(switched, { type: 'saved', scope, revision: '7', statisticsRefresh: refresh() })).toBe(switched);
    expect(run(switched, { type: 'saveFailed', scope, kind: 'network', code: null, currentVersion: null })).toBe(switched);
    // Submitting in the name of the old account is refused too.
    expect(run(switched, { type: 'submit', intent: intent() })).toBe(switched);
  });
  it('keeps other targets independent and routes events by target+key', () => {
    const other = intent({ targetUserId: OTHER_TARGET, key: '00000000-0000-4000-8000-0000000000c2' });
    let book = run(emptyBook(ACCOUNT), { type: 'submit', intent: intent() }, { type: 'submit', intent: other });
    book = run(book, { type: 'saved', scope: scopeOf(other), revision: '8', statisticsRefresh: refresh({ targetUserId: OTHER_TARGET, acceptedRevision: '8' }) });
    expect(target(book)).toMatchObject({ phase: 'saving' });
    expect(target(book, OTHER_TARGET)).toMatchObject({ phase: 'accepted', acceptedRevision: '8' });
  });
});

describe('A03/A05 accepted classification: statistics only', () => {
  const accepted = () => run(emptyBook(ACCOUNT), { type: 'submit', intent: intent() }, { type: 'saved', scope, revision: '7', statisticsRefresh: refresh() });
  it('pending and failed statistics hide old statistics; failed offers statistics retry, not re-classify of the same intent', () => {
    let book = accepted();
    expect(target(book)).toMatchObject({ phase: 'accepted', stats: { status: 'pending' } });
    expect(statisticsSettled(book, '00000000-0000-4000-8000-0000000000e1')).toBe(false);
    expect(allowedActions(target(book)).has('submit')).toBe(false);
    book = run(book, { type: 'stats', scope, refresh: refresh({ state: 'failed', failureCode: 'SNAPSHOT_FAILED' }) });
    expect(allowedActions(target(book)).has('retryStats')).toBe(true);
    expect(statisticsSettled(book, '00000000-0000-4000-8000-0000000000e1')).toBe(false);
    book = run(book, { type: 'stats', scope, refresh: refresh({ state: 'ready', snapshotId: '00000000-0000-4000-8000-0000000000e1' }) });
    expect(target(book)).toMatchObject({ stats: { status: 'ready', refresh: { snapshotId: '00000000-0000-4000-8000-0000000000e1' } } });
    expect(statisticsSettled(book, '00000000-0000-4000-8000-0000000000e1')).toBe(true);
    // P10-R02: a ready job does not make an older selected snapshot current.
    expect(statisticsSettled(book, '00000000-0000-4000-8000-0000000000e0')).toBe(false);
    expect(statisticsSettled(book, null)).toBe(false);
  });
  it('rejects statistics for another user or another revision (no cross-user revision comparison)', () => {
    const book = accepted();
    expect(run(book, { type: 'stats', scope, refresh: refresh({ targetUserId: OTHER_TARGET, state: 'ready', snapshotId: '00000000-0000-4000-8000-0000000000e1' }) })).toBe(book);
    expect(run(book, { type: 'stats', scope, refresh: refresh({ acceptedRevision: '9', state: 'ready', snapshotId: '00000000-0000-4000-8000-0000000000e1' }) })).toBe(book);
    const located = run(emptyBook(ACCOUNT), { type: 'submit', intent: intent() }, { type: 'saved', scope, revision: '7', statisticsRefresh: refresh({ acceptedRevision: '6' }) });
    expect(target(located)).toMatchObject({ stats: { status: 'locating' } });
  });
  it('a failed statistics lookup keeps the last known state and flags it', () => {
    const book = run(accepted(), { type: 'statsFailed', scope });
    expect(target(book)).toMatchObject({ stats: { status: 'pending', lookupFailed: true } });
  });
  it('cannot dismiss an unsettled intent or unready statistics to re-show old numbers', () => {
    expect(run(unknownBook(), { type: 'dismiss', targetUserId: TARGET }).byTarget[TARGET]).toBeDefined();
    expect(run(accepted(), { type: 'dismiss', targetUserId: TARGET }).byTarget[TARGET]).toBeDefined();
    // Even ready, an accepted intent cannot be dismissed: only selecting its sealed snapshot settles it.
    const ready = run(accepted(), { type: 'stats', scope, refresh: refresh({ state: 'ready', snapshotId: '00000000-0000-4000-8000-0000000000e1' }) });
    expect(run(ready, { type: 'dismiss', targetUserId: TARGET }).byTarget[TARGET]).toBeDefined();
    const conflict = run(emptyBook(ACCOUNT), { type: 'submit', intent: intent() }, { type: 'saveFailed', scope, kind: 'conflict', code: 'VERSION_CONFLICT', currentVersion: '9' });
    expect(run(conflict, { type: 'dismiss', targetUserId: TARGET }).byTarget[TARGET]).toBeUndefined();
  });

  it('P10-R02: several targets unlock only when the selected snapshot seals every one of them', () => {
    const other = intent({ targetUserId: OTHER_TARGET, key: '00000000-0000-4000-8000-0000000000c2' });
    const S1 = '00000000-0000-4000-8000-0000000000e1', S2 = '00000000-0000-4000-8000-0000000000e2';
    let book = run(emptyBook(ACCOUNT), { type: 'submit', intent: intent() }, { type: 'saved', scope, revision: '7', statisticsRefresh: refresh({ state: 'ready', snapshotId: S1 }) },
      { type: 'submit', intent: other }, { type: 'saved', scope: scopeOf(other), revision: '8', statisticsRefresh: refresh({ targetUserId: OTHER_TARGET, acceptedRevision: '8' }) });
    expect(statisticsSettled(book, S1)).toBe(false); // second target still pending
    book = run(book, { type: 'stats', scope: scopeOf(other), refresh: refresh({ targetUserId: OTHER_TARGET, acceptedRevision: '8', state: 'ready', snapshotId: S2 }) });
    expect(statisticsSettled(book, S1)).toBe(false);
    expect(statisticsSettled(book, S2)).toBe(false); // first target not (yet) bound to S2
    book = run(book, { type: 'stats', scope, refresh: refresh({ state: 'ready', snapshotId: S2 }) }); // server re-bound it to the newest sealing snapshot
    expect(statisticsSettled(book, S2)).toBe(true);
  });
});

describe('save failures', () => {
  const failed = (kind: FailureKind, code: string | null, currentVersion: string | null = null) =>
    target(run(emptyBook(ACCOUNT), { type: 'submit', intent: intent() }, { type: 'saveFailed', scope, kind, code, currentVersion }));
  it('maps 409 classes, 401 and definite rejections without ever clearing via equal values', () => {
    expect(failed('conflict', 'VERSION_CONFLICT', '9')).toMatchObject({ phase: 'conflict', currentVersion: '9' });
    expect(failed('conflict', 'INTENT_IN_PROGRESS')).toMatchObject({ phase: 'unknown', reason: 'pending' });
    expect(failed('signed_out', 'AUTH_REQUIRED')).toMatchObject({ phase: 'unknown', reason: 'reauth' });
    expect(failed('unavailable', 'PROVIDER_UNAVAILABLE')).toMatchObject({ phase: 'unknown', reason: 'network' });
    expect(failed('forbidden', 'FORBIDDEN')).toMatchObject({ phase: 'rejected', reason: 'forbidden' });
    expect(failed('not_found', 'NOT_FOUND')).toMatchObject({ phase: 'rejected', reason: 'not_found' });
    expect(failed('invalid', 'VALIDATION_FAILED')).toMatchObject({ phase: 'rejected', reason: 'invalid' });
  });
});
