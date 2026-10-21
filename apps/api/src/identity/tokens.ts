import { createHash, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';

/** 256-bit opaque token, base64url (43 chars). */
export const randomToken = (bytes = 32): string => randomBytes(bytes).toString('base64url');
export const sha256Hex = (value: string): string => createHash('sha256').update(value).digest('hex');
/** RFC 7636 S256 challenge. */
export const pkceChallenge = (verifier: string): string => createHash('sha256').update(verifier).digest('base64url');
export const randomOtp = (): string => String(randomInt(0, 1_000_000)).padStart(6, '0');

export function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export const verifyPkce = (verifier: string, challenge: string): boolean => safeEqual(pkceChallenge(verifier), challenge);

/** Normalises an email for comparison only; it is never a unique business key. */
export const normalizeEmail = (email: string): string => email.trim().toLowerCase();
