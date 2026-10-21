/**
 * Business-owned opaque sessions (core plan §5). Only SHA-256 hashes of tokens are stored.
 * Web: cookie token, 7-day idle / 30-day absolute. iOS: 15-minute access + rotating 30-day
 * refresh; reuse of a consumed refresh token revokes the whole family. Support CLI: 15-minute
 * access only. Every request re-checks revocation, expiry and users.status.
 */
import type { Pool, PoolClient } from 'pg';
import type { AuthContext } from '../http/context.ts';
import { randomToken, sha256Hex } from './tokens.ts';

export const WEB_IDLE_MS = 7 * 24 * 3600_000;
export const ABSOLUTE_MS = 30 * 24 * 3600_000;
export const ACCESS_TTL_MS = 15 * 60_000;
export type ClientKind = 'WEB' | 'IOS' | 'SUPPORT_CLI';
export type RevokeReason = 'LOGOUT' | 'REFRESH_REUSE' | 'ACCOUNT_DELETION' | 'LINK_SHELL' | 'SUPPORT';

export interface WebSession { token: string; sessionId: string; familyId: string; expiresAt: Date }
export interface IosCredentials { client: 'IOS'; accessToken: string; accessExpiresAt: Date; refreshToken: string; refreshExpiresAt: Date }
export interface CliCredentials { client: 'SUPPORT_CLI'; accessToken: string; accessExpiresAt: Date }

async function createFamily(db: PoolClient, userId: string, kind: ClientKind, amr: readonly string[], now: Date): Promise<{ id: string; absoluteExpiresAt: Date }> {
  const absoluteExpiresAt = new Date(now.getTime() + (kind === 'SUPPORT_CLI' ? ACCESS_TTL_MS : ABSOLUTE_MS));
  const { rows } = await db.query<{ id: string }>(
    `INSERT INTO session_families (user_id, kind, auth_time, amr, absolute_expires_at) VALUES ($1, $2, $3, $4, $5) RETURNING id`,
    [userId, kind, now, [...new Set(amr)], absoluteExpiresAt],
  );
  return { id: rows[0]!.id, absoluteExpiresAt };
}

export async function issueWebSession(db: PoolClient, userId: string, amr: readonly string[], now: Date): Promise<WebSession> {
  const family = await createFamily(db, userId, 'WEB', amr, now);
  const token = randomToken();
  const { rows } = await db.query<{ id: string }>(
    `INSERT INTO sessions (family_id, token_hash, expires_at, idle_timeout, last_used_at) VALUES ($1, $2, $3, make_interval(secs => $4::double precision / 1000), $5) RETURNING id`,
    [family.id, sha256Hex(token), family.absoluteExpiresAt, WEB_IDLE_MS, now],
  );
  return { token, sessionId: rows[0]!.id, familyId: family.id, expiresAt: family.absoluteExpiresAt };
}

async function issueAccess(db: PoolClient, familyId: string, now: Date, absolute: Date): Promise<{ token: string; expiresAt: Date }> {
  const token = randomToken();
  const expiresAt = new Date(Math.min(now.getTime() + ACCESS_TTL_MS, absolute.getTime()));
  await db.query(`INSERT INTO sessions (family_id, token_hash, expires_at, last_used_at) VALUES ($1, $2, $3, $4)`, [familyId, sha256Hex(token), expiresAt, now]);
  return { token, expiresAt };
}

export async function issueNativeCredentials(db: PoolClient, userId: string, client: 'IOS' | 'SUPPORT_CLI', amr: readonly string[], now: Date): Promise<{ familyId: string; credentials: IosCredentials | CliCredentials }> {
  const family = await createFamily(db, userId, client, amr, now);
  const access = await issueAccess(db, family.id, now, family.absoluteExpiresAt);
  if (client === 'SUPPORT_CLI') return { familyId: family.id, credentials: { client, accessToken: access.token, accessExpiresAt: access.expiresAt } };
  const refreshToken = randomToken();
  await db.query(`INSERT INTO refresh_tokens (family_id, token_hash, expires_at) VALUES ($1, $2, $3)`, [family.id, sha256Hex(refreshToken), family.absoluteExpiresAt]);
  return { familyId: family.id, credentials: { client, accessToken: access.token, accessExpiresAt: access.expiresAt, refreshToken, refreshExpiresAt: family.absoluteExpiresAt } };
}

/**
 * Resolves a presented token to its session. Revoked/expired/idle sessions, revoked families and
 * non-ACTIVE users all yield null. last_used_at is refreshed at most once a minute.
 */
export async function authenticateToken(pool: Pool, token: string, viaCookie: boolean): Promise<AuthContext | null> {
  if (!/^[A-Za-z0-9_-]{20,200}$/.test(token)) return null;
  const { rows } = await pool.query(
    `UPDATE sessions s SET last_used_at = CASE WHEN s.last_used_at < clock_timestamp() - interval '1 minute' THEN clock_timestamp() ELSE s.last_used_at END
       FROM session_families f, users u
      WHERE s.token_hash = $1 AND f.id = s.family_id AND u.id = f.user_id
        AND u.status = 'ACTIVE' AND f.revoked_at IS NULL
        AND s.expires_at > clock_timestamp() AND f.absolute_expires_at > clock_timestamp()
        AND (s.idle_timeout IS NULL OR s.last_used_at + s.idle_timeout > clock_timestamp())
        AND ((f.kind = 'WEB') = $2)
      RETURNING s.id AS session_id, f.id AS family_id, f.user_id, f.kind, f.auth_time, f.amr`,
    [sha256Hex(token), viaCookie],
  );
  const r = rows[0];
  if (!r) return null;
  return { userId: r.user_id, familyId: r.family_id, sessionId: r.session_id, kind: r.kind, authTime: r.auth_time, amr: r.amr, viaCookie };
}

export type RefreshOutcome = { kind: 'ok'; credentials: IosCredentials } | { kind: 'invalid' } | { kind: 'reuse' };

/** Rotates an iOS refresh token. Presenting an already-consumed token revokes the family. */
export async function rotateRefresh(db: PoolClient, presented: string, now: Date): Promise<RefreshOutcome> {
  const { rows } = await db.query(
    `SELECT r.id, r.consumed_at, r.expires_at, f.id AS family_id, f.revoked_at, f.absolute_expires_at, u.status
       FROM refresh_tokens r JOIN session_families f ON f.id = r.family_id JOIN users u ON u.id = f.user_id
      WHERE r.token_hash = $1 FOR UPDATE OF r, f`,
    [sha256Hex(presented)],
  );
  const r = rows[0];
  if (!r || r.revoked_at || r.status !== 'ACTIVE' || r.expires_at <= now || r.absolute_expires_at <= now) return { kind: 'invalid' };
  if (r.consumed_at) {
    await revokeFamily(db, r.family_id, 'REFRESH_REUSE');
    return { kind: 'reuse' };
  }
  await db.query(`UPDATE refresh_tokens SET consumed_at = $2 WHERE id = $1`, [r.id, now]);
  // Old access tokens of the family stop working once rotated.
  await db.query(`UPDATE sessions SET expires_at = LEAST(expires_at, $2) WHERE family_id = $1`, [r.family_id, now]);
  const access = await issueAccess(db, r.family_id, now, r.absolute_expires_at);
  const refreshToken = randomToken();
  await db.query(`INSERT INTO refresh_tokens (family_id, token_hash, parent_id, expires_at) VALUES ($1, $2, $3, $4)`, [r.family_id, sha256Hex(refreshToken), r.id, r.absolute_expires_at]);
  return { kind: 'ok', credentials: { client: 'IOS', accessToken: access.token, accessExpiresAt: access.expiresAt, refreshToken, refreshExpiresAt: r.absolute_expires_at } };
}

export async function revokeFamily(db: PoolClient | Pool, familyId: string, reason: RevokeReason): Promise<void> {
  await db.query(`UPDATE session_families SET revoked_at = clock_timestamp(), revoke_reason = $2 WHERE id = $1 AND revoked_at IS NULL`, [familyId, reason]);
}

/** Account deletion / shell tombstoning: every device of the user is signed out. */
export async function revokeAllForUser(db: PoolClient, userId: string, reason: RevokeReason): Promise<number> {
  const { rowCount } = await db.query(`UPDATE session_families SET revoked_at = clock_timestamp(), revoke_reason = $2 WHERE user_id = $1 AND revoked_at IS NULL`, [userId, reason]);
  return rowCount ?? 0;
}

/** Successful re-authentication refreshes auth_time (server clock) for the whole family. */
export async function markReauthenticated(db: PoolClient, familyId: string, amr: readonly string[], now: Date): Promise<void> {
  await db.query(`UPDATE session_families SET auth_time = $2, amr = (SELECT array_agg(DISTINCT x) FROM unnest(amr || $3::text[]) x) WHERE id = $1`, [familyId, now, [...amr]]);
}
