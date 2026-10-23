/**
 * PATCH-004 combined post-meal feedback (PRD0.6 §5.3, plan §4, Figma 565:32381–32383).
 * Pure planner + framework-free runner shared by Web and iOS. One `Save feedback` writes only
 * dirty items, serially (public reference first, then reconnect choice or revoke), each with its
 * own Idempotency-Key, If-Match and canonical payload. A failure, 409 or unknown result pauses
 * the later item; saved items are never rolled back or resent. Late results are recorded under
 * their original scope (account+meal+subject) and never touch another scope's state.
 */
import { newIntentKey } from './http.ts';
import { outcomeFromError, reconcileIntent, type IntentOutcome } from './intents.ts';
import type { ApiClient } from './http.ts';

export type FeedbackItem = 'review' | 'reconnect';
export type ItemStatus = 'idle' | 'skipped' | 'saving' | 'saved' | 'notSavedYet' | 'failed' | 'unknown' | 'conflict';

/** Latest authoritative snapshot for one (meal, subject) pair as read from postMealState. */
export interface FeedbackSnapshot {
  windowOpen: boolean;
  review: { body: string; version: string } | null;
  reconnect: { selected: boolean; version: string; connection: string };
}
export interface FeedbackDraft { review: string; selected: boolean }

export type FeedbackStep =
  | { item: 'review'; operation: 'reviewPerson'; body: string; ifMatch: string }
  | { item: 'reconnect'; operation: 'selectReconnect'; selected: boolean; ifMatch: string }
  | { item: 'reconnect'; operation: 'revokeConnection'; ifMatch: string };

export type FeedbackPlan =
  | { kind: 'noChanges' }
  | { kind: 'invalid'; item: FeedbackItem; reason: 'emptyOverwrite' | 'tooLong' | 'windowClosed' }
  | { kind: 'save'; steps: FeedbackStep[]; confirmRevoke: boolean; skipped: FeedbackItem[] };

export const REVIEW_MAX = 500;

/**
 * Dirty check against the authoritative snapshot (trimmed body, boolean choice). Empty first
 * reference is a skip; clearing an existing reference is refused (never an implicit delete).
 * Unselecting an OPEN connection becomes a confirmed revoke, which has no post-meal window gate.
 */
export function planFeedback(snapshot: FeedbackSnapshot, draft: FeedbackDraft): FeedbackPlan {
  const body = draft.review.trim();
  const steps: FeedbackStep[] = [];
  const skipped: FeedbackItem[] = [];
  const previousBody = snapshot.review?.body.trim() ?? '';
  if (body === previousBody) skipped.push('review');
  else if (!body) return { kind: 'invalid', item: 'review', reason: 'emptyOverwrite' };
  else if (body.length > REVIEW_MAX) return { kind: 'invalid', item: 'review', reason: 'tooLong' };
  else steps.push({ item: 'review', operation: 'reviewPerson', body, ifMatch: snapshot.review?.version ?? '0' });

  let confirmRevoke = false;
  if (draft.selected === snapshot.reconnect.selected) skipped.push('reconnect');
  else if (!draft.selected && snapshot.reconnect.connection === 'OPEN') {
    confirmRevoke = true;
    steps.push({ item: 'reconnect', operation: 'revokeConnection', ifMatch: snapshot.reconnect.version });
  } else steps.push({ item: 'reconnect', operation: 'selectReconnect', selected: draft.selected, ifMatch: snapshot.reconnect.version });

  if (!steps.length) return { kind: 'noChanges' };
  // A closed window blocks only window-gated writes. A revoke-only save stays allowed (C004-C);
  // a dirty reference in a closed window still enters the serial run and fails there first.
  if (!snapshot.windowOpen && steps.every((s) => s.operation === 'selectReconnect')) return { kind: 'invalid', item: 'reconnect', reason: 'windowClosed' };
  return { kind: 'save', steps, confirmRevoke, skipped };
}

/** One pending write intent, kept with its exact request so an unknown result can be replayed. */
/** `issuedAt` (client ms) is the age proof that lets a receipt NONE mean "never recorded". */
export interface PendingIntent { step: FeedbackStep; key: string; issuedAt: number }

export interface ScopeState {
  statuses: Record<FeedbackItem, ItemStatus>;
  /** Per-item intent awaiting a definite outcome (unknown/failed-retryable). */
  pending: Partial<Record<FeedbackItem, PendingIntent>>;
  /** Steps not yet executed because an earlier item paused the run. */
  queued: FeedbackStep[];
  running: boolean;
  errorCode: string | null;
}

const fresh = (): ScopeState => ({ statuses: { review: 'idle', reconnect: 'idle' }, pending: {}, queued: [], running: false, errorCode: null });

export interface FeedbackScope { accountId: string; mealId: string; subjectId: string }
export const scopeKey = (s: FeedbackScope) => `${s.accountId}:${s.mealId}:${s.subjectId}`;

export type StepExecutor = (scope: FeedbackScope, step: FeedbackStep, key: string) => Promise<unknown>;
/** Reads the original intent's receipt (P03); defaults to `unknown` when not provided. */
export type Reconciler = (scope: FeedbackScope, operation: FeedbackStep['operation'], key: string, issuedAt: number) => Promise<IntentOutcome>;

/** Maps a write outcome to the item status shown in the UI. */
export function statusFor(outcome: IntentOutcome): ItemStatus {
  switch (outcome) {
    case 'saved': return 'saved';
    case 'conflict': case 'expired': return 'conflict';
    case 'rejected': return 'failed';
    default: return 'unknown';
  }
}

/** Receipt reconciler over the generated client (GET /me/command-receipts). */
export const receiptReconciler = (client: ApiClient, now: () => number = Date.now): Reconciler => async (_scope, operation, key, issuedAt) => (await reconcileIntent(client, operation, key, issuedAt, now)).outcome;

/**
 * Holds per-scope state in memory only (cleared on account change: no local copy of receipts or
 * drafts survives a switch). `onChange` fires with the scope key so a page re-renders only when
 * the change belongs to the scope it currently shows.
 */
export class FeedbackRunner {
  private readonly scopes = new Map<string, ScopeState>();
  /** Bumped by clear(): continuations started before an account clearance can never write back. */
  private generation = 0;
  private readonly execute: StepExecutor;
  private readonly reconcile: Reconciler;
  private readonly onChange: (key: string) => void;

  private readonly now: () => number;

  constructor(execute: StepExecutor, onChange: (key: string) => void, reconcile: Reconciler = async () => 'unknown', now: () => number = Date.now) {
    this.now = now;
    this.execute = execute;
    this.onChange = onChange;
    this.reconcile = reconcile;
  }

  state(scope: FeedbackScope): ScopeState {
    return this.scopes.get(scopeKey(scope)) ?? fresh();
  }

  /** True while an earlier intent of this scope has no definite outcome. */
  unresolved(scope: FeedbackScope): boolean {
    const s = this.state(scope);
    return Object.values(s.pending).some(Boolean);
  }

  /** Account switch / sign-out: drop every scope (late results then have nowhere to land). */
  clear(): void { this.generation++; this.scopes.clear(); }

  private update(scope: FeedbackScope, change: (s: ScopeState) => void, generation = this.generation) {
    if (generation !== this.generation) return;
    const key = scopeKey(scope);
    const next = structuredClone(this.scopes.get(key) ?? fresh());
    change(next);
    this.scopes.set(key, next);
    this.onChange(key);
  }

  /**
   * Runs a fresh plan from the latest snapshot. While an earlier intent is unresolved the plan is
   * not used: the original intent is reconciled/replayed first (a newer draft is never merged into
   * it, and an equal current value never marks it saved).
   */
  async save(scope: FeedbackScope, plan: Extract<FeedbackPlan, { kind: 'save' }>): Promise<ScopeState> {
    if (this.state(scope).running) return this.state(scope);
    if (this.unresolved(scope)) return this.resume(scope);
    this.update(scope, (s) => {
      s.errorCode = null;
      s.statuses = { review: 'idle', reconnect: 'idle' };
      for (const item of plan.skipped) s.statuses[item] = 'skipped';
      for (const step of plan.steps) s.statuses[step.item] = 'notSavedYet';
      s.queued = plan.steps;
    });
    return this.drain(scope);
  }

  /** Retry: reconcile unknown intents via receipts, then continue only unfinished steps. */
  async resume(scope: FeedbackScope): Promise<ScopeState> {
    if (this.state(scope).running) return this.state(scope);
    const generation = this.generation;
    for (const item of ['review', 'reconnect'] as const) {
      const p = this.state(scope).pending[item];
      if (!p) continue;
      const outcome = await this.reconcile(scope, p.step.operation, p.key, p.issuedAt);
      if (generation !== this.generation) return this.state(scope);
      if (outcome === 'resend') continue; // drain() resends the identical request with the same key
      if (outcome === 'saved' || outcome === 'conflict' || outcome === 'expired' || outcome === 'rejected') {
        this.update(scope, (n) => { n.statuses[item] = statusFor(outcome); delete n.pending[item]; });
        if (outcome !== 'saved') return this.state(scope);
        continue;
      }
      // pending / unknown / reauth: still unresolved, later items stay Not saved yet.
      this.update(scope, (n) => { n.statuses[item] = 'unknown'; });
      return this.state(scope);
    }
    return this.drain(scope);
  }

  private async drain(scope: FeedbackScope): Promise<ScopeState> {
    const generation = this.generation;
    this.update(scope, (s) => { s.running = true; });
    try {
      for (;;) {
        if (generation !== this.generation) break;
        const s = this.state(scope);
        const replay = (['review', 'reconnect'] as const).map((i) => s.pending[i]).find(Boolean);
        const step = replay?.step ?? s.queued[0];
        if (!step) break;
        const key = replay?.key ?? newIntentKey();
        const issuedAt = replay?.issuedAt ?? this.now();
        this.update(scope, (n) => {
          n.statuses[step.item] = 'saving';
          n.pending[step.item] = { step, key, issuedAt };
          n.queued = n.queued.filter((q) => q.item !== step.item);
        }, generation);
        try {
          await this.execute(scope, step, key);
          this.update(scope, (n) => { n.statuses[step.item] = 'saved'; delete n.pending[step.item]; }, generation);
        } catch (error) {
          const status = statusFor(outcomeFromError(error));
          const code = typeof error === 'object' && error && 'code' in error ? String((error as { code: unknown }).code) : null;
          this.update(scope, (n) => {
            n.statuses[step.item] = status;
            n.errorCode = code;
            // Definite results end the intent; unknown keeps key+body for replay/receipt checks.
            if (status !== 'unknown') delete n.pending[step.item];
          }, generation);
          break;
        }
      }
    } finally {
      this.update(scope, (s) => { s.running = false; }, generation);
    }
    return this.state(scope);
  }
}
