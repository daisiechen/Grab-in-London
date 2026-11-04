import { randomInt } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { hashReviewCode, loadConfig } from '@fancy/config';
import { isReviewEmail, REVIEW_ISSUER, startReviewOtp, verifyReviewOtp } from './review-login.ts';

const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
const base = {
  ENVIRONMENT: 'test', DATABASE_URL: 'postgres://fancy@127.0.0.1:5432/fancy_test', AUTH_ADAPTER: 'test', PLACES_ADAPTER: 'fixture', MAIL_ADAPTER: 'outbox_test', AI_PROVIDER: 'mock',
  WEB_ORIGIN: 'http://localhost:5174', SESSION_SECRET: 'test-session-secret-0123456789abcdef', SUPPORT_EMAIL: 'support@example.invalid',
  REVIEW_ACCOUNT_EMAIL: 'appreview@example.invalid', REVIEW_ACCOUNT_CODE_HASH: hashReviewCode(code),
};
const enabled = loadConfig({ ...base, REVIEW_LOGIN_ENABLED: '1' });
const disabled = loadConfig({ ...base, REVIEW_LOGIN_ENABLED: '0' });

describe('review sign-in adapter', () => {
  it('matches only the exact configured address while enabled', () => {
    expect(isReviewEmail(enabled, 'appreview@example.invalid')).toBe(true);
    for (const other of ['appreview@example.invalid ', 'Appreview@example.invalid', 'x.appreview@example.invalid', 'appreview@example.invalid.x']) expect(isReviewEmail(enabled, other)).toBe(false);
    expect(isReviewEmail(disabled, 'appreview@example.invalid')).toBe(false);
  });
  it('verifies the hashed code into the stable local identity', async () => {
    const state = await startReviewOtp(enabled);
    expect(state).toEqual({ review: '1' });
    expect(await verifyReviewOtp(enabled, 'appreview@example.invalid', code, state)).toEqual({
      issuer: REVIEW_ISSUER, subject: 'review|appreview@example.invalid', provider: 'EMAIL', email: 'appreview@example.invalid', emailVerified: true, amr: ['otp'],
    });
  });
  it('refuses a wrong code, a non-review challenge, another email, and a challenge left over after switching off', async () => {
    const state = { review: '1' };
    expect(await verifyReviewOtp(enabled, 'appreview@example.invalid', code === '000000' ? '111111' : '000000', state)).toBeNull();
    expect(await verifyReviewOtp(enabled, 'appreview@example.invalid', code, {})).toBeNull();
    expect(await verifyReviewOtp(enabled, 'other@example.invalid', code, state)).toBeNull();
    expect(await verifyReviewOtp(disabled, 'appreview@example.invalid', code, state)).toBeNull();
  });
});
