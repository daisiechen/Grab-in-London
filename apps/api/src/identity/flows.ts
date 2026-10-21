/**
 * Completion of a provider-verified authentication (email OTP or OAuth callback), shared by login,
 * re-authentication and the LINK_REQUIRED branch. Runs inside one transaction after the provider
 * call; the auth transaction row was already consumed atomically.
 */
import type { FastifyReply } from 'fastify';
import { DomainError } from '../common/errors.ts';
import type { Tx } from '../common/transaction.ts';
import type { AppDeps, AuthContext } from '../http/context.ts';
import type { HandlerResult } from '../http/routes.ts';
import { cookieOptions, LINK_BINDER_COOKIE, SESSION_COOKIE } from '../http/security.ts';
import type { VerifiedIdentity } from './provider.ts';
import { identityBelongsTo, resolveIdentity } from './resolve.ts';
import { sessionInfo } from './me.ts';
import { ABSOLUTE_MS, issueWebSession, markReauthenticated } from './sessions.ts';
import { randomToken, sha256Hex } from './tokens.ts';

export const HANDOFF_TTL_MS = 60_000;
export const LINK_TTL_MS = 10 * 60_000;

export interface AuthTxRow {
  id: string;
  kind: 'EMAIL_OTP' | 'OAUTH';
  purpose: 'LOGIN' | 'REAUTH';
  client: 'WEB' | 'IOS' | 'SUPPORT_CLI';
  user_id: string | null;
  app_challenge: string | null;
  return_target: string | null;
  provider_state: Record<string, string>;
}

export async function completeAuthentication(deps: AppDeps, tx: Tx, row: AuthTxRow, identity: VerifiedIdentity, current: AuthContext | null): Promise<HandlerResult> {
  const now = await tx.effectiveNow();
  const authProof = row.id;

  if (row.purpose === 'REAUTH') {
    const familyId = row.provider_state.familyId;
    if (!row.user_id || !familyId || !current || current.familyId !== familyId || current.userId !== row.user_id) {
      throw new DomainError('FORBIDDEN', 'Re-authentication must finish on the device that started it.');
    }
    if (!(await identityBelongsTo(tx.client, identity, row.user_id))) throw new DomainError('FORBIDDEN', 'Sign in with an account already linked to you.');
    await markReauthenticated(tx.client, familyId, identity.amr, now);
    await tx.client.query(`UPDATE auth_transactions SET result_family_id = $2 WHERE id = $1`, [row.id, familyId]);
    const session = await sessionInfo(tx.client, { ...current, authTime: now, amr: [...new Set([...current.amr, ...identity.amr])] }, deps.config.sessionSecret);
    return { data: { outcome: 'AUTHENTICATED', session, authProof } };
  }

  const resolution = await resolveIdentity(tx.client, identity, now);
  if (resolution.kind === 'link_required') {
    const ticket = randomToken();
    const binder = row.client === 'WEB' ? randomToken() : null;
    if (row.client !== 'WEB' && !row.app_challenge) throw new DomainError('VALIDATION_FAILED', 'appChallenge is required for native sign-in.');
    const expiresAt = new Date(now.getTime() + LINK_TTL_MS);
    await tx.client.query(
      `INSERT INTO auth_transactions (kind, client, user_id, secret_hash, binder_hash, app_challenge, provider, provider_state, expires_at, created_at)
       VALUES ('LINK', $1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [row.client, resolution.targetUserId, sha256Hex(ticket), binder && sha256Hex(binder), row.client === 'WEB' ? null : row.app_challenge, identity.provider,
        JSON.stringify({ issuer: identity.issuer, subject: identity.subject, emailVerified: String(identity.emailVerified) }), expiresAt, now],
    );
    return {
      data: { outcome: 'LINK_REQUIRED', linkTicket: ticket, expiresAt: expiresAt.toISOString() },
      ...(binder ? { after: (reply: FastifyReply) => void reply.setCookie(LINK_BINDER_COOKIE, binder, cookieOptions(LINK_TTL_MS / 1000)) } : {}),
    };
  }

  if (row.client === 'WEB') {
    const web = await issueWebSession(tx.client, resolution.userId, identity.amr, now);
    await tx.client.query(`UPDATE auth_transactions SET result_family_id = $2 WHERE id = $1`, [row.id, web.familyId]);
    const session = await sessionInfo(tx.client, { userId: resolution.userId, sessionId: web.sessionId, kind: 'WEB', authTime: now, amr: identity.amr }, deps.config.sessionSecret);
    return {
      data: { outcome: 'AUTHENTICATED', session, authProof, ...(row.return_target ? { returnTarget: row.return_target } : {}) },
      after: (reply) => void reply.setCookie(SESSION_COOKIE, web.token, cookieOptions(ABSOLUTE_MS / 1000)),
    };
  }

  if (!row.app_challenge) throw new DomainError('VALIDATION_FAILED', 'appChallenge is required for native sign-in.');
  const handoffCode = randomToken();
  await tx.client.query(
    `INSERT INTO auth_transactions (kind, client, user_id, secret_hash, app_challenge, provider_state, expires_at, created_at)
     VALUES ('HANDOFF', $1, $2, $3, $4, $5, $6, $7)`,
    [row.client, resolution.userId, sha256Hex(handoffCode), row.app_challenge, JSON.stringify({ amr: identity.amr.join(' '), origin: row.id }), new Date(now.getTime() + HANDOFF_TTL_MS), now],
  );
  return { data: { outcome: 'AUTHENTICATED', handoffCode, authProof } };
}
