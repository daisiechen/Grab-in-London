import { ApiError } from '@fancy/client';

/** UI-level failure classes; branches only on status/code, never on message text. */
export type FailureKind =
  | 'signed_out' // 401: session missing/expired → clear cached data, ask to sign in again
  | 'reauth' // 403 REAUTH_REQUIRED: staff MFA/recent auth needed
  | 'forbidden' // 403: role not allowed (server-side role check)
  | 'revoked' // 410 SNAPSHOT_REVOKED: clear cache, pick another snapshot
  | 'not_found'
  | 'conflict'
  | 'invalid'
  | 'rate_limited'
  | 'unavailable'
  | 'network'
  | 'error';

export interface Failure {
  kind: FailureKind;
  requestId: string | null;
  /** 429 only: absolute time (epoch ms) before which a retry must not be sent (server Retry-After). */
  retryAt?: number;
}

export function toFailure(error: unknown, now = Date.now()): Failure {
  if (!(error instanceof ApiError)) return { kind: 'error', requestId: null };
  const requestId = error.requestId;
  if (error.code === 'SNAPSHOT_REVOKED') return { kind: 'revoked', requestId };
  if (error.code === 'REAUTH_REQUIRED') return { kind: 'reauth', requestId };
  const byKind: Partial<Record<ApiError['kind'], FailureKind>> = {
    auth: 'signed_out',
    forbidden: 'forbidden',
    not_found: 'not_found',
    conflict: 'conflict',
    precondition: 'conflict',
    validation: 'invalid',
    rate_limit: 'rate_limited',
    unavailable: 'unavailable',
    network: 'network',
  };
  const kind = byKind[error.kind] ?? 'error';
  if (kind === 'rate_limited' && error.retryAfterSeconds && error.retryAfterSeconds > 0) return { kind, requestId, retryAt: now + error.retryAfterSeconds * 1000 };
  return { kind, requestId };
}

/** Failures that end the whole console session view (no data may remain on screen). */
export const isBlocking = (kind: FailureKind) => kind === 'signed_out' || kind === 'forbidden' || kind === 'reauth';
