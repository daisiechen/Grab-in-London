import type { FastifyInstance } from 'fastify';
import { avatarUrl } from './avatar.ts';
import { appendAudit } from '@fancy/db';
import { DomainError } from '../common/errors.ts';
import { lockActiveActor } from '../common/actor.ts';
import type { AppDeps } from '../http/context.ts';
import { defineRoute, defineWrite } from '../http/routes.ts';
import { loadMe } from '../identity/me.ts';
import { publishedReviewsForProfile } from '../post-meal/reviews.ts';
import { decodeCursor, encodeCursor } from '../common/cursor.ts';

export const CONSENT_VERSION = '2026-10-21';
const columns = {
  displayName: 'display_name', avatarRef: 'avatar_ref', bio: 'bio', languages: 'languages',
  lifeStatus: 'life_status', interests: 'interests', background: 'background',
  ageConfirmedVersion: 'age_confirmed_version', communityAcceptedVersion: 'community_accepted_version',
} as const;

export function registerProfileRoutes(app: FastifyInstance, deps: AppDeps) {
  defineRoute(app, deps, 'getMe', async ({ auth }) => ({ data: await loadMe(deps.pool, auth!.userId) }));
  defineWrite(app, deps, 'updateMe', async ({ request, auth, ifMatch }, tx) => {
    const actor = await lockActiveActor(tx, auth.userId, 'update');
    if (actor.version !== ifMatch) throw new DomainError('VERSION_CONFLICT', 'Your profile changed. Reload it before saving.', { currentVersion: actor.version });
    const body = request.body as Record<string, unknown>;
    const normalized = Object.fromEntries(Object.entries(body).map(([k, v]) => [k, typeof v === 'string' ? v.trim() : v]));
    for (const k of ['ageConfirmedVersion', 'communityAcceptedVersion']) {
      if (k in normalized && normalized[k] !== CONSENT_VERSION) throw new DomainError('VALIDATION_FAILED', 'Please accept the current community and age confirmation.', { fieldErrors: { [`body.${k}`]: 'Unsupported consent version' } });
    }
    for (const [key, min, max] of [['displayName', 2, 40], ['bio', 20, 1000]] as const) {
      const value = normalized[key];
      if (typeof value === 'string' && (value.length < min || value.length > max)) throw new DomainError('VALIDATION_FAILED', 'Please check your profile.', { fieldErrors: { [`body.${key}`]: `Use ${min}–${max} characters` } });
    }
    await tx.client.query(`INSERT INTO profiles (user_id) VALUES ($1) ON CONFLICT DO NOTHING`, [auth.userId]);
    const entries = Object.entries(normalized) as Array<[keyof typeof columns, unknown]>;
    // Column identifiers only come from this server allowlist; all data is parameterized.
    await tx.client.query(`UPDATE profiles SET ${entries.map(([k], i) => `${columns[k]} = $${i + 2}`).join(', ')}, updated_at = clock_timestamp() WHERE user_id = $1`,
      [auth.userId, ...entries.map(([k, v]) => k === 'background' ? JSON.stringify(v) : v)]);
    await tx.client.query(`UPDATE users SET version = version + 1, updated_at = clock_timestamp() WHERE id = $1`, [auth.userId]);
    await appendAudit(tx.client, { actorKind: 'USER', actorId: auth.userId, action: 'profile.updated', aggregateType: 'user', aggregateId: auth.userId, requestId: request.id, payload: { fields: Object.keys(normalized).sort().join(',') } });
    const data = await loadMe(tx.client, auth.userId);
    return { data, version: data.version, resourceId: auth.userId };
  });
  defineRoute(app, deps, 'getPublicProfile', async ({ request }) => {
    const { userId } = request.params as { userId: string };
    const { rows } = await deps.pool.query(`SELECT u.id, p.display_name, p.avatar_ref, p.bio, p.languages, p.interests, p.background FROM users u JOIN profiles p ON p.user_id = u.id WHERE u.id = $1 AND u.status = 'ACTIVE' AND p.display_name IS NOT NULL`, [userId]);
    const row = rows[0];
    if (!row) throw new DomainError('NOT_FOUND', 'This profile is unavailable.');
    const q = request.query as {cursor?:string;limit?:number};
    const {rows:[privacy]}=await deps.pool.query(`SELECT epoch FROM privacy_control WHERE id=1`);
    const scope={actor:'public',resource:`profile-reviews:${userId}`,filterHash:'published',epoch:String(privacy.epoch)};
    let boundary:[string,string]|null=null;
    if(q.cursor){try{const value=JSON.parse(decodeCursor(deps.config.sessionSecret,scope,q.cursor));if(!Array.isArray(value)||value.length!==2||typeof value[0]!=='string'||typeof value[1]!=='string')throw new Error();boundary=value as [string,string];}catch{throw new DomainError('VALIDATION_FAILED','Invalid reference page.');}}
    const all=await publishedReviewsForProfile(deps.pool,userId);
    const eligible=boundary?all.filter(r=>r.publishedAt<boundary![0]||(r.publishedAt===boundary![0]&&r.id>boundary![1])):all;
    const limit=q.limit??20,page=eligible.slice(0,limit),last=page.at(-1);
    const nextReviewCursor=eligible.length>limit&&last?encodeCursor(deps.config.sessionSecret,scope,JSON.stringify([last.publishedAt,last.id])):null;
    return { data: { profile: { id: row.id, displayName: row.display_name, avatarUrl: avatarUrl(row.avatar_ref), bio: row.bio, languages: row.languages, interests: row.interests, background: row.background }, reviews:page, nextReviewCursor } };
  });
}
