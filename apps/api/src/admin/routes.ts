import type { FastifyInstance } from 'fastify';
import type { Pool, PoolClient } from 'pg';
import { appendAudit } from '@fancy/db';
import type { AppDeps } from '../http/context.ts';
import { defineRoute, defineWrite } from '../http/routes.ts';
import { DomainError } from '../common/errors.ts';
import { readAdminPage } from './pages.ts';
import { readDrilldown } from './drilldown.ts';
import { createStatisticsRefresh, readStatisticsRefresh, retryStatisticsRefresh } from './statistics-refresh.ts';
import {encodeCursor,decodeCursor} from '../common/cursor.ts';
import {createHash} from 'node:crypto';
import type { Static } from '@sinclair/typebox';
import type { OperationById } from '@fancy/contracts';

async function classification(db: Pool | PoolClient, userId: string) {
  const { rows: users } = await db.query(`SELECT id FROM users WHERE id=$1 AND status='ACTIVE'`, [userId]);
  if (!users.length) throw new DomainError('NOT_FOUND', 'This account is unavailable.');
  const { rows } = await db.query(`SELECT classification, revision::text FROM account_classifications WHERE user_id=$1 ORDER BY revision DESC LIMIT 1`, [userId]);
  // No sealed snapshot has incorporated this classification yet. A worker will explicitly
  // record incorporation; do not imply that a classification edit rewrites old snapshots.
  return { userId, classification: rows[0]?.classification ?? 'regular', revision: rows[0]?.revision ?? '0', snapshotPending: true };
}

export function registerAdminRoutes(app: FastifyInstance, deps: AppDeps) {
  defineRoute(app,deps,'adminDrilldown',async({request,auth})=>readDrilldown(deps.pool,(request.params as{metric:string}).metric,request.query as Static<OperationById<'adminDrilldown'>['query']>,{actor:auth!.userId,secret:deps.config.sessionSecret}));
  defineRoute(app,deps,'adminPage',async ({request})=>({data:await readAdminPage(deps.pool,(request.params as {page:'overview'|'journey'|'supply'|'retention'|'quality'}).page,request.query as Static<OperationById<'adminPage'>['query']>)}));
  defineRoute(app, deps, 'getClassification', async ({ request }) => {
    const { userId } = request.params as { userId: string };
    return { data: await classification(deps.pool, userId) };
  });
  defineWrite(app, deps, 'classifyUser', async ({ request, auth, ifMatch }, tx) => {
    const { userId } = request.params as { userId: string };
    const body = request.body as { classification: 'regular' | 'test' | 'staff'; reason: string };
    const reason = body.reason.trim();
    if (reason.length < 5) throw new DomainError('VALIDATION_FAILED', 'Explain why this classification is changing.');
    const users = await tx.locks.lock<{ id: string; status: string }>('users', [auth.userId, userId], 'update', 'id,status');
    if (!users.some(u => u.id === auth.userId && u.status === 'ACTIVE')) throw new DomainError('AUTH_REQUIRED', 'Please sign in again.');
    if (!users.some(u => u.id === userId && u.status === 'ACTIVE')) throw new DomainError('NOT_FOUND', 'This account is unavailable.');
    // Recheck the privilege inside the mutation transaction, rather than trusting UI state.
    const { rows: roles } = await tx.client.query(`SELECT role FROM roles WHERE user_id=$1 AND role='data_admin' FOR SHARE`, [auth.userId]);
    if (!roles.length) throw new DomainError('FORBIDDEN', 'You do not have permission to change classifications.');
    const current = await classification(tx.client, userId);
    if (current.revision !== ifMatch) throw new DomainError('VERSION_CONFLICT', 'This classification changed. Reload before saving.', { currentVersion: current.revision });
    const { rows: inserted } = await tx.client.query<{ revision: string }>(`INSERT INTO account_classifications(user_id,classification,actor_id,reason) VALUES($1,$2,$3,$4) RETURNING revision::text`, [userId, body.classification, auth.userId, reason]);
    const revision = inserted[0]!.revision;
    await appendAudit(tx.client, { actorKind: 'SUPPORT', actorId: auth.userId, action: 'account.classified', aggregateType: 'user', aggregateId: userId, requestId: request.id, reason, payload: { classification: body.classification, revision } });
    // The refresh commits with the classification and is sealed into this intent's receipt, so an
    // unknown outcome resolves by reading the original actor+operation+key, never by re-sending.
    const statisticsRefresh = await createStatisticsRefresh(tx.client, { actorId: auth.userId, intentKey: request.headers['idempotency-key'] as string, requestId: request.id, targetUserId: userId, acceptedRevision: revision });
    return { data: { userId, classification: body.classification, revision, snapshotPending: true, statisticsRefresh }, version: revision, resourceId: userId };
  });
  defineRoute(app, deps, 'getStatisticsRefresh', async ({ request, auth }) => ({ data: await readStatisticsRefresh(deps.pool, (request.params as { refreshId: string }).refreshId, auth!.userId) }));
  defineWrite(app, deps, 'retryStatisticsRefresh', async ({ request, auth }, tx) => {
    const { rows: roles } = await tx.client.query(`SELECT role FROM roles WHERE user_id=$1 AND role='data_admin' FOR SHARE`, [auth.userId]);
    if (!roles.length) throw new DomainError('FORBIDDEN', 'You do not have permission to refresh statistics.');
    const refreshId = (request.params as { refreshId: string }).refreshId;
    return { data: await retryStatisticsRefresh(tx.client, refreshId, auth.userId), resourceId: refreshId };
  });
  // A missing source pipeline produces an empty list, never synthetic fixture snapshots.
  defineRoute(app, deps, 'listSnapshots', async ({ request,auth }) => {
    const { limit = 25, cursor } = request.query as { limit?: number; cursor?: string };
    const {rows:privacy}=await deps.pool.query<{epoch:string}>(`SELECT epoch::text FROM privacy_control WHERE id=1`);
    const scope={actor:auth!.userId,resource:'adminSnapshots',filterHash:createHash('sha256').update(JSON.stringify({limit})).digest('hex'),epoch:privacy[0]!.epoch};
    let boundary: { asOf: string; id: string } | null = null;
    if (cursor) {
      try {
        const value: unknown = JSON.parse(decodeCursor(deps.config.sessionSecret,scope,cursor));
        if (!value || typeof value !== 'object' || !('asOf' in value) || !('id' in value)
          || typeof value.asOf !== 'string' || !Number.isFinite(Date.parse(value.asOf))
          || typeof value.id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value.id)) throw new Error('cursor');
        boundary = { asOf: value.asOf, id: value.id };
      } catch { throw new DomainError('VALIDATION_FAILED', 'This snapshot cursor is invalid.'); }
    }
    const { rows } = await deps.pool.query(`SELECT id,as_of,as_of::text AS cursor_as_of,created_at,definition_version,classification_revision::text,dimensions,revoked_at,privacy_epoch::text FROM analytics_snapshots
      WHERE ($2::timestamptz IS NULL OR (as_of,id)<($2::timestamptz,$3::uuid)) ORDER BY as_of DESC,id DESC LIMIT $1`, [limit + 1, boundary?.asOf ?? null, boundary?.id ?? null]);
    const items = rows.slice(0, limit);
    const last = items.at(-1);
    const nextCursor = rows.length > limit && last ? encodeCursor(deps.config.sessionSecret,scope,JSON.stringify({ asOf: last.cursor_as_of, id: last.id })) : null;
    return { data: items.map(r => ({ id: r.id, asOf: r.as_of.toISOString(), createdAt: r.created_at.toISOString(), definitionVersion: r.definition_version, classificationRevision: r.classification_revision, dimensions: r.dimensions, status: r.revoked_at || r.privacy_epoch!==privacy[0]!.epoch ? 'REVOKED' : 'SEALED' })), page: { nextCursor, hasMore: nextCursor !== null } };
  });
}
