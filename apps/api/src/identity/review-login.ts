/**
 * App Store review sign-in (app-store-submission §7, option A, Owner approval 2026-11-04).
 *
 * Only when `config.reviewLogin` is set (REVIEW_LOGIN_ENABLED=1, one exact email, scrypt hash of a
 * 6-digit code) and the normalised email equals that address exactly: starting a code does not
 * call the identity provider, and verifying compares the code with the hash in constant time.
 * Everything else — challenge rows, resend wait, per-email/per-IP quotas, the 5-attempt cap,
 * re-authentication — is the ordinary email-code flow in routes.ts. Every other email, and this
 * one while the switch is off, goes to the provider exactly as before.
 *
 * The identity is local and stable: issuer `urn:fancy:app-review`, subject `review|<email>`. The
 * first sign-in creates the account like any sign-up; every sign-in keeps the account classified
 * `test` (never counted in metrics), writes an `auth.review_signin` audit row and queues a
 * `review_signin` notice to SUPPORT_EMAIL (no code, no address in it).
 */
import { setTimeout as sleep } from 'node:timers/promises';
import { randomInt } from 'node:crypto';
import { appendAudit, enqueueOutbox } from '@fancy/db';
import { verifyReviewCode, type CoreConfig } from '@fancy/config';
import type { Tx } from '../common/transaction.ts';
import type { VerifiedIdentity } from './provider.ts';

export const REVIEW_ISSUER = 'urn:fancy:app-review';
export const reviewSubject = (email: string) => `review|${email}`;
/** Marker the server writes into provider_state; never taken from a request. */
export const REVIEW_STATE = { review: '1' } as const;
export const REVIEW_CLASSIFICATION_REASON = 'App Store review account (classified automatically at review sign-in)';

export const isReviewEmail = (config: CoreConfig, email: string): boolean =>
  config.reviewLogin !== null && email === config.reviewLogin.email;

/**
 * Stands in for the provider's "send code" call. Deployed environments wait about as long as a
 * provider round trip so the response timing does not single out the review address.
 */
export async function startReviewOtp(config: CoreConfig): Promise<Record<string, string>> {
  if (config.environment === 'production' || config.environment === 'staging') await sleep(randomInt(250, 650));
  return { ...REVIEW_STATE };
}

/** Null for a wrong code, a challenge not started as a review challenge, or a switched-off login. */
export async function verifyReviewOtp(config: CoreConfig, email: string, code: string, providerState: Record<string, string>): Promise<VerifiedIdentity | null> {
  if (providerState.review !== REVIEW_STATE.review || !config.reviewLogin || !isReviewEmail(config, email)) return null;
  if (!(await verifyReviewCode(code, config.reviewLogin.codeHash))) return null;
  return { issuer: REVIEW_ISSUER, subject: reviewSubject(email), provider: 'EMAIL', email, emailVerified: true, amr: ['otp'] };
}

export const isReviewIdentity = (identity: VerifiedIdentity) => identity.issuer === REVIEW_ISSUER;

/**
 * Runs inside the sign-in transaction: keeps the account `test`, audits the sign-in and queues the
 * Owner notice (keyed by the auth transaction, so one notice per sign-in).
 */
export async function recordReviewSignIn(tx: Tx, config: CoreConfig, o: { userId: string; authTxId: string; purpose: 'LOGIN' | 'REAUTH'; client: string; created: boolean }): Promise<void> {
  const { rows: [latest] } = await tx.client.query<{ classification: string }>(
    `SELECT classification FROM account_classifications WHERE user_id = $1 ORDER BY revision DESC LIMIT 1`, [o.userId]);
  if (latest?.classification !== 'test') {
    const { rows: [inserted] } = await tx.client.query<{ revision: string }>(
      `INSERT INTO account_classifications (user_id, classification, actor_id, reason) VALUES ($1, 'test', $1, $2) RETURNING revision::text`,
      [o.userId, REVIEW_CLASSIFICATION_REASON]);
    await appendAudit(tx.client, { actorKind: 'SYSTEM', actorId: null, action: 'account.classified', aggregateType: 'user', aggregateId: o.userId, reason: REVIEW_CLASSIFICATION_REASON, payload: { classification: 'test', revision: inserted!.revision } });
  }
  await appendAudit(tx.client, { actorKind: 'USER', actorId: o.userId, action: 'auth.review_signin', aggregateType: 'user', aggregateId: o.userId, payload: { purpose: o.purpose, client: o.client, created: o.created } });
  if (config.supportEmail) await enqueueOutbox(tx.client, { eventId: o.authTxId, recipientId: null, channel: 'EMAIL', template: 'review_signin' });
}
