import { createHmac } from 'node:crypto';
import type { FastifyRequest } from 'fastify';
import { DomainError } from '../common/errors.ts';
import { safeEqual } from '../identity/tokens.ts';

export const SESSION_COOKIE = '__Host-fancy_session';
export const OAUTH_BINDER_COOKIE = '__Host-fancy_oauth';
export const LINK_BINDER_COOKIE = '__Host-fancy_link';

/** CSRF token for a Web session: stateless HMAC of the session id. */
export const csrfTokenFor = (secret: string, sessionId: string): string =>
  createHmac('sha256', secret).update(`csrf:${sessionId}`).digest('base64url');

/** Keyed hash so stored rate-limit IP/email keys are not reversible by brute force. */
export const keyedHash = (secret: string, purpose: string, value: string): string =>
  createHmac('sha256', secret).update(`${purpose}:${value}`).digest('hex');

/** Browser-originated writes must come from the Web origin (login CSRF and cookie CSRF). */
export function assertWebOrigin(request: FastifyRequest, webOrigin: string): void {
  const origin = request.headers.origin;
  if (typeof origin !== 'string' || origin !== webOrigin) throw new DomainError('FORBIDDEN', 'This request must come from the Fancy app.');
}

export function assertCsrf(request: FastifyRequest, secret: string, sessionId: string): void {
  const presented = request.headers['x-csrf-token'];
  if (typeof presented !== 'string' || !safeEqual(presented, csrfTokenFor(secret, sessionId))) {
    throw new DomainError('FORBIDDEN', 'Your session needs to be refreshed. Please reload and try again.');
  }
}

export const cookieOptions = (maxAgeSeconds: number) =>
  ({ path: '/', httpOnly: true, secure: true, sameSite: 'lax' as const, maxAge: maxAgeSeconds });
