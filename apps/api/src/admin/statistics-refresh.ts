import type { Pool, PoolClient } from 'pg';
import { randomUUID } from 'node:crypto';
import { DomainError } from '../common/errors.ts';

/**
 * PATCH-006 P09 statistics refresh bound to one accepted classification intent.
 * Ready means a valid sealed snapshot holds the target user's accepted revision (or a later
 * revision of the same user). Revisions of different users are never compared, and nothing here
 * writes, retries or rolls back a classification.
 */
export type StatisticsRefreshState = 'pending' | 'ready' | 'failed';
export interface StatisticsRefresh {
  refreshId: string;
  targetUserId: string;
  acceptedRevision: string;
  state: StatisticsRefreshState;
  snapshotId: string | null;
  failureCode: string | null;
  updatedAt: string;
}
type Db = Pool | PoolClient;
const MAX_ATTEMPTS = 3;
const COLUMNS = `id,target_user_id,accepted_revision::text,state,snapshot_id,failure_code,updated_at`;

function project(row: Record<string, unknown>): StatisticsRefresh {
  return {
    refreshId: row.id as string, targetUserId: row.target_user_id as string, acceptedRevision: row.accepted_revision as string,
    state: (row.state as string).toLowerCase() as StatisticsRefreshState, snapshotId: (row.snapshot_id as string | null) ?? null,
    failureCode: (row.failure_code as string | null) ?? null, updatedAt: (row.updated_at as Date).toISOString(),
  };
}

/** Called inside the classification transaction, so the intent and its refresh commit together. */
export async function createStatisticsRefresh(db: PoolClient, input: { actorId: string; intentKey: string; requestId: string; targetUserId: string; acceptedRevision: string }): Promise<StatisticsRefresh> {
  const { rows } = await db.query(`INSERT INTO admin_statistics_refreshes(id,actor_id,intent_key,request_id,target_user_id,accepted_revision) VALUES($1,$2,$3,$4,$5,$6) RETURNING ${COLUMNS}`,
    [randomUUID(), input.actorId, input.intentKey.toLowerCase(), input.requestId, input.targetUserId, input.acceptedRevision]);
  return project(rows[0]!);
}

/**
 * Binds each refresh to the newest valid snapshot that sealed the same user's accepted or later
 * revision (sealed per-user inputs, never time or a global maximum). A READY refresh follows newer
 * qualifying snapshots, so intents resolved at different times converge on one selectable snapshot;
 * one whose snapshot was revoked or left the privacy epoch reopens first.
 */
export async function resolveStatisticsRefreshes(db: Db, refreshId?: string): Promise<number> {
  await db.query(`UPDATE admin_statistics_refreshes r SET state='PENDING',snapshot_id=NULL,updated_at=clock_timestamp()
    FROM analytics_snapshots s WHERE r.state='READY' AND s.id=r.snapshot_id AND ($1::uuid IS NULL OR r.id=$1)
    AND (s.revoked_at IS NOT NULL OR s.privacy_epoch<>(SELECT epoch FROM privacy_control WHERE id=1))`, [refreshId ?? null]);
  const { rowCount } = await db.query(`UPDATE admin_statistics_refreshes r SET state='READY',snapshot_id=m.snapshot_id,failure_code=NULL,updated_at=clock_timestamp()
    FROM (SELECT DISTINCT ON (o.id) o.id,i.snapshot_id FROM admin_statistics_refreshes o
      JOIN analytics_snapshot_classification_inputs i ON i.user_id=o.target_user_id AND i.revision>=o.accepted_revision
      JOIN analytics_snapshots s ON s.id=i.snapshot_id AND s.revoked_at IS NULL AND s.privacy_epoch=(SELECT epoch FROM privacy_control WHERE id=1)
      WHERE ($1::uuid IS NULL OR o.id=$1) ORDER BY o.id,s.as_of DESC,s.id DESC) m
    WHERE r.id=m.id AND (r.state<>'READY' OR r.snapshot_id IS DISTINCT FROM m.snapshot_id)`, [refreshId ?? null]);
  return rowCount ?? 0;
}

/** Only the original actor can observe its intent; anyone else gets the same NOT_FOUND. */
export async function readStatisticsRefresh(pool: Pool, refreshId: string, actorId: string): Promise<StatisticsRefresh> {
  const { rows: owned } = await pool.query(`SELECT 1 FROM admin_statistics_refreshes WHERE id=$1 AND actor_id=$2`, [refreshId, actorId]);
  if (!owned.length) throw new DomainError('NOT_FOUND', 'This statistics refresh is unavailable.');
  await resolveStatisticsRefreshes(pool, refreshId);
  const { rows } = await pool.query(`SELECT ${COLUMNS} FROM admin_statistics_refreshes WHERE id=$1`, [refreshId]);
  return project(rows[0]!);
}

/**
 * Lost-response recovery for the caller's own classifyUser intent (P09-R01). The caller presents
 * the frozen target and the accepted revision from the original-intent receipt; any mismatch,
 * other actor or unknown key is the same NOT_FOUND. Never replays classify, never creates a job.
 */
export async function readStatisticsRefreshByIntent(pool: Pool, input: { actorId: string; intentKey: string; targetUserId: string; acceptedRevision: string }): Promise<StatisticsRefresh> {
  const { rows } = await pool.query<{ id: string }>(`SELECT id FROM admin_statistics_refreshes WHERE actor_id=$1 AND intent_key=$2 AND target_user_id=$3 AND accepted_revision=$4::bigint`,
    [input.actorId, input.intentKey.toLowerCase(), input.targetUserId.toLowerCase(), input.acceptedRevision]);
  if (!rows[0]) throw new DomainError('NOT_FOUND', 'This statistics refresh is unavailable.');
  return readStatisticsRefresh(pool, rows[0].id, input.actorId);
}

/** Accepted classification, failed statistics: reopen the statistics only. Zero classification writes. */
export async function retryStatisticsRefresh(db: PoolClient, refreshId: string, actorId: string): Promise<StatisticsRefresh> {
  const { rows } = await db.query(`SELECT ${COLUMNS},actor_id FROM admin_statistics_refreshes WHERE id=$1 FOR UPDATE`, [refreshId]);
  if (!rows[0] || rows[0].actor_id !== actorId) throw new DomainError('NOT_FOUND', 'This statistics refresh is unavailable.');
  if (rows[0].state !== 'FAILED') return project(rows[0]);
  const { rows: reopened } = await db.query(`UPDATE admin_statistics_refreshes SET state='PENDING',failure_code=NULL,attempts=0,updated_at=clock_timestamp() WHERE id=$1 RETURNING ${COLUMNS}`, [refreshId]);
  return project(reopened[0]!);
}

/**
 * Worker step (wired by the worker owner): seal one snapshot when refreshes are pending. A failed
 * seal fails exactly the refreshes it was attempted for; a successful seal that could not see a
 * still-committing classification keeps it pending for a bounded number of further seals.
 */
export async function statisticsRefreshTick(pool: Pool, seal: () => Promise<string>, maxAttempts = MAX_ATTEMPTS): Promise<{ sealed: string | null; ready: number; failed: number }> {
  let ready = await resolveStatisticsRefreshes(pool);
  const { rows } = await pool.query<{ id: string }>(`SELECT id FROM admin_statistics_refreshes WHERE state='PENDING' ORDER BY created_at LIMIT 500`);
  if (!rows.length) return { sealed: null, ready, failed: 0 };
  const ids = rows.map(r => r.id);
  let sealed: string;
  try { sealed = await seal(); } catch {
    const { rowCount } = await pool.query(`UPDATE admin_statistics_refreshes SET state='FAILED',failure_code='SNAPSHOT_FAILED',attempts=attempts+1,updated_at=clock_timestamp() WHERE id=ANY($1::uuid[]) AND state='PENDING'`, [ids]);
    return { sealed: null, ready, failed: rowCount ?? 0 };
  }
  ready += await resolveStatisticsRefreshes(pool);
  const { rows: exhausted } = await pool.query(`UPDATE admin_statistics_refreshes SET attempts=attempts+1,updated_at=clock_timestamp(),
    state=CASE WHEN attempts+1>=$2 THEN 'FAILED' ELSE state END,failure_code=CASE WHEN attempts+1>=$2 THEN 'NOT_INCORPORATED' ELSE NULL END
    WHERE id=ANY($1::uuid[]) AND state='PENDING' RETURNING state`, [ids, maxAttempts]);
  return { sealed, ready, failed: exhausted.filter(r => r.state === 'FAILED').length };
}
