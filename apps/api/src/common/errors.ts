import { ERROR_STATUS, type ErrorCode } from '@fancy/contracts';

/**
 * Expected business rejection. Unlike unexpected errors it is a stable answer: the idempotency
 * record stores it, and facts already applied in the same transaction (lifecycle catch-up) commit.
 */
export class DomainError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly details: { currentVersion?: string; fieldErrors?: Record<string, string>; retryAfterSeconds?: number; choices?: unknown[] };

  constructor(code: ErrorCode, message: string, details: DomainError['details'] = {}) {
    super(message);
    this.name = 'DomainError';
    this.code = code;
    this.status = ERROR_STATUS[code];
    this.details = details;
  }
}

/** Programming error in lock/clock discipline; never a user-facing outcome. */
export class InvariantError extends Error {
  override name = 'InvariantError';
}

/**
 * A stale attempt lost its claim/lease. Deliberately not a DomainError so withTransaction always
 * rolls back; the HTTP layer answers 409 INTENT_IN_PROGRESS with retry-after.
 */
export class FencingError extends Error {
  override name = 'FencingError';
  readonly code = 'INTENT_IN_PROGRESS' as const;
}
