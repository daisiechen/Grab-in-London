import { ApiError, type ApiClient } from '@fancy/client';
import type { Me, SessionManager } from '../auth/session.ts';
import { StaleSessionError } from '../auth/session.ts';
import { serverFieldMessage, type MePatch, type ProfileField } from './model.ts';

export type SaveResult =
  | { kind: 'saved'; me: Me }
  | { kind: 'conflict'; me: Me | null; message: string }
  | { kind: 'invalid'; field: ProfileField | null; message: string }
  | { kind: 'failed'; message: string; retryable: boolean };

/**
 * One user intent = one Idempotency-Key. Retrying the same body reuses the key; any edit to the body
 * starts a new intent (API §1: a different body with the same key would be a 409).
 */
export class ProfileSaver {
  private intent: { key: string; body: string } | null = null;
  private readonly api: ApiClient;
  private readonly session: SessionManager;
  private readonly newId: () => string;

  constructor(api: ApiClient, session: SessionManager, newId: () => string) {
    this.api = api;
    this.session = session;
    this.newId = newId;
  }

  keyFor(patch: MePatch): string {
    const body = JSON.stringify(patch);
    if (!this.intent || this.intent.body !== body) this.intent = { key: this.newId(), body };
    return this.intent.key;
  }

  async save(patch: MePatch, version: string): Promise<SaveResult> {
    const idempotencyKey = this.keyFor(patch);
    try {
      const res = await this.api.call('updateMe', { body: patch, idempotencyKey, ifMatch: version });
      this.intent = null;
      this.session.updateUser(res.data);
      return { kind: 'saved', me: res.data };
    } catch (error) {
      if (error instanceof StaleSessionError) return { kind: 'failed', message: 'You’ve been signed out.', retryable: false };
      if (!(error instanceof ApiError)) return { kind: 'failed', message: 'Something went wrong. Please try again.', retryable: true };
      if (error.code === 'VERSION_CONFLICT') {
        this.intent = null;
        let me: Me | null;
        try {
          me = (await this.api.call('getMe', {})).data;
          this.session.updateUser(me);
        } catch {
          me = null;
        }
        return { kind: 'conflict', me, message: 'Your profile changed on another device. Review your details and save again.' };
      }
      if (error.kind === 'validation') return { kind: 'invalid', ...serverFieldMessage(error.fieldErrors) };
      if (error.kind === 'network') return { kind: 'failed', message: 'You appear to be offline. Your changes are still here — try again when connected.', retryable: true };
      if (error.kind === 'auth') return { kind: 'failed', message: 'Please sign in again to save your profile.', retryable: false };
      return { kind: 'failed', message: 'We couldn’t save your profile. Please try again.', retryable: error.retryable };
    }
  }
}
