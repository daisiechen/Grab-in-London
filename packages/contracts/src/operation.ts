import type { TObject, TSchema } from './schema.ts';
import type { ErrorCode } from './errors.ts';
import type { ROLES } from './dictionaries.ts';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
/**
 * public: guests allowed; optionalSession: richer projection when signed in; session: signed-in user;
 * staff: session + role + MFA; receipt: authorised by a pre-stored deletion receipt token only.
 */
export type AuthMode = 'public' | 'optionalSession' | 'session' | 'staff' | 'receipt';
/**
 * idempotencyKey: write claimed by actor+operation+Idempotency-Key (API contract §1);
 * clientRequestId: anonymous/credential-bearing auth step deduped without storing the response (§7);
 * resourceKey: permanent resource uniqueness instead (clientMessageId, eventId, receiptToken);
 * read: no side effect.
 */
export type WriteProtocol = 'idempotencyKey' | 'clientRequestId' | 'resourceKey' | 'read';

export interface OperationDef {
  operationId: string;
  method: HttpMethod;
  /** OpenAPI path template under /v1, e.g. `/meals/{mealId}`. */
  path: string;
  summary: string;
  auth: AuthMode;
  roles?: ReadonlyArray<(typeof ROLES)[number]>;
  write: WriteProtocol;
  /** Requires `If-Match: "<version>"`; missing → 428 PRECONDITION_REQUIRED. */
  ifMatch: boolean;
  params?: TObject;
  query?: TObject;
  body?: TSchema;
  /** `media`: raw (non-JSON) success body type for data-less reads; defaults to text/csv. */
  success: { status: 200 | 201 | 202 | 204; data?: TSchema; list?: boolean; media?: 'text/csv' | 'image/jpeg' };
  /** Operation-specific codes; transport codes are added from auth/write/ifMatch (see errorsFor). */
  errors: readonly ErrorCode[];
}

export const op = <const D extends OperationDef>(def: D): D => def;

/** Full error set an operation can return, derived consistently from its protocol flags. */
export function errorsFor(def: OperationDef): ErrorCode[] {
  const codes = new Set<ErrorCode>(['INVALID_REQUEST', 'RATE_LIMITED', 'INTERNAL_ERROR', ...def.errors]);
  if (def.params || def.query || def.body) codes.add('VALIDATION_FAILED');
  if (def.auth === 'session' || def.auth === 'staff') {
    codes.add('AUTH_REQUIRED');
    // A suspended member's revoked credential is answered with this clear code instead of 401.
    codes.add('ACCOUNT_SUSPENDED');
  }
  if (def.auth === 'staff') {
    codes.add('FORBIDDEN');
    codes.add('REAUTH_REQUIRED');
  }
  if (def.write === 'idempotencyKey') {
    codes.add('IDEMPOTENCY_CONFLICT');
    codes.add('INTENT_IN_PROGRESS');
  }
  if (def.ifMatch) {
    codes.add('PRECONDITION_REQUIRED');
    codes.add('VERSION_CONFLICT');
  }
  return [...codes].sort();
}
