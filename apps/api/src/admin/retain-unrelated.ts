import type { PoolClient } from 'pg';

/** Caller holds this deletion user's UPDATE barrier and privacy_control UPDATE until commit.
 * Only a sealed history strictly before the user's existence proves it cannot include them.
 * Missing subject-index membership alone is insufficient. Old/stale/revoked epochs stay closed.
 * Snapshot publication also holds privacy_control, so an old-epoch builder cannot race this lift. */
export async function retainPreAccountSnapshots(db: PoolClient, userId: string, previousEpoch: bigint): Promise<void> {
  const nextEpoch = previousEpoch + 1n;
  const { rows } = await db.query<{ id: string }>(
    `UPDATE analytics_snapshots s SET privacy_epoch=$3
     WHERE s.revoked_at IS NULL AND s.privacy_epoch=$2
       AND s.as_of<(SELECT created_at FROM users WHERE id=$1)
       AND NOT EXISTS(SELECT 1 FROM analytics_snapshot_subjects d WHERE d.snapshot_id=s.id AND d.user_id=$1)
       AND (SELECT epoch FROM privacy_control WHERE id=1)=$3
     RETURNING s.id`, [userId, previousEpoch.toString(), nextEpoch.toString()],
  );
  if (!rows.length) return;
  await db.query(`UPDATE analytics_exports SET privacy_epoch=$3 WHERE snapshot_id=ANY($1::uuid[]) AND revoked_at IS NULL AND privacy_epoch=$2`, [rows.map(row => row.id), previousEpoch.toString(), nextEpoch.toString()]);
}
