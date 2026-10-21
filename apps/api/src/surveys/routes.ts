import type { Pool, PoolClient } from 'pg';
import type { FastifyInstance } from 'fastify';
import { DomainError } from '../common/errors.ts';
import { lockActiveActor } from '../common/actor.ts';
import { defineRoute, defineWrite } from '../http/routes.ts';
import type { AppDeps } from '../http/context.ts';
async function latest(db: Pool | PoolClient, userId: string) {
  const { rows: [r] } = await db.query<{ version: string; again: boolean | null; reasons: string[]; submitted_at: Date }>(`SELECT version, again, reasons, submitted_at FROM product_surveys WHERE user_id = $1 ORDER BY version DESC LIMIT 1`, [userId]);
  return r ? { version: r.version, again: r.again, reasons: r.reasons, submittedAt: r.submitted_at.toISOString() } : { version: '0', again: null, reasons: [], submittedAt: null };
}
export function registerSurveyRoutes(app: FastifyInstance, deps: AppDeps) {
  defineRoute(app, deps, 'getSurvey', async ({ auth }) => ({ data: await latest(deps.pool, auth!.userId) }));
  defineWrite(app, deps, 'putSurvey', async ({ request, auth, ifMatch }, tx) => {
    await lockActiveActor(tx, auth.userId, 'update');
    const previous = await latest(tx.client, auth.userId);
    if (previous.version !== ifMatch) throw new DomainError('VERSION_CONFLICT', 'Your survey changed. Reload before saving.', { currentVersion: previous.version });
    const body = request.body as { again: boolean | null; reasons: string[] };
    const now = await tx.effectiveNow();
    const version = String(BigInt(previous.version) + 1n);
    await tx.client.query(`INSERT INTO product_surveys (user_id, version, again, reasons, submitted_at) VALUES ($1,$2,$3,$4,$5)`, [auth.userId, version, body.again, body.reasons, now]);
    return { data: { version, ...body, submittedAt: now.toISOString() }, version, resourceId: auth.userId };
  });
}
