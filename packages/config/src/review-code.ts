/**
 * App Store review sign-in code hash (app-store-submission §7, option A).
 *
 * Format (one line, no `$` so env files never expand it):
 *   scrypt:<N>:<r>:<p>:<salt base64url, 16 bytes>:<derived key base64url, 32 bytes>
 * e.g. `scrypt:16384:8:1:<22 chars>:<43 chars>`. N is a power of two from 2^14 to 2^17, r = 8,
 * p = 1. The plain 6-digit code is never stored: secrets.sh hashes it on the server and the API
 * only compares (constant time) against this value.
 */
import { randomBytes, scrypt, scryptSync, timingSafeEqual } from 'node:crypto';

export const REVIEW_CODE_HASH_PREFIX = 'scrypt';
const DEFAULT_N = 16384;
const R = 8;
const P = 1;
const KEY_BYTES = 32;
const MAX_MEM = 256 * 1024 * 1024;
const HASH_RE = /^scrypt:(\d{5,6}):(\d{1,2}):(\d{1,2}):([A-Za-z0-9_-]{22}):([A-Za-z0-9_-]{43})$/;

export interface ReviewCodeHash { n: number; r: number; p: number; salt: Buffer; key: Buffer }

/** Parses a stored hash; null when the value is not a well-formed hash (never echoes it). */
export function parseReviewCodeHash(value: string): ReviewCodeHash | null {
  const m = HASH_RE.exec(value);
  if (!m) return null;
  const n = Number(m[1]), r = Number(m[2]), p = Number(m[3]);
  if (n < 2 ** 14 || n > 2 ** 17 || (n & (n - 1)) !== 0 || r !== R || p !== P) return null;
  const salt = Buffer.from(m[4]!, 'base64url'), key = Buffer.from(m[5]!, 'base64url');
  if (salt.length !== 16 || key.length !== KEY_BYTES || salt.toString('base64url') !== m[4] || key.toString('base64url') !== m[5]) return null;
  return { n, r, p, salt, key };
}

export const isReviewCode = (code: string): boolean => /^[0-9]{6}$/.test(code);

/** Hashes a 6-digit code (used by tests and mirrored by `review_code_hash` in the deploy kit). */
export function hashReviewCode(code: string, salt: Buffer = randomBytes(16), n = DEFAULT_N): string {
  if (!isReviewCode(code)) throw new Error('review code must be 6 digits');
  const key = scryptSync(code, salt, KEY_BYTES, { N: n, r: R, p: P, maxmem: MAX_MEM });
  return [REVIEW_CODE_HASH_PREFIX, n, R, P, salt.toString('base64url'), key.toString('base64url')].join(':');
}

/** Constant-time comparison of a submitted code with the stored hash. */
export async function verifyReviewCode(code: string, stored: string): Promise<boolean> {
  const parsed = parseReviewCodeHash(stored);
  if (!parsed) return false;
  // Always derive (also for malformed input) so the work done does not depend on the guess.
  const candidate = isReviewCode(code) ? code : '\u0000'.repeat(6);
  const derived = await new Promise<Buffer>((resolve, reject) =>
    scrypt(candidate, parsed.salt, KEY_BYTES, { N: parsed.n, r: parsed.r, p: parsed.p, maxmem: MAX_MEM }, (error, key) => (error ? reject(error) : resolve(key))));
  return timingSafeEqual(derived, parsed.key) && isReviewCode(code);
}
