/**
 * App Store review sign-in (app-store-submission §7 option A): one exact address, hashed code, no
 * provider call; ordinary quotas and attempt cap; account kept `test`; audit + support notice.
 */
import { randomInt, randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, inject, it, vi } from 'vitest';
import { hashReviewCode } from '@fancy/config';
import { Browser, createHarness, json, type Harness } from '../test/harness.ts';
import { TEST_ISSUER } from './test-provider.ts';
import { REVIEW_ISSUER } from './review-login.ts';
import { pkceChallenge, randomToken } from './tokens.ts';

const REVIEW_EMAIL = 'appreview@example.invalid';
const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
const wrongCode = code === '000000' ? '111111' : '000000';
const reviewEnv = (enabled: '0' | '1') => ({
  REVIEW_LOGIN_ENABLED: enabled, REVIEW_ACCOUNT_EMAIL: REVIEW_EMAIL, REVIEW_ACCOUNT_CODE_HASH: hashReviewCode(code), SUPPORT_EMAIL: 'support@example.invalid',
});

let on: Harness;
let off: Harness;
beforeAll(async () => {
  on = await createHarness(inject('pgServerUrl'), undefined, reviewEnv('1'));
  off = await createHarness(inject('pgServerUrl'), undefined, reviewEnv('0'));
});
afterAll(async () => { await on?.close(); await off?.close(); });

const start = (b: Browser, email: string, extra: Record<string, unknown> = {}) =>
  b.request('POST', '/v1/auth/email/start', { body: { clientRequestId: randomUUID(), email, client: 'WEB', ...extra } });
const verify = (b: Browser, challengeId: string, value: string, extra: Record<string, unknown> = {}) =>
  b.request('POST', '/v1/auth/email/verify', { body: { clientRequestId: randomUUID(), challengeId, code: value, ...extra } });
const q = async (h: Harness, sql: string, params: unknown[] = []) => (await h.db.pool.query(sql, params)).rows;
/** Moves earlier challenges out of the 30-second resend wait (not out of the 15-minute window). */
const pastResend = (h: Harness) => q(h, `UPDATE auth_transactions SET created_at = created_at - interval '1 minute' WHERE kind = 'EMAIL_OTP'`);
const reviewUserId = async (h: Harness) => (await q(h, `SELECT user_id FROM identities WHERE issuer = $1 AND subject = $2`, [REVIEW_ISSUER, `review|${REVIEW_EMAIL}`]))[0]?.user_id as string | undefined;

describe('review sign-in enabled', () => {
  it('starts without calling the provider and answers like any other email', async () => {
    const send = vi.spyOn(on.idp, 'startEmailOtp');
    try {
      const review = await start(new Browser(on), 'AppReview@Example.Invalid');
      expect(review.statusCode, review.body).toBe(201);
      expect(send).not.toHaveBeenCalled();
      expect(on.idp.inbox.has(REVIEW_EMAIL)).toBe(false);
      const normal = await start(new Browser(on), `qa-${randomUUID().slice(0, 8)}@example.invalid`);
      expect(send).toHaveBeenCalledTimes(1);
      expect(Object.keys(json(review).data).sort()).toEqual(Object.keys(json(normal).data).sort());
      expect(review.headers['cache-control']).toBe(normal.headers['cache-control']);
      const [row] = await q(on, `SELECT provider_state FROM auth_transactions WHERE id = $1`, [json(review).data.challengeId]);
      expect(row.provider_state).toEqual({ email: REVIEW_EMAIL, review: '1' });
    } finally { send.mockRestore(); }
  });

  it('signs in with the hashed code, creates one stable test-classified account, audits and notifies', async () => {
    await pastResend(on);
    const b = new Browser(on);
    const { challengeId } = json(await start(b, REVIEW_EMAIL)).data;
    const signed = await verify(b, challengeId, code);
    expect(signed.statusCode, signed.body).toBe(200);
    expect(json(signed).data).toMatchObject({ outcome: 'AUTHENTICATED', authProof: challengeId });
    expect(json(signed).data.session.user.email).toBe(REVIEW_EMAIL);
    const userId = await reviewUserId(on);
    expect(userId).toBe(json(signed).data.session.user.id);
    expect(await q(on, `SELECT provider, email_verified FROM identities WHERE user_id = $1`, [userId])).toEqual([{ provider: 'EMAIL', email_verified: true }]);
    expect(await q(on, `SELECT classification, actor_id FROM account_classifications WHERE user_id = $1`, [userId])).toEqual([{ classification: 'test', actor_id: userId }]);
    const audits = await q(on, `SELECT action, actor_kind, payload FROM audit_events WHERE aggregate_id = $1 ORDER BY occurred_at`, [userId]);
    expect(audits.map((a) => a.action)).toEqual(['account.classified', 'auth.review_signin']);
    expect(audits[1]).toMatchObject({ actor_kind: 'USER', payload: { purpose: 'LOGIN', client: 'WEB', created: true } });
    const outbox = await q(on, `SELECT event_id, recipient_id, channel, template, payload, status FROM outbox WHERE template = 'review_signin'`);
    expect(outbox).toEqual([{ event_id: challengeId, recipient_id: null, channel: 'EMAIL', template: 'review_signin', payload: {}, status: 'PENDING' }]);

    // Second sign-in (iOS this time): same account, still test (no new revision), one more audit + notice.
    await pastResend(on);
    const phone = new Browser(on);
    const second = json(await start(phone, REVIEW_EMAIL, { client: 'IOS' })).data;
    const again = await verify(phone, second.challengeId, code, { appChallenge: pkceChallenge(randomToken(32)) });
    expect(again.statusCode, again.body).toBe(200);
    expect(json(again).data.handoffCode).toEqual(expect.any(String));
    expect(await q(on, `SELECT count(*)::int AS n FROM users u JOIN private_contact c ON c.user_id = u.id WHERE c.email = $1`, [REVIEW_EMAIL])).toEqual([{ n: 1 }]);
    expect(await q(on, `SELECT count(*)::int AS n FROM account_classifications WHERE user_id = $1`, [userId])).toEqual([{ n: 1 }]);
    expect(await q(on, `SELECT payload FROM audit_events WHERE action = 'auth.review_signin' ORDER BY occurred_at`)).toEqual([
      { payload: { purpose: 'LOGIN', client: 'WEB', created: true } }, { payload: { purpose: 'LOGIN', client: 'IOS', created: false } }]);
    expect(await q(on, `SELECT count(*)::int AS n FROM outbox WHERE template = 'review_signin'`)).toEqual([{ n: 2 }]);

    // The code and its hash never land in transactions, audit rows or the outbox.
    const stored = JSON.stringify([
      ...await q(on, `SELECT row_to_json(t) AS r FROM auth_transactions t`),
      ...await q(on, `SELECT row_to_json(a) AS r FROM audit_events a`),
      ...await q(on, `SELECT row_to_json(o) AS r FROM outbox o`),
    ]);
    expect(stored).not.toContain(`"${code}"`);
    expect(stored).not.toContain(':16384:');
  });

  it('re-applies the test classification if someone changed it', async () => {
    const userId = (await reviewUserId(on))!;
    await q(on, `INSERT INTO account_classifications (user_id, classification, actor_id, reason) VALUES ($1, 'regular', $1, 'changed by mistake')`, [userId]);
    await pastResend(on);
    const b = new Browser(on);
    const { challengeId } = json(await start(b, REVIEW_EMAIL)).data;
    expect((await verify(b, challengeId, code)).statusCode).toBe(200);
    expect((await q(on, `SELECT classification FROM account_classifications WHERE user_id = $1 ORDER BY revision DESC LIMIT 1`, [userId]))[0].classification).toBe('test');
  });

  it('counts wrong codes against the 5-attempt cap and refuses the right code afterwards', async () => {
    await pastResend(on);
    const b = new Browser(on);
    const { challengeId } = json(await start(b, REVIEW_EMAIL)).data;
    const before = (await q(on, `SELECT count(*)::int AS n FROM audit_events WHERE action = 'auth.review_signin'`))[0].n;
    for (let left = 4; left >= 1; left--) {
      const r = await verify(b, challengeId, wrongCode);
      expect(r.statusCode).toBe(422);
      expect(json(r).error.fieldErrors['body.code']).toBe(`Incorrect code (${left} attempts left)`);
      expect(r.headers['set-cookie']).toBeUndefined();
    }
    expect(json(await verify(b, challengeId, wrongCode)).error.fieldErrors['body.code']).toBe('No attempts left');
    const late = await verify(b, challengeId, code);
    expect(late.statusCode).toBe(409);
    expect(json(late).error.code).toBe('STATE_CONFLICT');
    expect((await q(on, `SELECT count(*)::int AS n FROM audit_events WHERE action = 'auth.review_signin'`))[0].n).toBe(before);
  });

  it('keeps the resend wait and the per-email and per-IP quotas', async () => {
    await q(on, `UPDATE auth_transactions SET created_at = created_at - interval '1 hour' WHERE kind = 'EMAIL_OTP'`);
    const b = new Browser(on);
    expect((await start(b, REVIEW_EMAIL)).statusCode).toBe(201);
    const resend = await start(b, REVIEW_EMAIL);
    expect(resend.statusCode).toBe(429);
    expect(json(resend).error.code).toBe('RATE_LIMITED');
    for (let i = 0; i < 4; i++) {
      await pastResend(on);
      expect((await start(new Browser(on), REVIEW_EMAIL)).statusCode, `start ${i}`).toBe(201);
    }
    await pastResend(on);
    expect(json(await start(new Browser(on), REVIEW_EMAIL)).error.code).toBe('RATE_LIMITED');

    // Per IP: five other addresses from one device exhaust the review address's IP budget too.
    await q(on, `UPDATE auth_transactions SET created_at = created_at - interval '1 hour' WHERE kind = 'EMAIL_OTP'`);
    const device = new Browser(on);
    for (let i = 0; i < 5; i++) expect((await start(device, `qa-${randomUUID().slice(0, 8)}@example.invalid`)).statusCode).toBe(201);
    expect(json(await start(device, REVIEW_EMAIL)).error.code).toBe('RATE_LIMITED');
  });

  it('leaves every other email on the provider, including look-alikes', async () => {
    await q(on, `UPDATE auth_transactions SET created_at = created_at - interval '1 hour' WHERE kind = 'EMAIL_OTP'`);
    for (const other of ['appreview+x@example.invalid', 'appreview@example.invalid.evil', `qa-${randomUUID().slice(0, 8)}@example.invalid`]) {
      const b = new Browser(on);
      const { challengeId } = json(await start(b, other)).data;
      expect(on.idp.inbox.get(other)).toHaveLength(1);
      expect((await verify(b, challengeId, code === on.idp.inbox.get(other)![0] ? wrongCode : code)).statusCode).toBe(422);
      const ok = await verify(b, challengeId, on.idp.inbox.get(other)![0]!);
      expect(ok.statusCode, ok.body).toBe(200);
      const [identity] = await q(on, `SELECT issuer FROM identities WHERE user_id = $1`, [json(ok).data.session.user.id]);
      expect(identity.issuer).toBe(TEST_ISSUER);
    }
  });

  it('re-authenticates the review account with the same code', async () => {
    await q(on, `UPDATE auth_transactions SET created_at = created_at - interval '1 hour' WHERE kind = 'EMAIL_OTP'`);
    const b = new Browser(on);
    const { challengeId } = json(await start(b, REVIEW_EMAIL)).data;
    const signed = await verify(b, challengeId, code);
    expect(signed.statusCode).toBe(200);
    b.csrf = json(signed).data.session.csrfToken;
    await pastResend(on);
    const send = vi.spyOn(on.idp, 'startEmailOtp');
    try {
      const reauth = await b.request('POST', '/v1/auth/reauth', { body: { clientRequestId: randomUUID(), method: 'EMAIL' } });
      expect(reauth.statusCode, reauth.body).toBe(201);
      expect(send).not.toHaveBeenCalled();
      const done = await verify(b, json(reauth).data.challengeId, code);
      expect(done.statusCode, done.body).toBe(200);
      expect((await q(on, `SELECT payload FROM audit_events WHERE action = 'auth.review_signin' ORDER BY occurred_at DESC LIMIT 1`))[0].payload).toMatchObject({ purpose: 'REAUTH' });
    } finally { send.mockRestore(); }
  });
});

describe('review sign-in disabled', () => {
  it('sends the review address through the provider like any other email', async () => {
    const b = new Browser(off);
    const { challengeId } = json(await start(b, REVIEW_EMAIL)).data;
    expect(off.idp.inbox.get(REVIEW_EMAIL)).toHaveLength(1);
    const [row] = await q(off, `SELECT provider_state FROM auth_transactions WHERE id = $1`, [challengeId]);
    expect(row.provider_state.review).toBeUndefined();
    const delivered = off.idp.inbox.get(REVIEW_EMAIL)![0]!;
    if (delivered !== code) expect((await verify(b, challengeId, code)).statusCode).toBe(422);
    const ok = await verify(b, challengeId, delivered);
    expect(ok.statusCode, ok.body).toBe(200);
    expect(await q(off, `SELECT issuer FROM identities`)).toEqual([{ issuer: TEST_ISSUER }]);
    expect(await q(off, `SELECT count(*)::int AS n FROM account_classifications`)).toEqual([{ n: 0 }]);
    expect(await q(off, `SELECT count(*)::int AS n FROM audit_events WHERE action = 'auth.review_signin'`)).toEqual([{ n: 0 }]);
    expect(await q(off, `SELECT count(*)::int AS n FROM outbox WHERE template = 'review_signin'`)).toEqual([{ n: 0 }]);
  });
});
