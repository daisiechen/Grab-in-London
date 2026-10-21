/**
 * Maps a provider-verified identity to a business user (data contract §5, API §7):
 *  - known (issuer, subject) → that user;
 *  - unknown identity whose verified email matches an existing account → LINK_REQUIRED
 *    (no second user is created, nothing is merged);
 *  - otherwise a new user, identity and private contact.
 */
import type { PoolClient } from 'pg';
import { DomainError } from '../common/errors.ts';
import type { VerifiedIdentity } from './provider.ts';
import { normalizeEmail } from './tokens.ts';

export type Resolution =
  | { kind: 'user'; userId: string; created: boolean }
  | { kind: 'link_required'; targetUserId: string };

export async function resolveIdentity(db: PoolClient, identity: VerifiedIdentity, now: Date): Promise<Resolution> {
  const existing = await db.query<{ user_id: string; status: string }>(
    `SELECT i.user_id, u.status FROM identities i JOIN users u ON u.id = i.user_id WHERE i.issuer = $1 AND i.subject = $2`,
    [identity.issuer, identity.subject],
  );
  if (existing.rows[0]) {
    if (existing.rows[0].status !== 'ACTIVE') throw new DomainError('FORBIDDEN', 'This account is no longer available.');
    return { kind: 'user', userId: existing.rows[0].user_id, created: false };
  }
  const email = identity.email && identity.emailVerified ? normalizeEmail(identity.email) : null;
  if (email) {
    const match = await db.query<{ user_id: string }>(
      `SELECT c.user_id FROM private_contact c JOIN users u ON u.id = c.user_id WHERE c.email = $1 AND u.status = 'ACTIVE' ORDER BY c.user_id LIMIT 1`,
      [email],
    );
    if (match.rows[0]) return { kind: 'link_required', targetUserId: match.rows[0].user_id };
  }
  const { rows } = await db.query<{ id: string }>(`INSERT INTO users DEFAULT VALUES RETURNING id`);
  const userId = rows[0]!.id;
  const inserted = await db.query(
    `INSERT INTO identities (user_id, issuer, subject, provider, email_verified) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (issuer, subject) DO NOTHING`,
    [userId, identity.issuer, identity.subject, identity.provider, identity.emailVerified],
  );
  if (inserted.rowCount !== 1) {
    // A concurrent first login created the mapping; roll back this attempt and retry cleanly.
    throw Object.assign(new Error('identity created concurrently'), { code: '40001' });
  }
  if (email) await db.query(`INSERT INTO private_contact (user_id, email, email_verified_at) VALUES ($1, $2, $3)`, [userId, email, now]);
  return { kind: 'user', userId, created: true };
}

/** Whether the identity belongs to the given user (used by re-authentication). */
export async function identityBelongsTo(db: PoolClient, identity: VerifiedIdentity, userId: string): Promise<boolean> {
  const { rows } = await db.query(`SELECT 1 FROM identities WHERE issuer = $1 AND subject = $2 AND user_id = $3`, [identity.issuer, identity.subject, userId]);
  return rows.length === 1;
}

/**
 * Tables holding business facts. A legacy second account is a removable provisional shell only
 * if none of them reference it; slices register their user-owned tables as they land.
 */
const FACT_TABLES: Array<{ table: string; column: string }> = [
  { table: 'profiles', column: 'user_id' },
  { table: 'product_surveys', column: 'user_id' },
  { table: 'roles', column: 'user_id' },
  { table: 'idempotency', column: 'actor_id' },
  { table: 'membership_intervals', column: 'user_id' },
  { table: 'notifications', column: 'recipient_id' },
];
export function registerUserFactTable(table: string, column: string): void {
  if (!/^[a-z_]+$/.test(table) || !/^[a-z_]+$/.test(column)) throw new Error('invalid identifier');
  if (!FACT_TABLES.some((t) => t.table === table && t.column === column)) FACT_TABLES.push({ table, column });
}

export async function isProvisionalShell(db: PoolClient, userId: string): Promise<boolean> {
  for (const { table, column } of FACT_TABLES) {
    const { rows } = await db.query(`SELECT 1 FROM ${table} WHERE ${column} = $1 LIMIT 1`, [userId]);
    if (rows.length) return false;
  }
  return true;
}
