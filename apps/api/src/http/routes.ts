/**
 * Registers an operation from the contract registry: method/path/schemas come from the single
 * source, responses are serialised through the success envelope schema (unknown fields dropped),
 * and the auth mode, CSRF, If-Match and Idempotency-Key rules are enforced before the handler.
 */
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { Meta, operationsById, PageInfo, T, type OperationDef, type OperationId } from '@fancy/contracts';
import { DomainError } from '../common/errors.ts';
import { claimIntent, completeIntent, releaseIntent, replayIfAuthorized } from '../common/idempotency.ts';
import { requestHash } from '../common/canonical.ts';
import { withTransaction, type Tx } from '../common/transaction.ts';
import { authenticateToken } from '../identity/sessions.ts';
import type { AppDeps, AuthContext } from './context.ts';
import { domainErrorBody } from './errors.ts';
import { assertCsrf, assertWebOrigin, SESSION_COOKIE } from './security.ts';

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
type WriteHandler = (ctx: HandlerContext & { auth: AuthContext }, tx: Tx) => Promise<HandlerResult>;

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

async function preflight(def: OperationDef, request: FastifyRequest, deps: AppDeps): Promise<{ auth: AuthContext | null; ifMatch: string | null }> {
  const auth = def.auth === 'public' || def.auth === 'receipt' ? null : await authenticate(request, deps);
  if ((def.auth === 'session' || def.auth === 'staff') && !auth) throw new DomainError('AUTH_REQUIRED', 'Please sign in to continue.');
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
  return { auth, ifMatch };
}

const routePath = (def: OperationDef) => '/v1' + def.path.replace(/\{([A-Za-z]+)\}/g, ':$1');

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

/**
 * Idempotent authenticated write (API §1): claim actor+operation+key, run the command in one
 * transaction, seal success or DomainError with the business commit, replay only after the actor
 * is still allowed, release the claim on unexpected failure.
 */
export function defineWrite(app: FastifyInstance, deps: AppDeps, id: OperationId, handler: WriteHandler, stillAuthorized?: (auth: AuthContext) => Promise<boolean>): void {
  const def = operationsById[id];
  if (def.write !== 'idempotencyKey' || (def.auth !== 'session' && def.auth !== 'staff')) throw new Error(`${id} is not an authenticated idempotent write`);
  app.route({
    method: def.method,
    url: routePath(def),
    schema: schemaFor(def),
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
          const { rows } = await deps.pool.query(`SELECT 1 FROM users WHERE id = $1 AND status = 'ACTIVE'`, [actor.userId]);
          return rows.length === 1 && (stillAuthorized ? await stillAuthorized(actor) : true);
        });
        reply.header('idempotent-replay', 'true');
        return reply.status(replay.status).send(replay.body);
      }
      let after: HandlerResult['after'];
      try {
        const { status, body } = await withTransaction(deps.pool, async (tx) => {
          try {
            const result = await handler({ request, reply, deps, auth: actor, ifMatch }, tx);
            after = result.after;
            const status = result.status ?? def.success.status;
            const body = envelope(request, result);
            await completeIntent(tx.client, claim, { status, body, resourceId: result.resourceId ?? null });
            return { status, body };
          } catch (error) {
            if (error instanceof DomainError) await completeIntent(tx.client, claim, { status: error.status, body: domainErrorBody(request, error) });
            throw error;
          }
        }, { commitOnDomainError: true });
        after?.(reply);
        return reply.status(status).send(body);
      } catch (error) {
        if (!(error instanceof DomainError)) await releaseIntent(deps.pool, claim).catch(() => undefined);
        throw error;
      }
    },
  });
}
