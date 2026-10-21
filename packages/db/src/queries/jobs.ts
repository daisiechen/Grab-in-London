import type { Pool, PoolClient } from 'pg';

export interface Job {
  id: string;
  kind: string;
  resourceId: string;
  dueAt: Date;
  attempts: number;
  maxAttempts: number;
  leaseOwner: string;
  leaseUntil: Date;
  claimToken: string;
}

/**
 * The only error codes a failed job may record or forward to alerts. Anything else — free text or
 * an unrecognised code that could embed provider data — collapses to HANDLER_ERROR.
 * Keep in sync with the jobs.last_error CHECK in migrations.
 */
export const JOB_ERROR_CODES = [
  'HANDLER_ERROR', 'LEASE_EXPIRED', 'PROVIDER_TIMEOUT', 'PROVIDER_UNAVAILABLE', 'PROVIDER_REJECTED',
  'PROVIDER_UNKNOWN_OUTCOME', 'STATE_CONFLICT', 'NOT_FOUND', 'DB_RETRY_EXHAUSTED', 'INVALID_PAYLOAD',
] as const;
export type JobErrorCode = (typeof JOB_ERROR_CODES)[number];
const KNOWN_JOB_ERRORS: ReadonlySet<string> = new Set(JOB_ERROR_CODES);
export const jobErrorCode = (error: unknown): JobErrorCode => {
  const code = (error as { code?: unknown } | null)?.code;
  return typeof code === 'string' && KNOWN_JOB_ERRORS.has(code) ? (code as JobErrorCode) : 'HANDLER_ERROR';
};

/** Schedule work; (kind, resource, dueAt) is unique so re-scheduling the same instant is a no-op. */
export async function enqueueJob(tx: PoolClient | Pool, j: { kind: string; resourceId: string; dueAt: Date; maxAttempts?: number }): Promise<boolean> {
  const { rowCount } = await tx.query(
    `INSERT INTO jobs (kind, resource_id, due_at, run_after, max_attempts) VALUES ($1, $2, $3, $3, $4)
     ON CONFLICT (kind, resource_id, due_at) DO NOTHING`,
    [j.kind, j.resourceId, j.dueAt, j.maxAttempts ?? 8],
  );
  return rowCount === 1;
}

/** Drops not-yet-run work for a resource (e.g. arrangement edited); finished or running jobs are kept. */
export async function cancelPendingJobs(tx: PoolClient, kind: string, resourceId: string): Promise<number> {
  const { rowCount } = await tx.query(`DELETE FROM jobs WHERE kind = $1 AND resource_id = $2 AND state = 'PENDING'`, [kind, resourceId]);
  return rowCount ?? 0;
}

/**
 * Claim due jobs with SKIP LOCKED. A RUNNING job whose lease expired is reclaimable (worker crash)
 * only while attempts remain; each claim increments attempts and mints a new claim token.
 * Claiming is not completion.
 */
export async function claimJobs(pool: Pool, o: { owner: string; kinds: readonly string[]; limit: number; leaseMs: number }): Promise<Job[]> {
  const { rows } = await pool.query(
    `WITH due AS (
       SELECT id FROM jobs
        WHERE kind = ANY($2::text[])
          AND attempts < max_attempts
          AND ((state = 'PENDING' AND run_after <= clock_timestamp())
            OR (state = 'RUNNING' AND lease_until <= clock_timestamp()))
        ORDER BY run_after, id
        LIMIT $3
        FOR UPDATE SKIP LOCKED)
     UPDATE jobs j SET state = 'RUNNING', lease_owner = $1, attempts = j.attempts + 1, claim_token = gen_random_uuid(),
            lease_until = clock_timestamp() + make_interval(secs => $4::double precision / 1000)
       FROM due WHERE j.id = due.id
     RETURNING j.id, j.kind, j.resource_id, j.due_at, j.attempts, j.max_attempts, j.lease_owner, j.lease_until, j.claim_token`,
    [o.owner, o.kinds, o.limit, o.leaseMs],
  );
  return rows.map((r) => ({
    id: r.id, kind: r.kind, resourceId: r.resource_id, dueAt: r.due_at, attempts: r.attempts,
    maxAttempts: r.max_attempts, leaseOwner: r.lease_owner, leaseUntil: r.lease_until, claimToken: r.claim_token,
  }));
}

/**
 * Jobs whose last allowed attempt died mid-lease (repeated crashes/timeouts) become DEAD instead
 * of being reclaimed forever; returned so the runner can alert.
 */
export async function reapExhaustedJobs(pool: Pool, kinds: readonly string[]): Promise<Array<{ id: string; kind: string; resourceId: string }>> {
  const { rows } = await pool.query(
    `UPDATE jobs SET state = 'DEAD', lease_owner = NULL, lease_until = NULL, claim_token = NULL, last_error = 'LEASE_EXPIRED'
      WHERE kind = ANY($1::text[]) AND state = 'RUNNING' AND lease_until <= clock_timestamp() AND attempts >= max_attempts
      RETURNING id, kind, resource_id`,
    [kinds],
  );
  return rows.map((r) => ({ id: r.id, kind: r.kind, resourceId: r.resource_id }));
}

/** Completes only with the current claim token; false means the attempt was fenced off. */
export async function completeJob(db: Pool | PoolClient, job: Pick<Job, 'id' | 'claimToken'>): Promise<boolean> {
  const { rowCount } = await db.query(
    `UPDATE jobs SET state = 'DONE', completed_at = clock_timestamp(), lease_owner = NULL, lease_until = NULL, claim_token = NULL, last_error = NULL
      WHERE id = $1 AND state = 'RUNNING' AND claim_token = $2`,
    [job.id, job.claimToken],
  );
  return rowCount === 1;
}

/** Exponential backoff (capped at 1h); DEAD after max attempts so alerts can fire. */
export async function failJob(db: Pool | PoolClient, job: Pick<Job, 'id' | 'claimToken'>, errorCode: JobErrorCode, baseDelayMs = 5_000): Promise<'RETRY' | 'DEAD' | 'LOST'> {
  if (!KNOWN_JOB_ERRORS.has(errorCode)) throw new Error('failJob requires an allowlisted error code');
  const { rows } = await db.query<{ state: string }>(
    `UPDATE jobs SET
        state = CASE WHEN attempts >= max_attempts THEN 'DEAD' ELSE 'PENDING' END,
        run_after = clock_timestamp() + make_interval(secs => LEAST(3600, ($3::double precision / 1000) * power(2, attempts - 1))),
        lease_owner = NULL, lease_until = NULL, claim_token = NULL, last_error = $4
      WHERE id = $1 AND state = 'RUNNING' AND claim_token = $2
      RETURNING state`,
    [job.id, job.claimToken, baseDelayMs, errorCode],
  );
  if (!rows[0]) return 'LOST';
  return rows[0].state === 'DEAD' ? 'DEAD' : 'RETRY';
}

/** Earliest unfinished due time, for lag monitoring (validation §3). */
export async function oldestPendingDueAt(pool: Pool): Promise<Date | null> {
  const { rows } = await pool.query<{ due: Date | null }>(`SELECT min(due_at) AS due FROM jobs WHERE state IN ('PENDING', 'RUNNING')`);
  return rows[0]?.due ?? null;
}
