import type { FastifyInstance } from 'fastify';
import { operationsById, receiptOperationIds, type OperationId } from '@fancy/contracts';
import { DomainError } from '../common/errors.ts';
import { defineRoute } from '../http/routes.ts';
import type { AppDeps } from '../http/context.ts';

type Conflict = 'VERSION' | 'IN_PROGRESS' | 'PAYLOAD' | 'STATE';
interface Row {
  state: 'IN_PROGRESS' | 'COMPLETED';
  response_status: number | null;
  response_json: { data?: unknown; meta?: { version?: unknown }; error?: { code?: unknown; currentVersion?: unknown } } | null;
  resource_id: string | null;
  completed_at: Date | null;
  expires_at: Date;
  lease_remaining_ms: number;
  expired: boolean;
}

const DECIMAL = /^(0|[1-9][0-9]{0,18})$/;
const decimal = (v: unknown) => (typeof v === 'string' && DECIMAL.test(v) ? v : null);

export function conflictClass(status: number | null, code: string | null): Conflict | null {
  if (status !== 409 || !code) return null;
  if (code === 'VERSION_CONFLICT') return 'VERSION';
  if (code === 'INTENT_IN_PROGRESS') return 'IN_PROGRESS';
  if (code === 'IDEMPOTENCY_CONFLICT') return 'PAYLOAD';
  return 'STATE';
}

/**
 * GET /me/command-receipts/{operation}/{key} (P1.1 P03). Reads the existing idempotency row of
 * the caller only; never returns stored bodies. Equality of the current resource value is not
 * evidence that an intent succeeded, so clients clear an unknown intent only from SUCCEEDED here
 * or from a same-key replay.
 */
export function registerReceiptRoutes(app: FastifyInstance, deps: AppDeps) {
  defineRoute(app, deps, 'getCommandReceipt', async ({ request, auth }) => {
    const { operation, key } = request.params as { operation: string; key: string };
    if (!receiptOperationIds.has(operation)) throw new DomainError('NOT_FOUND', 'This action has no receipt.');
    const def = operationsById[operation as OperationId];
    if (def.auth === 'staff') {
      // Same gate as the original staff write: role and MFA are re-checked on every receipt read.
      const { rows } = await deps.pool.query<{ role: string }>(`SELECT role FROM roles WHERE user_id = $1`, [auth!.userId]);
      if (!rows.some((r) => (def.roles as readonly string[] | undefined)?.includes(r.role))) throw new DomainError('FORBIDDEN', 'You do not have access to this area.');
      if (!auth!.amr.includes('mfa')) throw new DomainError('REAUTH_REQUIRED', 'Multi-factor sign-in is required for this area.');
    }
    const normalisedKey = key.toLowerCase();
    const { rows: [row] } = await deps.pool.query<Row>(
      `SELECT state, response_status, response_json, resource_id, completed_at, expires_at,
              GREATEST(0, EXTRACT(EPOCH FROM (lease_until - clock_timestamp())) * 1000)::float8 AS lease_remaining_ms,
              expires_at <= clock_timestamp() AS expired
         FROM idempotency WHERE actor_id = $1 AND operation = $2 AND key = $3`,
      [auth!.userId, operation, normalisedKey],
    );
    const base = { operation, key: normalisedKey, retryable: false, expired: false, retryAfterSeconds: null, httpStatus: null, errorCode: null, conflict: null,
      resourceId: null, resourceVersion: null, currentVersion: null, completedAt: null, expiresAt: null };
    if (!row) return { data: { ...base, state: 'NONE' } };
    const expiresAt = row.expires_at.toISOString();
    const expired = row.expired;
    if (row.state === 'IN_PROGRESS') {
      // claimIntent rejects any reuse of an expired key, so an expired PENDING is never retryable.
      const leaseLost = row.lease_remaining_ms <= 0;
      return { data: { ...base, state: 'PENDING', expired, retryable: leaseLost && !expired,
        retryAfterSeconds: leaseLost || expired ? null : Math.min(60, Math.max(1, Math.ceil(row.lease_remaining_ms / 1000))), expiresAt } };
    }
    const status = row.response_status;
    const body = row.response_json ?? {};
    const completedAt = row.completed_at?.toISOString() ?? null;
    if (status !== null && status < 300) {
      return { data: { ...base, state: 'SUCCEEDED', expired, httpStatus: status, resourceId: row.resource_id, resourceVersion: decimal(body.meta?.version), completedAt, expiresAt } };
    }
    const code = typeof body.error?.code === 'string' && /^[A-Z][A-Z_]{1,63}$/.test(body.error.code) ? body.error.code : null;
    return { data: { ...base, state: 'REJECTED', expired, httpStatus: status, errorCode: code, conflict: conflictClass(status, code),
      currentVersion: decimal(body.error?.currentVersion), completedAt, expiresAt } };
  });
}
