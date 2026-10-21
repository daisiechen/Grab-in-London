import type { Pool, PoolClient } from 'pg';
import type { AuthContext } from '../http/context.ts';
import { csrfTokenFor } from '../http/security.ts';

/** Private projection, shared by sign-in and profile endpoints. */
export async function loadMe(db: Pool | PoolClient, userId: string) {
  const { rows } = await db.query(
    `SELECT u.id, u.version, c.email, p.*, ARRAY(SELECT role FROM roles WHERE user_id = u.id ORDER BY role) AS roles
       FROM users u LEFT JOIN private_contact c ON c.user_id = u.id LEFT JOIN profiles p ON p.user_id = u.id
      WHERE u.id = $1`, [userId],
  );
  const r = rows[0]!;
  const ageConfirmed = r.age_confirmed_version === '2026-10-21';
  const communityAccepted = r.community_accepted_version === '2026-10-21';
  const missing = [
    ...(!r.display_name ? ['displayName'] : []), ...(!r.bio ? ['bio'] : []),
    ...(!r.languages?.length ? ['languages'] : []), ...(!r.life_status ? ['lifeStatus'] : []),
    ...(!r.interests?.length ? ['interests'] : []), ...(!ageConfirmed ? ['age'] : []),
    ...(!communityAccepted ? ['community'] : []),
  ];
  return {
    id: r.id as string, version: r.version as string,
    displayName: (r.display_name as string | null) ?? null,
    avatarRef: (r.avatar_ref as string | null) ?? null,
    bio: (r.bio as string | null) ?? null,
    languages: (r.languages as string[]) ?? [], lifeStatus: (r.life_status as string | null) ?? null,
    interests: (r.interests as string[]) ?? [], background: (r.background as Record<string, string>) ?? {},
    email: (r.email as string | null) ?? null,
    ageConfirmedVersion: (r.age_confirmed_version as string | null) ?? null,
    communityAcceptedVersion: (r.community_accepted_version as string | null) ?? null,
    profileGate: { ageConfirmed, communityAccepted, profileComplete: missing.length === 0, missing },
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
