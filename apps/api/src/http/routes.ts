/**
 * Registers an operation from the contract registry: method/path/schemas come from the single
 * source, responses are serialised through the success envelope schema (unknown fields dropped),
 * and the auth mode, CSRF, If-Match and Idempotency-Key rules are enforced before the handler.
 */
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { AVATAR_MAX_BASE64_LENGTH, Meta, operationsById, PageInfo, T, type OperationDef, type OperationId } from '@fancy/contracts';
import { DomainError } from '../common/errors.ts';
import { claimIntent, completeIntent, releaseIntent, replayIfAuthorized } from '../common/idempotency.ts';
import { requestHash } from '../common/canonical.ts';
import { withTransaction, type Tx } from '../common/transaction.ts';
import { authenticateToken } from '../identity/sessions.ts';
import { suspendedError } from '../identity/resolve.ts';
import { sha256Hex } from '../identity/tokens.ts';
import type { AppDeps, AuthContext } from './context.ts';
import { domainErrorBody } from './errors.ts';
import { assertCsrf, assertWebOrigin, SESSION_COOKIE } from './security.ts';
import { enforceRateLimit } from './rate-limit.ts';
import { ownerOnlyReplay } from '../common/owner-replay.ts';

export interface HandlerResult {
  status?: number;
  data?: unknown;
  page?: { nextCursor: string | null; hasMore: boolean; scannedThroughSeq?: string };
  version?: string;
  resourceId?: string | null;
  /** Side effects on the HTTP response (cookies); applied after commit, also on replay none. */
  after?: (reply: FastifyReply) => void;
}

export interface HandlerContext {
  request: FastifyRequest;
  reply: FastifyReply;
  deps: AppDeps;
  auth: AuthContext | null;
  /** Parsed If-Match version for ifMatch operations. */
  ifMatch: string | null;
}

type Handler = (ctx: HandlerContext) => Promise<HandlerResult>;
type WriteHandler<P> = (ctx: HandlerContext & { auth: AuthContext; prepared:P }, tx: Tx) => Promise<HandlerResult>;

function envelopeSchema(def: OperationDef) {
  if (!def.success.data) return undefined;
  return def.success.list
    ? T.Object({ data: T.Array(def.success.data), page: PageInfo, meta: Meta }, { additionalProperties: false })
    : T.Object({ data: def.success.data, meta: Meta }, { additionalProperties: false });
}

export function envelope(request: FastifyRequest, result: HandlerResult) {
  const meta = { requestId: request.id, serverNow: new Date().toISOString(), ...(result.version ? { version: result.version } : {}) };
  return result.page ? { data: result.data, page: result.page, meta } : { data: result.data, meta };
}

async function authenticate(request: FastifyRequest, deps: AppDeps): Promise<AuthContext | null> {
  const header = request.headers.authorization;
  if (typeof header === 'string') {
    const match = /^Bearer ([A-Za-z0-9_-]{20,200})$/.exec(header);
    if (!match) return null;
    return authenticateToken(deps.pool, match[1]!, false);
  }
  const cookie = request.cookies[SESSION_COOKIE];
  return cookie ? authenticateToken(deps.pool, cookie, true) : null;
}

/** A presented credential whose account is suspended (its sessions were revoked on suspension). */
async function presentedTokenSuspended(request: FastifyRequest, deps: AppDeps): Promise<boolean> {
  const header = request.headers.authorization;
  const token = typeof header === 'string' ? /^Bearer ([A-Za-z0-9_-]{20,200})$/.exec(header)?.[1] : request.cookies[SESSION_COOKIE];
  if (!token || !/^[A-Za-z0-9_-]{20,200}$/.test(token)) return false;
  const { rows } = await deps.pool.query(`SELECT 1 FROM sessions s JOIN session_families f ON f.id = s.family_id JOIN users u ON u.id = f.user_id WHERE s.token_hash = $1 AND u.status = 'SUSPENDED'`, [sha256Hex(token)]);
  return rows.length === 1;
}

async function preflight(def: OperationDef, request: FastifyRequest, deps: AppDeps): Promise<{ auth: AuthContext | null; ifMatch: string | null }> {
  const auth = def.auth === 'public' || def.auth === 'receipt' ? null : await authenticate(request, deps);
  if ((def.auth === 'session' || def.auth === 'staff') && !auth) {
    if (await presentedTokenSuspended(request, deps)) throw suspendedError();
    throw new DomainError('AUTH_REQUIRED', 'Please sign in to continue.');
  }
  if (auth?.viaCookie && def.method !== 'GET') {
    assertWebOrigin(request, deps.config.webOrigin);
    assertCsrf(request, deps.config.sessionSecret, auth.sessionId);
  }
  if (def.auth === 'staff' && auth) {
    const { rows } = await deps.pool.query<{ role: string }>(`SELECT role FROM roles WHERE user_id = $1`, [auth.userId]);
    if (!rows.some((r) => (def.roles as readonly string[] | undefined)?.includes(r.role))) throw new DomainError('FORBIDDEN', 'You do not have access to this area.');
    if (!auth.amr.includes('mfa')) throw new DomainError('REAUTH_REQUIRED', 'Multi-factor sign-in is required for this area.');
  }
  let ifMatch: string | null = null;
  if (def.ifMatch) {
    const raw = request.headers['if-match'];
    if (raw === undefined) throw new DomainError('PRECONDITION_REQUIRED', 'This change needs the version you are editing.');
    const m = typeof raw === 'string' ? /^"(0|[1-9][0-9]{0,18})"$/.exec(raw) : null;
    if (!m) throw new DomainError('VALIDATION_FAILED', 'If-Match must be a quoted version.', { fieldErrors: { 'headers.if-match': 'Invalid version' } });
    ifMatch = m[1]!;
  }
  if (auth) await enforceRateLimit(deps.pool, auth.userId, def, request.url.split('?')[0]!);
  return { auth, ifMatch };
}

function restoreRetryAfter(reply:FastifyReply,body:unknown){
 if(body&&typeof body==='object'&&'error' in body){
  const error=body.error;
  if(error&&typeof error==='object'&&'retryAfterSeconds' in error&&typeof error.retryAfterSeconds==='number')reply.header('retry-after',String(error.retryAfterSeconds));
 }
}

const routePath = (def: OperationDef) => '/v1' + def.path.replace(/\{([A-Za-z]+)\}/g, ':$1');
/** Request body limits above the server-wide 64 KiB, per operation (base64 photo upload). */
const BODY_LIMITS: Partial<Record<OperationId, number>> = { uploadAvatar: AVATAR_MAX_BASE64_LENGTH + 64 * 1024 };
const bodyLimitFor = (id: OperationId) => (BODY_LIMITS[id] ? { bodyLimit: BODY_LIMITS[id] } : {});

function schemaFor(def: OperationDef) {
  const response = envelopeSchema(def);
  return {
    ...(def.params ? { params: def.params } : {}),
    ...(def.query ? { querystring: def.query } : {}),
    ...(def.body ? { body: def.body } : {}),
    ...(response ? { response: { [def.success.status]: response } } : {}),
  };
}

/** Read or credential-protocol operation (no idempotency table). */
export function defineRoute(app: FastifyInstance, deps: AppDeps, id: OperationId, handler: Handler): void {
  const def = operationsById[id];
  if (def.write === 'idempotencyKey') throw new Error(`${id} must use defineWrite`);
  app.route({
    method: def.method,
    url: routePath(def),
    schema: schemaFor(def),
    handler: async (request, reply) => {
      const { auth, ifMatch } = await preflight(def, request, deps);
      const result = await handler({ request, reply, deps, auth, ifMatch });
      result.after?.(reply);
      const status = result.status ?? def.success.status;
      if (status === 204) return reply.status(204).send();
      return reply.status(status).send(envelope(request, result));
    },
  });
}

/** Binary/text read endpoints keep the exact same authentication and policy preflight. */
export function defineRawRoute(app: FastifyInstance, deps: AppDeps, id: OperationId, handler: (ctx: HandlerContext) => Promise<unknown>): void {
  const def = operationsById[id];
  if (def.write !== 'read') throw new Error(`${id} is not a raw read endpoint`);
  app.route({ method: def.method, url: routePath(def), schema: schemaFor(def), handler: async (request, reply) => {
    const { auth, ifMatch } = await preflight(def, request, deps);
    return handler({ request, reply, deps, auth, ifMatch });
  } });
}

/**
 * Rejections that describe the caller's session rather than business state. Re-authentication is
 * checked at the command's lock-protected instant, so it fails inside the command, but it is not a
 * stable answer: the same intent (same Idempotency-Key and body) must succeed once the member has
 * re-authenticated. These release the claim instead of being sealed for replay.
 */
const UNSEALED_REJECTIONS: ReadonlySet<string> = new Set(['REAUTH_REQUIRED']);
const sealable = (error: unknown): error is DomainError => error instanceof DomainError && error.status < 500 && !UNSEALED_REJECTIONS.has(error.code);

/**
 * Idempotent authenticated write (API §1): claim actor+operation+key, run the command in one
 * transaction, seal success or DomainError with the business commit, replay only after the actor
 * is still allowed, release the claim on unexpected failure.
 */
export function defineWrite<P=undefined>(app: FastifyInstance, deps: AppDeps, id: OperationId, handler: WriteHandler<P>, stillAuthorized?: (auth: AuthContext, context: HandlerContext) => Promise<boolean>, prepare?: (ctx:HandlerContext & {auth:AuthContext})=>Promise<P>): void {
  const def = operationsById[id];
  if (def.write !== 'idempotencyKey' || (def.auth !== 'session' && def.auth !== 'staff')) throw new Error(`${id} is not an authenticated idempotent write`);
  app.route({
    method: def.method,
    url: routePath(def),
    schema: schemaFor(def),
    ...bodyLimitFor(id),
    handler: async (request, reply) => {
      const { auth, ifMatch } = await preflight(def, request, deps);
      const key = request.headers['idempotency-key'];
      if (typeof key !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(key)) {
        throw new DomainError('INVALID_REQUEST', 'Idempotency-Key header (UUID) is required.');
      }
      const actor = auth!;
      const claim = await claimIntent(deps.pool, {
        actorId: actor.userId,
        operation: id,
        key: key.toLowerCase(),
        requestHash: requestHash({ method: def.method, path: request.url.split('?')[0]!, ifMatch: ifMatch === null ? null : `"${ifMatch}"`, body: request.body ?? null }),
      });
      if (claim.kind === 'replay') {
        const replay = await replayIfAuthorized(claim, async () => {
          const { rows } = await deps.pool.query<{ same_epoch: boolean }>(`SELECT (SELECT epoch FROM privacy_control WHERE id=1)=$2 AS same_epoch FROM users WHERE id=$1 AND status='ACTIVE'`, [actor.userId, claim.privacyEpoch]);
          if (rows.length !== 1) return false;
          if (stillAuthorized && !(await stillAuthorized(actor, { request, reply, deps, auth: actor, ifMatch }))) return false;
          return rows[0]!.same_epoch || await ownerOnlyReplay(deps.pool, id, actor.userId, claim, request.params);
        });
        restoreRetryAfter(reply,replay.body);
        reply.header('idempotent-replay', 'true');
        return reply.status(replay.status).send(replay.body);
      }
      // External work happens after replay resolution and before opening a business transaction.
      // Known rejections still enter the short sealing transaction below; unexpected failures
      // release the intent through the existing outer error policy.
      let prepared:P|undefined;let preparationFailed=false;let preparationError:unknown;
      if(prepare)try{prepared=await prepare({request,reply,deps,auth:actor,ifMatch});}catch(error){preparationFailed=true;preparationError=error;}
      try {
        const { status, body, after } = await withTransaction(deps.pool, async (tx) => {
          try {
            if(preparationFailed)throw preparationError;
            const result = await handler({ request, reply, deps, auth: actor, ifMatch, prepared:prepared as P }, tx);
            const status = result.status ?? def.success.status;
            const body = envelope(request, result);
            await completeIntent(tx.client, claim, { status, body, resourceId: result.resourceId ?? null });
            return { status, body, after:result.after };
          } catch (error) {
            if (sealable(error)) {
              const body=domainErrorBody(request,error);
              await completeIntent(tx.client,claim,{status:error.status,body});
              // Return the exact sealed rejection. Throwing into the global error handler would
              // generate a second serverNow, making the first response differ from its replay.
              return {status:error.status,body,after:undefined};
            }
            throw error;
          }
        }, { commitOnDomainError: true });
        after?.(reply);
        restoreRetryAfter(reply,body);
        return reply.status(status).send(body);
      } catch (error) {
        if (!sealable(error)) await releaseIntent(deps.pool, claim).catch(() => undefined);
        throw error;
      }
    },
  });
}
