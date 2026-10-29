import type { FastifyInstance, FastifyRequest } from 'fastify';
import { isAllowedReturnTarget } from '@fancy/contracts';
import { DomainError } from '../common/errors.ts';
import { appendAudit } from '@fancy/db';
import { withTransaction } from '../common/transaction.ts';
import { lockActiveActor } from '../common/actor.ts';
import { invalidateUserAI,revokeGuestAI } from '../assistant/invalidate.ts';
import type { AppDeps } from '../http/context.ts';
import { defineRoute, defineWrite } from '../http/routes.ts';
import { assertWebOrigin, cookieOptions, keyedHash, LINK_BINDER_COOKIE, OAUTH_BINDER_COOKIE, SESSION_COOKIE } from '../http/security.ts';
import { completeAuthentication, type AuthTxRow } from './flows.ts';
import { normalizeSignupSource, type SignupSourceInput } from './signup-source.ts';
import { sessionInfo } from './me.ts';
import { ProviderRejectedError, ProviderUnavailableError, type IdentityProvider, type VerifiedIdentity } from './provider.ts';
import { isProvisionalShell, suspendedError } from './resolve.ts';
import { assertFreshAuth } from './reauth.ts';
import { authenticateToken, issueNativeCredentials, revokeAllForUser, revokeFamily, rotateRefresh } from './sessions.ts';
import { normalizeEmail, pkceChallenge, randomToken, sha256Hex, verifyPkce } from './tokens.ts';

export const OTP_TTL_MS = 5 * 60_000;
export const OTP_RESEND_MS = 30_000;
export const OTP_WINDOW_MS = 15 * 60_000;
export const OTP_PER_WINDOW = 5;
export const OAUTH_TTL_MS = 10 * 60_000;

type Body<T> = { body: T };
const asBody = <T>(request: FastifyRequest) => (request as unknown as Body<T>).body;

async function callProvider<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (error instanceof ProviderUnavailableError) throw new DomainError('PROVIDER_UNAVAILABLE', 'Sign-in is temporarily unavailable. Please try again shortly.', { retryAfterSeconds: 30 });
    if (error instanceof ProviderRejectedError) throw new DomainError('STATE_CONFLICT', 'Sign-in could not be completed. Please start again.');
    throw error;
  }
}

function checkReturnTarget(target: string | undefined): string | null {
  if (target === undefined) return null;
  if (!isAllowedReturnTarget(target)) throw new DomainError('VALIDATION_FAILED', 'Unsupported return target.', { fieldErrors: { 'body.returnTarget': 'Not allowed' } });
  return target;
}

/** Creates/dedupes an OTP challenge under shared email and IP quota locks. */
async function startOtp(deps: AppDeps, request: FastifyRequest, o: { clientRequestId: string; email: string; client: AuthTxRow['client']; purpose: 'LOGIN' | 'REAUTH'; userId: string | null; familyId: string | null; returnTarget: string | null; signupSource?: string | null }) {
  const emailHash = keyedHash(deps.config.sessionSecret, 'email', o.email);
  const ipHash = keyedHash(deps.config.sessionSecret, 'ip', request.ip);
  const created = await withTransaction(deps.pool, async (tx) => {
    // Domain-prefixed opaque keys share one deterministic order for LOGIN and REAUTH.
    // Different email addresses still serialize when they consume the same IP budget.
    for(const key of [`otp:email:${emailHash}`,`otp:ip:${ipHash}`].sort()) {
      await tx.client.query(`SELECT pg_advisory_xact_lock(hashtextextended($1, 0))`, [key]);
    }
    const dup = await tx.client.query(`SELECT id, email_hash, expires_at, created_at, consumed_at FROM auth_transactions WHERE kind = 'EMAIL_OTP' AND client_request_id = $1`, [o.clientRequestId]);
    if (dup.rows[0]) {
      if (dup.rows[0].email_hash !== emailHash) throw new DomainError('IDEMPOTENCY_CONFLICT', 'This request id was already used.');
      return { row: dup.rows[0], fresh: false };
    }
    const now = await tx.effectiveNow();
    const windowStart = new Date(now.getTime() - OTP_WINDOW_MS);
    const { rows: [rate] } = await tx.client.query(
      `SELECT count(*) FILTER (WHERE email_hash = $1) AS by_email, count(*) FILTER (WHERE ip_hash = $2) AS by_ip,
              max(created_at) FILTER (WHERE email_hash = $1) AS last_email,
              min(created_at) FILTER (WHERE email_hash = $1) AS first_email
         FROM auth_transactions WHERE kind = 'EMAIL_OTP' AND created_at > $3 AND (email_hash = $1 OR ip_hash = $2)`,
      [emailHash, ipHash, windowStart],
    );
    if (rate.last_email && now.getTime() - rate.last_email.getTime() < OTP_RESEND_MS) {
      throw new DomainError('RATE_LIMITED', 'Please wait before requesting another code.', { retryAfterSeconds: Math.ceil((OTP_RESEND_MS - (now.getTime() - rate.last_email.getTime())) / 1000) });
    }
    if (Number(rate.by_email) >= OTP_PER_WINDOW || Number(rate.by_ip) >= OTP_PER_WINDOW) {
      const retry = rate.first_email ? Math.ceil((rate.first_email.getTime() + OTP_WINDOW_MS - now.getTime()) / 1000) : OTP_WINDOW_MS / 1000;
      throw new DomainError('RATE_LIMITED', 'Too many codes requested. Please try again later.', { retryAfterSeconds: Math.max(1, retry) });
    }
    const { rows } = await tx.client.query(
      `INSERT INTO auth_transactions (kind, purpose, client, client_request_id, user_id, email_hash, ip_hash, provider, provider_state, return_target, expires_at, created_at)
       VALUES ('EMAIL_OTP', $1, $2, $3, $4, $5, $6, 'EMAIL', $7, $8, $9, $10) RETURNING id, expires_at, created_at`,
      [o.purpose, o.client, o.clientRequestId, o.userId, emailHash, ipHash, JSON.stringify({ email: o.email, ...(o.familyId ? { familyId: o.familyId } : {}), ...(o.signupSource ? { signupSource: o.signupSource } : {}) }), o.returnTarget, new Date(now.getTime() + OTP_TTL_MS), now],
    );
    return { row: rows[0], fresh: true };
  });
  if (created.fresh) {
    try {
      const state = await callProvider(() => deps.identity.startEmailOtp(o.email));
      await deps.pool.query(`UPDATE auth_transactions SET provider_state = provider_state || $2 WHERE id = $1`, [created.row.id, JSON.stringify(state)]);
    } catch (error) {
      // Not delivered: retire the challenge so it does not count as a usable code.
      await deps.pool.query(`UPDATE auth_transactions SET consumed_at = clock_timestamp() WHERE id = $1`, [created.row.id]);
      throw error;
    }
  }
  return {
    challengeId: created.row.id as string,
    expiresAt: (created.row.expires_at as Date).toISOString(),
    resendAfter: new Date((created.row.created_at as Date).getTime() + OTP_RESEND_MS).toISOString(),
  };
}

/** Creates an OAUTH transaction; Web transactions are bound to this browser by a cookie. */
async function startOAuthTx(deps: AppDeps, o: { provider: 'GOOGLE' | 'APPLE'; client: AuthTxRow['client']; purpose: 'LOGIN' | 'REAUTH'; userId: string | null; familyId: string | null; returnTarget: string | null; appChallenge: string | null; loopbackRedirectUri?: string; signupSource?: string | null }) {
  const redirectUri = redirectUriFor(deps, o.client);
  const state = randomToken();
  const nonce = randomToken();
  const verifier = randomToken(48);
  const binder = o.client === 'WEB' ? randomToken() : null;
  const { rows } = await deps.pool.query(
    `INSERT INTO auth_transactions (kind, purpose, client, user_id, secret_hash, binder_hash, app_challenge, provider, provider_state, return_target, expires_at)
     VALUES ('OAUTH', $1, $2, $3, $4, $5, $6, $7, $8, $9, clock_timestamp() + make_interval(secs => $10::double precision / 1000)) RETURNING id, expires_at`,
    [o.purpose, o.client, o.userId, sha256Hex(state), binder && sha256Hex(binder), o.appChallenge, o.provider,
      JSON.stringify({ nonce, verifier, redirectUri, ...(o.loopbackRedirectUri ? { loopbackRedirectUri: o.loopbackRedirectUri } : {}), ...(o.familyId ? { familyId: o.familyId } : {}), ...(o.signupSource ? { signupSource: o.signupSource } : {}) }), o.returnTarget, OAUTH_TTL_MS],
  );
  const authorizationUrl = deps.identity.authorizationUrl({ provider: o.provider, state, nonce, codeChallenge: pkceChallenge(verifier), redirectUri, forceLogin: o.purpose === 'REAUTH' });
  return { id: rows[0].id as string, expiresAt: (rows[0].expires_at as Date).toISOString(), authorizationUrl, binder };
}

function redirectUriFor(deps: AppDeps, client: AuthTxRow['client']): string {
  if (client === 'WEB') return `${deps.config.webOrigin}/auth/callback`;
  // CLI must navigate through the HTTP callback, never the SPA's fetch-based callback bridge.
  if (client === 'SUPPORT_CLI') return `${deps.config.webOrigin}/v1/auth/oauth/callback`;
  if (client === 'IOS') {
    if (!deps.config.iosRedirectUri) throw new DomainError('FORBIDDEN', 'iOS sign-in is not configured.');
    return deps.config.iosRedirectUri;
  }
  throw new DomainError('FORBIDDEN', 'Sign-in is not available for this client.');
}

function cliLoopback(client: AuthTxRow['client'], uri: string | undefined): string | undefined {
  if (client !== 'SUPPORT_CLI') {
    if (uri !== undefined) throw new DomainError('VALIDATION_FAILED', 'Loopback redirects are only available to the support CLI.');
    return undefined;
  }
  // Match the raw input, before URL normalization can hide userinfo/encoded paths/alternate IPs.
  const match = typeof uri === 'string' ? /^http:\/\/127\.0\.0\.1:([1-9][0-9]{3,4})\/auth\/callback$/.exec(uri) : null;
  if (!match || Number(match[1]) < 1024 || Number(match[1]) > 65535) throw new DomainError('VALIDATION_FAILED', 'A registered local support CLI callback is required.');
  return uri;
}

/** Atomically consumes a transaction; a second use (replay/race) gets STATE_CONFLICT. */
async function consume(deps: AppDeps, id: string): Promise<void> {
  const { rowCount } = await deps.pool.query(`UPDATE auth_transactions SET consumed_at = clock_timestamp() WHERE id = $1 AND consumed_at IS NULL AND expires_at > clock_timestamp()`, [id]);
  if (rowCount !== 1) throw new DomainError('STATE_CONFLICT', 'This sign-in step has already been used or expired. Please start again.');
}

async function finish(deps: AppDeps, row: AuthTxRow, identity: VerifiedIdentity, request: FastifyRequest) {
  // Browser cookies are not the CLI identity and must not switch/revoke a browser account.
  if (row.client === 'SUPPORT_CLI') return withTransaction(deps.pool, (tx) => completeAuthentication(deps, tx, row, identity, null));
  const current = await authFromRequest(deps, request);
  const bearerGuest=/^Bearer ([A-Za-z0-9_-]{43})$/.exec(request.headers.authorization??'')?.[1];
  const guestToken=request.cookies['__Host-fancy_guest']??bearerGuest;
  return withTransaction(deps.pool, (tx) => completeAuthentication(deps, tx, row, identity, current,guestToken));
}

async function authFromRequest(deps: AppDeps, request: FastifyRequest) {
  const header = request.headers.authorization;
  if (typeof header === 'string' && header.startsWith('Bearer ')) return authenticateToken(deps.pool, header.slice(7), false);
  const cookie = request.cookies[SESSION_COOKIE];
  return cookie ? authenticateToken(deps.pool, cookie, true) : null;
}

export function registerIdentityRoutes(app: FastifyInstance, deps: AppDeps): void {
  defineRoute(app, deps, 'startEmail', async ({ request }) => {
    const body = asBody<{ clientRequestId: string; email: string; client: AuthTxRow['client']; returnTarget?: string; signupSource?: SignupSourceInput }>(request);
    if (body.client === 'WEB') assertWebOrigin(request, deps.config.webOrigin);
    if (body.client === 'SUPPORT_CLI') throw new DomainError('FORBIDDEN', 'Support CLI uses browser sign-in.');
    const data = await startOtp(deps, request, { clientRequestId: body.clientRequestId, email: normalizeEmail(body.email), client: body.client, purpose: 'LOGIN', userId: null, familyId: null, returnTarget: checkReturnTarget(body.returnTarget), signupSource: normalizeSignupSource(body.signupSource) });
    return { data };
  });

  defineRoute(app, deps, 'verifyEmail', async ({ request }) => {
    const body = asBody<{ challengeId: string; code: string; appChallenge?: string; signupSource?: SignupSourceInput }>(request);
    const { rows } = await deps.pool.query(
      `UPDATE auth_transactions SET attempts = attempts + 1
        WHERE id = $1 AND kind = 'EMAIL_OTP' AND consumed_at IS NULL AND expires_at > clock_timestamp() AND attempts < max_attempts
        RETURNING id, kind, purpose, client, user_id, app_challenge, return_target, provider_state, attempts, max_attempts`,
      [body.challengeId],
    );
    const row = rows[0] as (AuthTxRow & { attempts: number; max_attempts: number }) | undefined;
    if (!row) throw new DomainError('STATE_CONFLICT', 'This code has expired or too many attempts were made. Request a new code.');
    if (row.client === 'WEB') assertWebOrigin(request, deps.config.webOrigin);
    if (row.client !== 'WEB' && row.purpose === 'LOGIN') {
      if (!body.appChallenge) throw new DomainError('VALIDATION_FAILED', 'appChallenge is required for native sign-in.', { fieldErrors: { 'body.appChallenge': 'Required' } });
      row.app_challenge = body.appChallenge;
    }
    const identity = await callProvider(() => deps.identity.verifyEmailOtp({ email: row.provider_state.email!, code: body.code, providerState: row.provider_state }));
    if (!identity) {
      const left = row.max_attempts - row.attempts;
      if (left <= 0) await deps.pool.query(`UPDATE auth_transactions SET consumed_at = clock_timestamp() WHERE id = $1`, [row.id]);
      throw new DomainError('VALIDATION_FAILED', left > 0 ? 'That code is not right. Check it and try again.' : 'Too many attempts. Request a new code.', { fieldErrors: { 'body.code': left > 0 ? `Incorrect code (${left} attempts left)` : 'No attempts left' } });
    }
    await consume(deps, row.id);
    if (row.app_challenge) await deps.pool.query(`UPDATE auth_transactions SET app_challenge = $2 WHERE id = $1`, [row.id, row.app_challenge]);
    // A source sent with the code wins over one sent when the code was requested.
    const verifySource = normalizeSignupSource(body.signupSource);
    if (verifySource && row.purpose === 'LOGIN') row.provider_state = { ...row.provider_state, signupSource: verifySource };
    return finish(deps, row, identity, request);
  });

  defineRoute(app, deps, 'startOAuth', async ({ request, reply }) => {
    const body = asBody<{ provider: 'GOOGLE' | 'APPLE'; client: AuthTxRow['client']; returnTarget?: string; appChallenge?: string; loopbackRedirectUri?: string; signupSource?: SignupSourceInput }>(request);
    if (body.client === 'WEB') assertWebOrigin(request, deps.config.webOrigin);
    if (body.client !== 'WEB' && !body.appChallenge) throw new DomainError('VALIDATION_FAILED', 'appChallenge is required for native sign-in.', { fieldErrors: { 'body.appChallenge': 'Required' } });
    const loopbackRedirectUri = cliLoopback(body.client, body.loopbackRedirectUri);
    const started = await startOAuthTx(deps, { provider: body.provider, client: body.client, purpose: 'LOGIN', userId: null, familyId: null, returnTarget: checkReturnTarget(body.returnTarget), appChallenge: body.appChallenge ?? null, ...(loopbackRedirectUri ? { loopbackRedirectUri } : {}), signupSource: body.client === 'SUPPORT_CLI' ? null : normalizeSignupSource(body.signupSource) });
    if (started.binder) reply.setCookie(OAUTH_BINDER_COOKIE, started.binder, cookieOptions(OAUTH_TTL_MS / 1000));
    return { data: { authorizationUrl: started.authorizationUrl, stateTransactionId: started.id } };
  });

  defineRoute(app, deps, 'oauthCallback', async ({ request, reply }) => {
    const query = (request.query ?? {}) as { code?: string; state: string; error?: string };
    const { rows } = await deps.pool.query(
      `SELECT id, kind, purpose, client, user_id, app_challenge, return_target, provider, provider_state, binder_hash
         FROM auth_transactions WHERE secret_hash = $1 AND kind = 'OAUTH' AND consumed_at IS NULL AND expires_at > clock_timestamp()`,
      [sha256Hex(query.state)],
    );
    const row = rows[0] as (AuthTxRow & { provider: 'GOOGLE' | 'APPLE'; binder_hash: string | null }) | undefined;
    if (!row) throw new DomainError('STATE_CONFLICT', 'This sign-in link has expired. Please start again.');
    if (row.binder_hash) {
      const binder = request.cookies[OAUTH_BINDER_COOKIE];
      if (!binder || sha256Hex(binder) !== row.binder_hash) throw new DomainError('STATE_CONFLICT', 'Finish sign-in in the browser where you started it.');
    }
    await consume(deps, row.id);
    if (row.binder_hash) reply.clearCookie(OAUTH_BINDER_COOKIE, { path: '/' });
    if (query.error || !query.code) throw new DomainError('STATE_CONFLICT', 'Sign-in was cancelled.');
    const identity = await callProvider(() => deps.identity.exchangeAuthorizationCode({ provider: row.provider, code: query.code!, codeVerifier: row.provider_state.verifier!, redirectUri: row.provider_state.redirectUri!, nonce: row.provider_state.nonce! }));
    const result = await finish(deps, row, identity, request);
    if (row.client !== 'SUPPORT_CLI') return result;
    const data = result.data as { outcome?: string; handoffCode?: string } | undefined;
    if (data?.outcome !== 'AUTHENTICATED' || !data.handoffCode) throw new DomainError('FORBIDDEN', 'Use an identity already linked to your support account.');
    const location = new URL(cliLoopback(row.client, row.provider_state.loopbackRedirectUri)!);
    location.search = new URLSearchParams({ code: data.handoffCode, state: row.id }).toString();
    return { status: 303, after: (response) => { response.header('location', location.toString()); response.header('cache-control', 'no-store'); response.header('referrer-policy', 'no-referrer'); } };
  });

  defineRoute(app, deps, 'exchangeHandoff', async ({ request }) => {
    const body = asBody<{ code: string; appVerifier: string }>(request);
    return withTransaction(deps.pool, async (tx) => {
      const { rows } = await tx.client.query(
        `SELECT id, client, user_id, app_challenge, provider_state, attempts, max_attempts FROM auth_transactions
          WHERE secret_hash = $1 AND kind = 'HANDOFF' AND consumed_at IS NULL AND expires_at > clock_timestamp()`,
        [sha256Hex(body.code)],
      );
      const row = rows[0];
      if (!row) throw new DomainError('STATE_CONFLICT', 'This sign-in has expired. Please start again.');
      await lockActiveActor(tx,row.user_id,'update');
      const consumed=await tx.client.query(`UPDATE auth_transactions SET consumed_at=clock_timestamp(),attempts=attempts+1 WHERE id=$1 AND consumed_at IS NULL AND expires_at>clock_timestamp() RETURNING id`,[row.id]);
      if(consumed.rowCount!==1)throw new DomainError('STATE_CONFLICT','This sign-in has already been used or expired.');
      if (!verifyPkce(body.appVerifier, row.app_challenge)) {
        // A wrong verifier burns the code: the handoff is single-use for its rightful app only.
        throw new DomainError('STATE_CONFLICT', 'This sign-in could not be verified. Please start again.');
      }
      const guest=/^Bearer ([A-Za-z0-9_-]{43})$/.exec(request.headers.authorization??'');
      if(guest&&deps.assistantRuntime)await revokeGuestAI(tx.client,deps.assistantRuntime,guest[1]!);
      const now = await tx.effectiveNow();
      const { familyId, credentials } = await issueNativeCredentials(tx.client, row.user_id, row.client, String(row.provider_state.amr).split(' '), now);
      if (row.provider_state.origin) await tx.client.query(`UPDATE auth_transactions SET result_family_id = $2 WHERE id = $1`, [row.provider_state.origin, familyId]);
      return { data: credentials };
    }, { commitOnDomainError: true });
  });

  defineRoute(app, deps, 'refreshSession', async ({ request }) => {
    const body = asBody<{ refreshToken: string }>(request);
    const outcome = await withTransaction(deps.pool, async (tx) => {
      const {rows:[family]}=await tx.client.query<{user_id:string}>(`SELECT sf.user_id FROM refresh_tokens r JOIN session_families sf ON sf.id=r.family_id WHERE r.token_hash=$1`,[sha256Hex(body.refreshToken)]);
      if(!family)throw new DomainError('AUTH_REQUIRED','Please sign in again.');
      const {rows:[owner]}=await tx.client.query<{status:string}>(`SELECT status FROM users WHERE id=$1`,[family.user_id]);
      if(owner?.status==='SUSPENDED')throw suspendedError();
      await lockActiveActor(tx,family.user_id,'update');
      return rotateRefresh(tx.client,body.refreshToken,await tx.effectiveNow());
    });
    if (outcome.kind !== 'ok') throw new DomainError('AUTH_REQUIRED', 'Please sign in again.');
    return { data: outcome.credentials };
  });

  defineRoute(app, deps, 'getSession', async ({ auth }) => ({ data: await sessionInfo(deps.pool, auth!, deps.config.sessionSecret) }));

  defineRoute(app, deps, 'logout', async ({ auth }) => {
    await withTransaction(deps.pool, async (tx) => {
      await lockActiveActor(tx, auth!.userId, 'update');
      await invalidateUserAI(tx.client, deps.assistantRuntime!, auth!.userId, 'LOGOUT');
      await revokeFamily(tx.client, auth!.familyId, 'LOGOUT');
    });
    return { status: 204, after: (reply) => void reply.clearCookie(SESSION_COOKIE, { path: '/' }) };
  });

  defineRoute(app, deps, 'startReauth', async ({ request, reply, auth }) => {
    const body = asBody<{ clientRequestId: string; method: 'EMAIL' | 'GOOGLE' | 'APPLE'; returnTarget?: string; appChallenge?: string }>(request);
    const returnTarget = checkReturnTarget(body.returnTarget);
    if (body.method === 'EMAIL') {
      const { rows } = await deps.pool.query<{ email: string }>(`SELECT email FROM private_contact WHERE user_id = $1`, [auth!.userId]);
      if (!rows[0]) throw new DomainError('VALIDATION_FAILED', 'No verified email on this account; use the original sign-in method.', { fieldErrors: { 'body.method': 'Unavailable' } });
      const started = await startOtp(deps, request, { clientRequestId: body.clientRequestId, email: rows[0].email, client: auth!.kind, purpose: 'REAUTH', userId: auth!.userId, familyId: auth!.familyId, returnTarget });
      return { status: 201, data: { challengeId: started.challengeId, expiresAt: started.expiresAt } };
    }
    const started = await startOAuthTx(deps, { provider: body.method, client: auth!.kind, purpose: 'REAUTH', userId: auth!.userId, familyId: auth!.familyId, returnTarget, appChallenge: body.appChallenge ?? null });
    if (started.binder) reply.setCookie(OAUTH_BINDER_COOKIE, started.binder, cookieOptions(OAUTH_TTL_MS / 1000));
    return { status: 201, data: { authorizationUrl: started.authorizationUrl, expiresAt: started.expiresAt } };
  });

  defineWrite(app, deps, 'linkIdentity', async ({ request, auth }, tx) => {
    const body = asBody<{ linkTicket: string; originalChallengeProof: string; appVerifier?: string }>(request);
    const { rows: [ticket] } = await tx.client.query(
      `SELECT id, client, user_id, binder_hash, app_challenge, provider, provider_state FROM auth_transactions
        WHERE secret_hash = $1 AND kind = 'LINK' AND consumed_at IS NULL AND expires_at > clock_timestamp()`,
      [sha256Hex(body.linkTicket)],
    );
    if (!ticket || ticket.user_id !== auth.userId) throw new DomainError('LINK_TICKET_INVALID', 'This link request has expired. Please sign in again.');
    const bound = ticket.binder_hash
      ? (() => { const b = request.cookies[LINK_BINDER_COOKIE]; return !!b && sha256Hex(b) === ticket.binder_hash; })()
      : !!body.appVerifier && verifyPkce(body.appVerifier, ticket.app_challenge);
    if (!bound) throw new DomainError('LINK_TICKET_INVALID', 'Finish linking on the device where you started.');
    const issuer: string = ticket.provider_state.issuer;
    const subject: string = ticket.provider_state.subject;
    const { rows: [mapped] } = await tx.client.query<{ user_id: string }>(`SELECT user_id FROM identities WHERE issuer = $1 AND subject = $2`, [issuer, subject]);
    const ids = mapped && mapped.user_id !== auth.userId ? [auth.userId, mapped.user_id] : [auth.userId];
    const lockedUsers=await tx.locks.lock<{id:string;status:string}>('users', ids, 'update','id,status');
    if(!lockedUsers.some(user=>user.id===auth.userId&&user.status==='ACTIVE'))throw new DomainError('AUTH_REQUIRED','Your session is no longer valid.');
    if(mapped&&mapped.user_id!==auth.userId&&!lockedUsers.some(user=>user.id===mapped.user_id&&user.status==='ACTIVE'))throw new DomainError('ACCOUNT_LINK_CONFLICT','This account is unavailable for linking.');
    // The hint determines the sorted user-lock set only. Lock tickets after users, as
    // deletion/purge also takes users before touching authentication transactions.
    const {rows:[currentTicket]}=await tx.client.query(`SELECT *,expires_at::text AS exact_expires_at FROM auth_transactions WHERE id=$1 AND secret_hash=$2 AND kind='LINK' FOR UPDATE`,[ticket.id,sha256Hex(body.linkTicket)]);
    if(!currentTicket||currentTicket.consumed_at||currentTicket.user_id!==auth.userId)throw new DomainError('LINK_TICKET_INVALID','This link request has expired. Please sign in again.');
    if(currentTicket.client!==ticket.client||currentTicket.provider!==ticket.provider||currentTicket.provider_state.issuer!==issuer||currentTicket.provider_state.subject!==subject)throw Object.assign(new Error('link target changed'),{code:'40001'});
    const currentBound=currentTicket.binder_hash
      ? (()=>{const b=request.cookies[LINK_BINDER_COOKIE];return !!b&&sha256Hex(b)===currentTicket.binder_hash;})()
      : !!body.appVerifier&&verifyPkce(body.appVerifier,currentTicket.app_challenge);
    if(!currentBound)throw new DomainError('LINK_TICKET_INVALID','Finish linking on the device where you started.');
    // Re-read under the user locks: the mapping must not have moved since discovery.
    const { rows: [recheck] } = await tx.client.query<{ user_id: string }>(`SELECT user_id FROM identities WHERE issuer = $1 AND subject = $2`, [issuer, subject]);
    if ((recheck?.user_id ?? null) !== (mapped?.user_id ?? null)) throw Object.assign(new Error('identity mapping changed'), { code: '40001' });
    await tx.effectiveNow();
    // Keep PostgreSQL microseconds for TTL predicates; JS Date alone would allow an
    // already-expired credential later in the same millisecond to pass the SQL check.
    const {rows:[authorizationClock]}=await tx.client.query<{instant:string}>(`SELECT clock_timestamp()::text AS instant`);
    const authorizationInstant=authorizationClock!.instant;const now=new Date(authorizationInstant);
    const {rows:[ticketTime]}=await tx.client.query<{valid:boolean}>(`SELECT $1::timestamptz>$2::timestamptz AS valid`,[currentTicket.exact_expires_at,authorizationInstant]);
    if(!ticketTime!.valid)throw new DomainError('LINK_TICKET_INVALID','This link request has expired. Please sign in again.');
    // Logout/refresh/deletion use the same user UPDATE barrier. Preflight authorization
    // may have become obsolete while this sensitive write waited for that lock.
    const {rows:[currentSession]}=await tx.client.query<{auth_time:Date}>(`SELECT f.auth_time FROM sessions s JOIN session_families f ON f.id=s.family_id WHERE s.id=$1 AND f.id=$2 AND f.user_id=$3 AND f.kind=$4 AND f.revoked_at IS NULL AND s.expires_at>$5 AND f.absolute_expires_at>$5 AND (s.idle_timeout IS NULL OR s.last_used_at+s.idle_timeout>$5)`,[auth.sessionId,auth.familyId,auth.userId,auth.kind,authorizationInstant]);
    if(!currentSession)throw new DomainError('AUTH_REQUIRED','Your session is no longer valid.');
    const {rows:[proof]}=await tx.client.query<{consumed_at:Date}>(`SELECT consumed_at FROM auth_transactions WHERE id=$1 AND result_family_id=$2 AND consumed_at IS NOT NULL`,[body.originalChallengeProof,auth.familyId]);
    if(!proof)throw new DomainError('REAUTH_REQUIRED','Please sign in with your original method again to link this account.');
    assertFreshAuth(currentSession.auth_time, now, 'Please sign in again to link this account.');
    assertFreshAuth(proof.consumed_at, now, 'Please sign in with your original method again to link this account.');
    if (!mapped) {
      await tx.client.query(`INSERT INTO identities (user_id, issuer, subject, provider, email_verified) VALUES ($1, $2, $3, $4, $5)`,
        [auth.userId, issuer, subject, ticket.provider, currentTicket.provider_state.emailVerified === 'true']);
    } else if (mapped.user_id !== auth.userId) {
      if (!(await isProvisionalShell(tx.client, mapped.user_id))) throw new DomainError('ACCOUNT_LINK_CONFLICT', 'Both accounts already have activity, so they cannot be linked.');
      await tx.client.query(`UPDATE identities SET user_id = $1, linked_at = clock_timestamp() WHERE issuer = $2 AND subject = $3`, [auth.userId, issuer, subject]);
      await revokeAllForUser(tx.client, mapped.user_id, 'LINK_SHELL');
      await tx.client.query(`UPDATE users SET status = 'DELETED', version = version + 1, updated_at = clock_timestamp() WHERE id = $1`, [mapped.user_id]);
      await appendAudit(tx.client, { actorKind: 'USER', actorId: auth.userId, action: 'identity.shell_tombstoned', aggregateType: 'user', aggregateId: mapped.user_id, requestId: request.id });
    }
    await tx.client.query(`UPDATE auth_transactions SET consumed_at = clock_timestamp() WHERE id = $1`, [ticket.id]);
    await appendAudit(tx.client, { actorKind: 'USER', actorId: auth.userId, action: 'identity.linked', aggregateType: 'user', aggregateId: auth.userId, requestId: request.id, payload: { provider: ticket.provider } });
    const { rows } = await tx.client.query(`SELECT provider, linked_at FROM identities WHERE user_id = $1 ORDER BY linked_at`, [auth.userId]);
    return {
      data: { identities: rows.map((r) => ({ provider: r.provider, linkedAt: (r.linked_at as Date).toISOString() })) },
      after: (reply) => void reply.clearCookie(LINK_BINDER_COOKIE, { path: '/' }),
    };
  });
}

export type { IdentityProvider };
