import { describe, expect, it } from 'vitest';
import { ApiError } from './errors.ts';
import { FeedbackRunner, planFeedback, scopeKey, type FeedbackScope, type FeedbackSnapshot, type FeedbackStep } from './feedback.ts';
import type { IntentOutcome } from './intents.ts';

const snap = (o: Partial<FeedbackSnapshot> = {}): FeedbackSnapshot => ({
  windowOpen: true, review: null, reconnect: { selected: false, version: '0', connection: 'CLOSED' }, ...o,
});
const A: FeedbackScope = { accountId: 'acct', mealId: 'meal', subjectId: 'subj-a' };
const B: FeedbackScope = { ...A, subjectId: 'subj-b' };
const err = (status: number, code: ConstructorParameters<typeof ApiError>[0]['code']) => new ApiError({ status, code, message: code });

function harness(outcomes: Array<'ok' | Error>, reconcile: IntentOutcome[] = []) {
  const calls: Array<{ scope: string; step: FeedbackStep; key: string }> = [];
  const changes: string[] = [];
  const runner = new FeedbackRunner(
    async (scope, step, key) => { calls.push({ scope: scopeKey(scope), step, key }); const next = outcomes.shift() ?? 'ok'; if (next !== 'ok') throw next; },
    (key) => changes.push(key),
    async () => reconcile.shift() ?? 'unknown',
  );
  return { runner, calls, changes };
}

describe('planFeedback (AC-004a)', () => {
  it('empty first reference and unchanged choice is No changes, with zero writes', () => {
    expect(planFeedback(snap(), { review: '   ', selected: false })).toEqual({ kind: 'noChanges' });
    expect(planFeedback(snap({ review: { body: 'Lovely evening', version: '2' } }), { review: ' Lovely evening ', selected: false })).toEqual({ kind: 'noChanges' });
  });
  it('refuses to clear an existing reference instead of deleting it', () => {
    expect(planFeedback(snap({ review: { body: 'Lovely evening', version: '2' } }), { review: '', selected: false })).toMatchObject({ kind: 'invalid', reason: 'emptyOverwrite' });
  });
  it('unselecting a waiting choice is an explicit false write, not no-change', () => {
    const plan = planFeedback(snap({ reconnect: { selected: true, version: '3', connection: 'WAITING' } }), { review: '', selected: false });
    expect(plan).toMatchObject({ kind: 'save', confirmRevoke: false, steps: [{ operation: 'selectReconnect', selected: false, ifMatch: '3' }], skipped: ['review'] });
  });
  it('orders reference first and turns OPEN cancel into a confirmed revoke', () => {
    const plan = planFeedback(snap({ reconnect: { selected: true, version: '4', connection: 'OPEN' } }), { review: ' Kind company ', selected: false });
    expect(plan).toMatchObject({ kind: 'save', confirmRevoke: true, steps: [{ operation: 'reviewPerson', body: 'Kind company', ifMatch: '0' }, { operation: 'revokeConnection', ifMatch: '4' }] });
  });
  it('allows a revoke-only save after the window closed, but not a choice write (AC-004d)', () => {
    expect(planFeedback(snap({ windowOpen: false, reconnect: { selected: true, version: '4', connection: 'OPEN' } }), { review: '', selected: false })).toMatchObject({ kind: 'save', confirmRevoke: true });
    expect(planFeedback(snap({ windowOpen: false }), { review: '', selected: true })).toMatchObject({ kind: 'invalid', reason: 'windowClosed' });
    // A dirty reference in a closed window still enters the run and fails there first.
    expect(planFeedback(snap({ windowOpen: false, reconnect: { selected: true, version: '4', connection: 'OPEN' } }), { review: 'Late words', selected: false })).toMatchObject({ kind: 'save', steps: [{ operation: 'reviewPerson' }, { operation: 'revokeConnection' }] });
  });
  it('rejects over-long references', () => {
    expect(planFeedback(snap(), { review: 'x'.repeat(501), selected: false })).toMatchObject({ kind: 'invalid', reason: 'tooLong' });
  });
});

describe('FeedbackRunner serial partial results (AC-004b/c)', () => {
  const both = planFeedback(snap(), { review: 'Kind company', selected: true });
  if (both.kind !== 'save') throw new Error('plan');

  it('saves both items in order with distinct keys', async () => {
    const { runner, calls } = harness(['ok', 'ok']);
    const s = await runner.save(A, both);
    expect(calls.map((c) => c.step.operation)).toEqual(['reviewPerson', 'selectReconnect']);
    expect(new Set(calls.map((c) => c.key)).size).toBe(2);
    expect(s.statuses).toEqual({ review: 'saved', reconnect: 'saved' });
  });

  it('reference saved + reconnect failed is a partial result, never all-saved', async () => {
    const { runner } = harness(['ok', err(409, 'STATE_CONFLICT')]);
    const s = await runner.save(A, both);
    expect(s.statuses).toEqual({ review: 'saved', reconnect: 'failed' });
    expect(s.errorCode).toBe('STATE_CONFLICT');
  });

  it('first item failure, unknown or 409 pauses the later item as Not saved yet', async () => {
    for (const [e, status] of [[err(403, 'FORBIDDEN'), 'failed'], [err(0, 'NETWORK_ERROR'), 'unknown'], [err(409, 'VERSION_CONFLICT'), 'conflict']] as const) {
      const { runner, calls } = harness([e]);
      const s = await runner.save(A, both);
      expect(calls).toHaveLength(1);
      expect(s.statuses).toEqual({ review: status, reconnect: 'notSavedYet' });
    }
  });

  it('unknown keeps the original key/body; retry replays it, never resends the saved item', async () => {
    const { runner, calls } = harness(['ok', err(503, 'SERVICE_UNAVAILABLE'), 'ok'], ['resend']);
    await runner.save(A, both);
    expect(runner.state(A).statuses).toEqual({ review: 'saved', reconnect: 'unknown' });
    const s = await runner.resume(A);
    expect(calls.map((c) => c.step.operation)).toEqual(['reviewPerson', 'selectReconnect', 'selectReconnect']);
    expect(calls[2]!.key).toBe(calls[1]!.key);
    expect(s.statuses.reconnect).toBe('saved');
  });

  it('a receipt SUCCEEDED clears unknown without writing again and then continues queued items', async () => {
    const { runner, calls } = harness([err(0, 'NETWORK_ERROR'), 'ok'], ['saved']);
    await runner.save(A, both);
    const s = await runner.resume(A);
    expect(calls.map((c) => c.step.operation)).toEqual(['reviewPerson', 'selectReconnect']);
    expect(s.statuses).toEqual({ review: 'saved', reconnect: 'saved' });
  });

  it('an unresolved receipt keeps the run paused; a newer plan is not merged into the original intent', async () => {
    const { runner, calls } = harness([err(0, 'NETWORK_ERROR')], ['pending', 'unknown']);
    await runner.save(A, both);
    expect((await runner.resume(A)).statuses).toEqual({ review: 'unknown', reconnect: 'notSavedYet' });
    const edited = planFeedback(snap(), { review: 'Edited later', selected: true });
    if (edited.kind !== 'save') throw new Error('plan');
    await runner.save(A, edited);
    expect(calls).toHaveLength(1);
    expect(runner.state(A).pending.review?.step).toMatchObject({ body: 'Kind company' });
  });

  it('late results stay in their original scope (object isolation)', async () => {
    let release!: () => void;
    const changes: string[] = [];
    const runner = new FeedbackRunner(async () => { await new Promise<void>((r) => { release = r; }); }, (k) => changes.push(k));
    const run = runner.save(A, both);
    expect(runner.state(B).statuses).toEqual({ review: 'idle', reconnect: 'idle' });
    release();
    await new Promise((r) => setTimeout(r, 0));
    release();
    await run;
    expect(runner.state(A).statuses.review).toBe('saved');
    expect(runner.state(B).statuses).toEqual({ review: 'idle', reconnect: 'idle' });
    expect(changes.every((k) => k === scopeKey(A))).toBe(true);
  });

  it('a write finishing after clear() cannot resurrect the cleared scope', async () => {
    let finish!: () => void;
    const runner = new FeedbackRunner(() => new Promise<void>((r) => { finish = r; }), () => {});
    const saving = runner.save(A, both);
    runner.clear(); finish(); await saving;
    expect(runner.state(A).statuses.review).toBe('idle');
    expect(runner.unresolved(A)).toBe(false);
  });

  it('account switch clears every scope', async () => {
    const { runner } = harness([err(0, 'NETWORK_ERROR')]);
    await runner.save(A, both);
    runner.clear();
    expect(runner.unresolved(A)).toBe(false);
  });
});
