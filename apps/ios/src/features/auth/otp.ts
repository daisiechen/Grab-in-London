import { ApiError, type ApiClient } from '@fancy/client';
import type { AppChallengePair } from './pkce.ts';
import { StaleSessionError, type SessionManager } from './session.ts';
import { authErrorMessage } from './messages.ts';
import { IOS_SIGNUP_SOURCE, type SignInResult } from './oauth.ts';

export interface Challenge {
  challengeId: string;
  email: string;
  expiresAt: number;
  resendAfter: number;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateEmail(email: string): string | null {
  const v = email.trim();
  return v.length > 0 && v.length <= 320 && EMAIL.test(v) ? null : 'Enter a valid email address.';
}

export function validateCode(code: string): string | null {
  return /^[0-9]{6}$/.test(code) ? null : 'Enter the six-digit code.';
}

export async function startEmailChallenge(api: ApiClient, email: string, newId: () => string): Promise<{ ok: true; challenge: Challenge } | { ok: false; message: string; retryAfterSeconds?: number }> {
  const invalid = validateEmail(email);
  if (invalid) return { ok: false, message: invalid };
  try {
    const res = await api.call('startEmail', { body: { clientRequestId: newId(), email: email.trim(), client: 'IOS', signupSource: IOS_SIGNUP_SOURCE } });
    return { ok: true, challenge: { challengeId: res.data.challengeId, email: email.trim(), expiresAt: Date.parse(res.data.expiresAt), resendAfter: Date.parse(res.data.resendAfter) } };
  } catch (error) {
    if (error instanceof ApiError && error.kind === 'validation') return { ok: false, message: 'Enter a valid email address.' };
    // A rate limit carries its wait so the screen can count it down live.
    if (error instanceof ApiError && error.kind === 'rate_limit' && error.retryAfterSeconds) return { ok: false, message: authErrorMessage(error), retryAfterSeconds: error.retryAfterSeconds };
    return { ok: false, message: authErrorMessage(error) };
  }
}

/** Copy for verifyEmail rejections; the server owns attempt limits and one-time consumption. */
export function otpErrorMessage(error: unknown): { message: string; restart: boolean } {
  if (error instanceof ApiError) {
    if (error.code === 'NOT_FOUND' || error.kind === 'gone') return { message: 'This code has expired. Request a new code.', restart: true };
    if (error.code === 'STATE_CONFLICT') return { message: 'This code can no longer be used. Request a new code.', restart: true };
    if (error.kind === 'validation') return { message: 'That code doesn’t match. Check the six digits and try again.', restart: false };
  }
  return { message: authErrorMessage(error), restart: false };
}

export async function verifyEmailCode(
  deps: { api: ApiClient; session: SessionManager; createChallenge: () => Promise<AppChallengePair>; newId: () => string },
  challenge: Challenge,
  code: string,
  now: number = Date.now(),
): Promise<SignInResult | { kind: 'retry'; message: string; restart: boolean }> {
  const invalid = validateCode(code);
  if (invalid) return { kind: 'retry', message: invalid, restart: false };
  if (now >= challenge.expiresAt) return { kind: 'retry', message: 'This code has expired. Request a new code.', restart: true };
  const generation=deps.session.generation;
  try {
    const pair = await deps.createChallenge();
    deps.session.assertGeneration(generation);
    const res = await deps.api.call('verifyEmail', { body: { clientRequestId: deps.newId(), challengeId: challenge.challengeId, code, appChallenge: pair.challenge } });
    deps.session.assertGeneration(generation);
    const outcome = res.data;
    if (outcome.outcome === 'LINK_REQUIRED') return { kind: 'linkRequired', linkTicket: outcome.linkTicket, expiresAt: outcome.expiresAt, appVerifier:pair.verifier };
    if (!outcome.handoffCode) return { kind: 'failed', message: 'Sign-in didn’t finish. Please try again.' };
    const session = await deps.session.completeHandoff(outcome.handoffCode, pair.verifier);
    return { kind: 'signedIn', session, authProof:outcome.authProof };
  } catch (error) {
    if (error instanceof StaleSessionError) return { kind: 'cancelled' };
    // A lost response after the server consumed the code cannot be replayed (API §7): the server
    // answers STATE_CONFLICT and the user requests a new code instead of reusing a token.
    return { kind: 'retry', ...otpErrorMessage(error) };
  }
}
