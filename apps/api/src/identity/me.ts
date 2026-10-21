import type { Pool, PoolClient } from 'pg';
import type { AuthContext } from '../http/context.ts';
import { csrfTokenFor } from '../http/security.ts';

/**
 * Own private projection. Profile fields arrive with T05 (profiles table); until then they are
 * empty and the gate lists them as missing — the gate is never reported complete by default.
 */
export async function loadMe(db: Pool | PoolClient, userId: string) {
  const { rows } = await db.query(
    `SELECT u.id, u.version, c.email, COALESCE(array_agg(r.role ORDER BY r.role) FILTER (WHERE r.role IS NOT NULL), '{}') AS roles
       FROM users u LEFT JOIN private_contact c ON c.user_id = u.id LEFT JOIN roles r ON r.user_id = u.id
      WHERE u.id = $1 GROUP BY u.id, u.version, c.email`,
    [userId],
  );
  const r = rows[0];
  return {
    id: r.id as string,
    version: r.version as string,
    displayName: null,
    avatarRef: null,
    bio: null,
    languages: [],
    lifeStatus: null,
    interests: [],
    background: {},
    email: (r.email as string | null) ?? null,
    ageConfirmedVersion: null,
    communityAcceptedVersion: null,
    profileGate: {
      ageConfirmed: false,
      communityAccepted: false,
      profileComplete: false,
      missing: ['displayName', 'bio', 'languages', 'lifeStatus', 'interests', 'age', 'community'],
    },
    roles: r.roles as string[],
  };
}

export async function sessionInfo(db: Pool | PoolClient, auth: Pick<AuthContext, 'userId' | 'sessionId' | 'kind' | 'authTime' | 'amr'>, sessionSecret: string) {
  return {
    user: await loadMe(db, auth.userId),
    ...(auth.kind === 'WEB' ? { csrfToken: csrfTokenFor(sessionSecret, auth.sessionId) } : {}),
    authTime: auth.authTime.toISOString(),
    amr: auth.amr,
  };
}
