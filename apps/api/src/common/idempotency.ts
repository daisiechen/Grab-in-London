import { randomUUID } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import { DomainError, FencingError } from './errors.ts';

/**
 * Ordinary write intents (API contract §1): actor+operation+key is claimed atomically in a short
 * transaction, completed inside the business transaction, and kept 30 days. Credential-bearing
 * auth responses never use this table; permanent dedupe belongs to resource tables.
 */
export const INTENT_RETENTION_DAYS = 30;
export const INTENT_LEASE_MS = 60_000;

export interface IntentKey {
  actorId: string;
  operation: string;
  key: string;
  requestHash: string;
}

export type Claim =
  | { kind: 'claimed'; token: string; intent: IntentKey }
  | { kind: 'replay'; status: number; body: unknown; resourceId: string | null };

export async function claimIntent(pool: Pool, intent: IntentKey, leaseMs = INTENT_LEASE_MS): Promise<Claim> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const token = randomUUID();
    const inserted = await client.query(
      `INSERT INTO idempotency (actor_id, operation, key, request_hash, state, claim_token, lease_until, expires_at)
       VALUES ($1, $2, $3, $4, 'IN_PROGRESS', $5, clock_timestamp() + make_interval(secs => $6::double precision / 1000),
               clock_timestamp() + make_interval(days => $7))
       ON CONFLICT (actor_id, operation, key) DO NOTHING`,
      [intent.actorId, intent.operation, intent.key, intent.requestHash, token, leaseMs, INTENT_RETENTION_DAYS],
    );
    if (inserted.rowCount === 1) {
      await client.query('COMMIT');
      return { kind: 'claimed', token, intent };
    }
    const { rows } = await client.query(
      `SELECT request_hash, state, response_status, response_json, resource_id,
              lease_until <= clock_timestamp() AS lease_expired, expires_at <= clock_timestamp() AS expired
         FROM idempotency WHERE actor_id = $1 AND operation = $2 AND key = $3 FOR UPDATE`,
      [intent.actorId, intent.operation, intent.key],
    );
    const row = rows[0];
    if (row.request_hash !== intent.requestHash) {
      await client.query('ROLLBACK');
      throw new DomainError('IDEMPOTENCY_CONFLICT', 'This request key was already used for a different request.');
    }
    if (row.expired) {
      await client.query('ROLLBACK');
      throw new DomainError('IDEMPOTENCY_CONFLICT', 'This request is too old to retry. Check the current state and try again.');
    }
    if (row.state === 'COMPLETED') {
      await client.query('COMMIT');
      return { kind: 'replay', status: row.response_status, body: row.response_json, resourceId: row.resource_id };
    }
    if (!row.lease_expired) {
      await client.query('ROLLBACK');
      throw new DomainError('INTENT_IN_PROGRESS', 'This request is still being processed.', { retryAfterSeconds: 1 });
    }
    // Previous attempt crashed before committing its business transaction: take the claim over.
    await client.query(
      `UPDATE idempotency SET claim_token = $4, lease_until = clock_timestamp() + make_interval(secs => $5::double precision / 1000)
        WHERE actor_id = $1 AND operation = $2 AND key = $3`,
      [intent.actorId, intent.operation, intent.key, token, leaseMs],
    );
    await client.query('COMMIT');
    return { kind: 'claimed', token, intent };
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Seals the stable outcome (success or DomainError) inside the business transaction. If the lease
 * was lost to another attempt this throws FencingError, which is never committable, so every write
 * of the stale attempt rolls back (even under commitOnDomainError); HTTP maps it to 409 INTENT_IN_PROGRESS.
 */
export async function completeIntent(tx: PoolClient, claim: Extract<Claim, { kind: 'claimed' }>, outcome: { status: number; body: unknown; resourceId?: string | null }): Promise<void> {
  if (outcome.status >= 500) throw new Error('5xx outcomes are never sealed as idempotent results');
  const { rowCount } = await tx.query(
    `UPDATE idempotency SET state = 'COMPLETED', response_status = $5, response_json = $6, resource_id = $7, completed_at = clock_timestamp()
      WHERE actor_id = $1 AND operation = $2 AND key = $3 AND claim_token = $4 AND state = 'IN_PROGRESS'`,
    [claim.intent.actorId, claim.intent.operation, claim.intent.key, claim.token, outcome.status, JSON.stringify(outcome.body), outcome.resourceId ?? null],
  );
  if (rowCount !== 1) throw new FencingError('idempotency claim was taken over by another attempt');
}

/** Unexpected failure: drop the claim so the same intent can be retried immediately. */
export async function releaseIntent(pool: Pool, claim: Extract<Claim, { kind: 'claimed' }>): Promise<void> {
  await pool.query(
    `DELETE FROM idempotency WHERE actor_id = $1 AND operation = $2 AND key = $3 AND claim_token = $4 AND state = 'IN_PROGRESS'`,
    [claim.intent.actorId, claim.intent.operation, claim.intent.key, claim.token],
  );
}

/**
 * A stored response is only returned after the caller re-checks that the actor may still see it
 * (e.g. not deleted, still a member); otherwise the replay is refused without the stored body.
 */
export async function replayIfAuthorized(replay: Extract<Claim, { kind: 'replay' }>, stillAuthorized: () => Promise<boolean>): Promise<{ status: number; body: unknown }> {
  if (!(await stillAuthorized())) throw new DomainError('FORBIDDEN', 'You no longer have access to this result.');
  return { status: replay.status, body: replay.body };
}

/** Worker purge of ordinary intents past retention; resource-level unique keys are untouched. */
export async function purgeExpiredIntents(pool: Pool): Promise<number> {
  const { rowCount } = await pool.query(`DELETE FROM idempotency WHERE expires_at <= clock_timestamp()`);
  return rowCount ?? 0;
}
