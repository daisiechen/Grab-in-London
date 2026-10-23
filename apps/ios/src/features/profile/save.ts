import { ApiError, IntentTracker, IntentUnresolvedError, type ApiClient } from '@fancy/client';
import type { Me, SessionManager } from '../auth/session.ts';
import { StaleSessionError } from '../auth/session.ts';
import { serverFieldMessage, type MePatch, type ProfileField } from './model.ts';

export type SaveResult =
  | { kind: 'saved'; me: Me }
  | { kind: 'conflict'; me: Me | null; message: string }
  | { kind: 'invalid'; field: ProfileField | null; message: string }
  | { kind: 'failed'; message: string; retryable: boolean }
  /** No confirmed result: the original key+body are kept; checkStatus() reads the P03 receipt. */
  | { kind: 'unknown'; message: string };

const UNKNOWN = 'Status unknown: we couldn’t confirm whether your profile saved. Your changes are kept. Check status before saving again.';

/**
 * One user intent = one Idempotency-Key. Retrying the same body reuses the key; any edit to the body
 * starts a new intent (API §1: a different body with the same key would be a 409).
 */
export class ProfileSaver {
  private readonly tracker: IntentTracker;
  private original: { patch: MePatch; version: string } | null = null;
  private readonly api: ApiClient;
  private readonly session: SessionManager;

  constructor(api: ApiClient, session: SessionManager, newId: () => string) {
    this.api = api;
    this.session = session;
    this.tracker = new IntentTracker(newId);
  }

  /** Session end / unmount: drop the intent and fence outstanding continuations. */
  reset(): void { this.tracker.reset(); this.original = null; }

  private stale(generation: number): SaveResult | null {
    return generation === this.tracker.generation ? null : { kind: 'failed', message: 'You’ve been signed out.', retryable: false };
  }

  /** True while an earlier save has no confirmed result. */
  get unresolved(): boolean { return this.tracker.pending !== null; }

  async save(patch: MePatch, version: string): Promise<SaveResult> {
    const generation = this.tracker.generation;
    try {
      const res = await this.tracker.run({ patch, version }, (idempotencyKey) => {
        this.original = { patch, version };
        return this.api.call('updateMe', { body: patch, idempotencyKey, ifMatch: version });
      });
      const stale = this.stale(generation);
      if (stale) return stale;
      this.session.updateUser(res.data);
      return { kind: 'saved', me: res.data };
    } catch (error) {
      const stale = this.stale(generation);
      if (stale) return stale;
      if (error instanceof IntentUnresolvedError) return { kind: 'unknown', message: 'Your earlier save hasn’t been confirmed yet. Check status before saving changes.' };
      if (error instanceof StaleSessionError) { this.tracker.reset(); return { kind: 'failed', message: 'You’ve been signed out.', retryable: false }; }
      if (this.tracker.pending) return { kind: 'unknown', message: UNKNOWN };
      if (!(error instanceof ApiError)) return { kind: 'failed', message: 'Something went wrong. Please try again.', retryable: true };
      if (error.code === 'VERSION_CONFLICT') return this.conflict();
      if (error.kind === 'validation') return { kind: 'invalid', ...serverFieldMessage(error.fieldErrors) };
      return { kind: 'failed', message: 'We couldn’t save your profile. Please try again.', retryable: error.retryable };
    }
  }

  /** Reads the original intent's receipt; equal current values never count as success. */
  async checkStatus(): Promise<SaveResult> {
    const generation = this.tracker.generation;
    const outcome = await this.tracker.reconcile(this.api, 'updateMe');
    const stale = this.stale(generation);
    if (stale) return stale;
    if (outcome === 'saved') {
      try { const me = (await this.api.call('getMe', {})).data; if (this.stale(generation)) return this.stale(generation)!; this.session.updateUser(me); return { kind: 'saved', me }; }
      catch { return { kind: 'failed', message: 'Your profile saved, but we couldn’t refresh it. Pull to refresh.', retryable: true }; }
    }
    if (outcome === 'resend' && this.original) return this.save(this.original.patch, this.original.version);
    if (outcome === 'conflict' || outcome === 'expired') return this.conflict();
    if (outcome === 'rejected') return { kind: 'failed', message: 'That save wasn’t accepted. Your changes are kept.', retryable: false };
    return { kind: 'unknown', message: 'Still no confirmed result. Your changes are kept; check again shortly.' };
  }

  private async conflict(): Promise<SaveResult> {
    let me: Me | null;
    try {
      me = (await this.api.call('getMe', {})).data;
      this.session.updateUser(me);
    } catch {
      me = null;
    }
    return { kind: 'conflict', me, message: 'Your profile changed on another device. Review your details and save again.' };
  }
}
