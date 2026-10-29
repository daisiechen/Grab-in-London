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
}

export function toFailure(error: unknown): Failure {
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
  return { kind: byKind[error.kind] ?? 'error', requestId };
}

/**
 * Moderation/support calls: only a missing or unverified session ends the console view. A 403 there
 * means this case or action is not allowed and is shown in place (facts cleared), not as a gate.
 */
export const endsSession = (kind: FailureKind) => kind === 'signed_out' || kind === 'reauth';

/** Failures that end the whole console session view (no data may remain on screen). */
export const isBlocking = (kind: FailureKind) => kind === 'signed_out' || kind === 'forbidden' || kind === 'reauth';
