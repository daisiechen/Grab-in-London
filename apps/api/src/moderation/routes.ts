/**
 * Moderation back office API (owner decision 2026-10-28). Staff role: the existing `support` role
 * with MFA (route preflight). A report's private facts and actions require a case grant obtained by
 * claiming it; every claim, read and action is audited, and actions are appended to moderation_actions
 * with before/after state so each one can be reviewed and reversed.
 */
import type { FastifyInstance } from 'fastify';
import type { Pool, PoolClient } from 'pg';
import { MODERATION_SLA_HOURS, type MODERATION_ACTIONS } from '@fancy/contracts';
import { appendAudit } from '@fancy/db';
import { DomainError } from '../common/errors.ts';
import { lockActiveActor } from '../common/actor.ts';
import { decodeCursor, encodeCursor } from '../common/cursor.ts';
import { defineRawRoute, defineRoute, defineWrite } from '../http/routes.ts';
import type { AppDeps } from '../http/context.ts';
import { revokeAllForUser } from '../identity/sessions.ts';
import { deleteAvatar } from '../profiles/avatar.ts';
import { advanceLifecycle, cancelMealState, type MealRow } from '../meals/lifecycle.ts';
import { casePrivateTextHidden, REMOVED_SUPPORT_TEXT, supportRelatedUserIds } from '../support/privacy.ts';
import { limitedSql, limitTarget, OUTCOMES, reporterCountSql, restoreTarget, subjectIdSql, type TargetType } from './policy.ts';

type Action = (typeof MODERATION_ACTIONS)[number];
const CLOSING: readonly Action[] = ['UPHOLD', 'RESTORE', 'SUSPEND_USER'];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** One report with its case, subject and live target state; `claimed` is the reading actor's grant. */
const reportSql = (actor: string) => `SELECT r.id AS report_id,r.reporter_id,r.target_type,r.target_id,r.reason,r.details AS report_details,r.status AS report_status,r.public_outcome,r.created_at,
    c.id AS case_id,c.version AS case_version,c.status AS case_status,c.auto_actioned_at,c.auto_closed_at,
    ${casePrivateTextHidden} AS privacy_redacted,
    EXISTS(SELECT 1 FROM support_case_grants g WHERE g.case_id=c.id AND g.user_id=${actor}) AS claimed,
    ${reporterCountSql('r')} AS reporter_count,${limitedSql('r')} AS limited,
    s.id AS subject_id,s.status AS subject_status
  FROM reports r JOIN support_cases c ON c.report_id=r.id
  LEFT JOIN users s ON s.id=${subjectIdSql('r')}`;

interface ReportRow {
  report_id: string; reporter_id: string; target_type: TargetType; target_id: string; reason: string; report_details: string; report_status: string;
  public_outcome: string | null; created_at: Date; case_id: string; case_version: string; case_status: string; auto_actioned_at: Date | null; auto_closed_at: Date | null;
  privacy_redacted: boolean; claimed: boolean; reporter_count: number; limited: boolean; subject_id: string | null; subject_status: string | null;
}

const summaryDto = (r: ReportRow) => ({
  reportId: r.report_id, caseId: r.case_id, caseVersion: String(r.case_version), targetType: r.target_type, reason: r.reason,
  reportStatus: r.report_status, caseStatus: r.case_status, createdAt: r.created_at.toISOString(),
  dueAt: new Date(r.created_at.getTime() + MODERATION_SLA_HOURS * 3600_000).toISOString(),
  autoActioned: r.auto_actioned_at !== null, autoClosed: r.auto_closed_at !== null, contentLimited: r.limited,
  reporterCount: r.reporter_count, claimedByMe: r.claimed, subjectStatus: r.subject_status,
});

async function loadReport(db: Pool | PoolClient, reportId: string, actorId: string, requireGrant: boolean): Promise<ReportRow> {
  const { rows: [row] } = await db.query<ReportRow>(`${reportSql('$2')} WHERE r.id=$1`, [reportId, actorId]);
  if (!row || (requireGrant && !row.claimed)) throw new DomainError('NOT_FOUND', 'Report not found.');
  return row;
}

const gone = (status: string | null | undefined) => status === 'DELETING' || status === 'DELETED';

interface TargetContext {
  user: null | { userId: string; accountStatus: string; displayName: string | null; bio: string | null; hasPhoto: boolean; photoUrl: string | null; languages: string[]; interests: string[]; profileHidden: boolean };
  meal: null | { mealId: string; hostId: string; title: string; description: string; status: string; startsAt: string; areaCode: string; hidden: boolean; startsAtDate: Date };
  message: null | { messageId: string; conversationId: string; senderId: string; hidden: boolean; context: Array<{ messageId: string; senderId: string; body: string; createdAt: string; hidden: boolean; isTarget: boolean }> };
}

async function targetContext(db: Pool | PoolClient, r: ReportRow): Promise<TargetContext> {
  const empty: TargetContext = { user: null, meal: null, message: null };
  if (r.privacy_redacted) return empty;
  if (r.target_type === 'USER') {
    const { rows: [u] } = await db.query(`SELECT u.id,u.status,p.display_name,p.bio,p.languages,p.interests,p.avatar_image_id,p.moderation_hidden_at FROM users u LEFT JOIN profiles p ON p.user_id=u.id WHERE u.id=$1`, [r.target_id]);
    if (!u || gone(u.status)) return empty;
    return { ...empty, user: { userId: u.id, accountStatus: u.status, displayName: u.display_name ?? null, bio: u.bio ?? null, hasPhoto: !!u.avatar_image_id, photoUrl: u.avatar_image_id ? `/v1/moderation/reports/${r.report_id}/photo` : null, languages: u.languages ?? [], interests: u.interests ?? [], profileHidden: u.moderation_hidden_at !== null && u.moderation_hidden_at !== undefined } };
  }
  if (r.target_type === 'MEAL') {
    const { rows: [m] } = await db.query<MealRow & { moderation_hidden_at: Date | null }>(`SELECT * FROM meals WHERE id=$1`, [r.target_id]);
    if (!m) return empty;
    return { ...empty, meal: { mealId: m.id, hostId: m.host_id, title: m.title, description: m.description, status: m.status, startsAt: m.starts_at.toISOString(), startsAtDate: m.starts_at, areaCode: m.area_code, hidden: m.moderation_hidden_at !== null } };
  }
  const { rows: [target] } = await db.query<{ id: string; conversation_id: string; sender_id: string; seq: string; moderation_hidden_at: Date | null }>(`SELECT id,conversation_id,sender_id,seq,moderation_hidden_at FROM messages WHERE id=$1`, [r.target_id]);
  if (!target) return empty;
  const { rows: lines } = await db.query(`SELECT m.id,m.sender_id,m.body,m.created_at,m.moderation_hidden_at,m.redacted,u.status FROM messages m JOIN users u ON u.id=m.sender_id
     WHERE m.conversation_id=$1 AND m.seq BETWEEN $2::bigint-3 AND $2::bigint+3 ORDER BY m.seq`, [target.conversation_id, target.seq]);
  return { ...empty, message: { messageId: target.id, conversationId: target.conversation_id, senderId: target.sender_id, hidden: target.moderation_hidden_at !== null,
    context: lines.map((l) => ({ messageId: l.id, senderId: l.sender_id, body: gone(l.status) || l.redacted ? REMOVED_SUPPORT_TEXT : l.body, createdAt: (l.created_at as Date).toISOString(), hidden: l.moderation_hidden_at !== null, isTarget: l.id === target.id })) } };
}

function allowedActions(r: ReportRow, ctx: TargetContext, actorId: string, now: Date): Action[] {
  const actions: Action[] = ['UPHOLD', 'RESTORE'];
  if (r.privacy_redacted) return actions;
  const exists = !!(ctx.user || ctx.meal || ctx.message);
  if (exists && !r.limited) actions.push('HIDE_CONTENT');
  if (ctx.meal && ctx.meal.status === 'OPEN' && now < ctx.meal.startsAtDate) actions.push('CANCEL_MEAL');
  if (ctx.user && (ctx.user.displayName || ctx.user.bio)) actions.push('RESET_PROFILE_TEXT');
  if (ctx.user?.hasPhoto) actions.push('REMOVE_PROFILE_PHOTO');
  if (r.subject_id && r.subject_id !== actorId) {
    if (r.subject_status === 'ACTIVE') actions.push('SUSPEND_USER');
    if (r.subject_status === 'SUSPENDED') actions.push('UNSUSPEND_USER');
  }
  return actions;
}

async function history(db: Pool | PoolClient, caseId: string) {
  const { rows } = await db.query(`SELECT id,action AS kind,actor_id,note,public_outcome,created_at FROM moderation_actions WHERE case_id=$1
    UNION ALL SELECT id,CASE action WHEN 'support.case_resolved' THEN 'CASE_STATUS' ELSE 'ATTENDANCE_CORRECTED' END,actor_id,reason,NULL,occurred_at FROM audit_events
      WHERE aggregate_type='case' AND aggregate_id=$1 AND action IN ('support.case_resolved','attendance.corrected')
    ORDER BY created_at,id LIMIT 200`, [caseId]);
  return rows.map((h) => ({ id: h.id, kind: h.kind, actorId: h.actor_id ?? null, note: h.note ?? null, publicOutcome: h.public_outcome ?? null, createdAt: (h.created_at as Date).toISOString() }));
}

async function reportDto(db: Pool | PoolClient, r: ReportRow, actorId: string, now: Date) {
  const ctx = await targetContext(db, r);
  const { meal, ...rest } = ctx;
  return {
    summary: summaryDto(r), reporterId: r.reporter_id,
    details: r.privacy_redacted ? REMOVED_SUPPORT_TEXT : r.report_details,
    publicOutcome: r.privacy_redacted ? null : r.public_outcome,
    privacyRedacted: r.privacy_redacted,
    subject: r.subject_id && r.subject_status ? { userId: r.subject_id, accountStatus: r.subject_status } : null,
    ...rest,
    meal: meal ? { mealId: meal.mealId, hostId: meal.hostId, title: meal.title, description: meal.description, status: meal.status, startsAt: meal.startsAt, areaCode: meal.areaCode, hidden: meal.hidden } : null,
    history: await history(db, r.case_id),
    allowedActions: allowedActions(r, ctx, actorId, now),
  };
}

const defaultOutcome = (action: Action) => (action === 'RESTORE' ? OUTCOMES.restored : OUTCOMES.upheld);

export function registerModerationRoutes(app: FastifyInstance, deps: AppDeps) {
  defineRoute(app, deps, 'listModerationReports', async ({ request, auth }) => {
    const q = request.query as { status?: 'OPEN' | 'RESOLVED' | 'ALL'; targetType?: TargetType; claimed?: 'me'; cursor?: string; limit?: number };
    const status = q.status ?? 'OPEN';
    const ascending = status === 'OPEN';
    const scope = { actor: auth!.userId, resource: 'moderation-reports', filterHash: `${status}|${q.targetType ?? ''}|${q.claimed ?? ''}`, epoch: '1' };
    let boundary: [string, string] | null = null;
    if (q.cursor) {
      try {
        const value: unknown = JSON.parse(decodeCursor(deps.config.sessionSecret, scope, q.cursor));
        if (!Array.isArray(value) || value.length !== 2 || typeof value[0] !== 'string' || !Number.isFinite(Date.parse(value[0])) || typeof value[1] !== 'string' || !UUID.test(value[1])) throw new Error();
        boundary = value as [string, string];
      } catch { throw new DomainError('VALIDATION_FAILED', 'Invalid queue page.'); }
    }
    const limit = q.limit ?? 20;
    const { rows } = await deps.pool.query<ReportRow & { cursor_created_at: string }>(`SELECT x.*,x.created_at::text AS cursor_created_at FROM (${reportSql('$1')}) x
      WHERE ($2='ALL' OR ($2='OPEN' AND x.case_status<>'RESOLVED') OR ($2='RESOLVED' AND x.case_status='RESOLVED'))
        AND ($3::text IS NULL OR x.target_type=$3) AND (NOT $4::boolean OR x.claimed)
        AND ($5::timestamptz IS NULL OR ${ascending ? '(x.created_at,x.report_id)>($5::timestamptz,$6::uuid)' : '(x.created_at,x.report_id)<($5::timestamptz,$6::uuid)'})
      ORDER BY x.created_at ${ascending ? 'ASC' : 'DESC'},x.report_id ${ascending ? 'ASC' : 'DESC'} LIMIT $7`,
    [auth!.userId, status, q.targetType ?? null, q.claimed === 'me', boundary?.[0] ?? null, boundary?.[1] ?? null, limit + 1]);
    const page = rows.slice(0, limit), last = page.at(-1);
    return { data: page.map(summaryDto), page: { hasMore: rows.length > limit, nextCursor: rows.length > limit && last ? encodeCursor(deps.config.sessionSecret, scope, JSON.stringify([last.cursor_created_at, last.report_id])) : null } };
  });

  defineWrite(app, deps, 'claimModerationReport', async ({ request, auth }, tx) => {
    const { reportId } = request.params as { reportId: string };
    await lockActiveActor(tx, auth.userId);
    const { rows: [hint] } = await tx.client.query<{ case_id: string }>(`SELECT c.id AS case_id FROM support_cases c WHERE c.report_id=$1 FOR UPDATE`, [reportId]);
    if (!hint) throw new DomainError('NOT_FOUND', 'Report not found.');
    const now = await tx.effectiveNow();
    const { rowCount } = await tx.client.query(`INSERT INTO support_case_grants(case_id,user_id) VALUES($1,$2) ON CONFLICT DO NOTHING`, [hint.case_id, auth.userId]);
    if (rowCount) {
      await tx.client.query(`UPDATE support_cases SET status='IN_REVIEW',version=version+1 WHERE id=$1 AND status='OPEN'`, [hint.case_id]);
      await tx.client.query(`UPDATE reports SET status='IN_REVIEW' WHERE id=$1 AND status='RECEIVED'`, [reportId]);
      await appendAudit(tx.client, { actorKind: 'SUPPORT', actorId: auth.userId, action: 'moderation.claimed', aggregateType: 'case', aggregateId: hint.case_id, requestId: request.id, payload: { reportId } });
    }
    const row = await loadReport(tx.client, reportId, auth.userId, true);
    return { data: await reportDto(tx.client, row, auth.userId, now), version: String(row.case_version), resourceId: reportId };
  }, async (auth) => {
    const { rows } = await deps.pool.query(`SELECT 1 FROM roles WHERE user_id=$1 AND role='support'`, [auth.userId]);
    return rows.length === 1;
  });

  defineRoute(app, deps, 'getModerationReport', async ({ request, auth }) => {
    const { reportId } = request.params as { reportId: string };
    const row = await loadReport(deps.pool, reportId, auth!.userId, true);
    await appendAudit(deps.pool as unknown as PoolClient, { actorKind: 'SUPPORT', actorId: auth!.userId, action: 'moderation.report_viewed', aggregateType: 'case', aggregateId: row.case_id, requestId: request.id, payload: { reportId } });
    const { rows: [clock] } = await deps.pool.query<{ now: Date }>(`SELECT clock_timestamp() AS now`);
    return { data: await reportDto(deps.pool, row, auth!.userId, clock!.now), version: String(row.case_version) };
  });

  defineRawRoute(app, deps, 'getModerationPhoto', async ({ request, reply, auth }) => {
    const { reportId } = request.params as { reportId: string };
    const row = await loadReport(deps.pool, reportId, auth!.userId, true);
    if (row.target_type !== 'USER' || row.privacy_redacted || gone(row.subject_status)) throw new DomainError('NOT_FOUND', 'Photo not found.');
    const { rows: [image] } = await deps.pool.query<{ bytes: Buffer }>(`SELECT a.bytes FROM avatar_images a JOIN profiles p ON p.avatar_image_id=a.id AND p.user_id=a.user_id WHERE a.user_id=$1`, [row.target_id]);
    if (!image) throw new DomainError('NOT_FOUND', 'Photo not found.');
    reply.header('cache-control', 'private, no-store').header('x-content-type-options', 'nosniff').header('content-security-policy', "default-src 'none'");
    return reply.status(200).type('image/jpeg').send(image.bytes);
  });

  defineWrite(app, deps, 'moderateReport', async ({ request, auth, ifMatch }, tx) => {
    const { reportId } = request.params as { reportId: string };
    const body = request.body as { action: Action; note: string; publicOutcome?: string | null; resolve?: boolean };
    const note = body.note.trim();
    if (note.length < 5) throw new DomainError('VALIDATION_FAILED', 'Add an internal note of at least 5 characters.', { fieldErrors: { note: 'Too short' } });
    const hint = await loadReport(tx.client, reportId, auth.userId, true);
    const related = await supportRelatedUserIds(tx.client, hint.case_id);
    const users = await tx.locks.lock<{ id: string; status: string }>('users', [auth.userId, ...related, ...(hint.subject_id ? [hint.subject_id] : [])], 'update', 'id,status');
    if (!users.some((u) => u.id === auth.userId && u.status === 'ACTIVE')) throw new DomainError('AUTH_REQUIRED', 'Your session is no longer valid.');
    let meal: MealRow | undefined;
    if (hint.target_type === 'MEAL') {
      [meal] = await tx.locks.lock<MealRow>('meals', [hint.target_id], 'update', '*');
      const { rows: [conversation] } = await tx.client.query<{ id: string }>(`SELECT id FROM conversations WHERE meal_id=$1`, [hint.target_id]);
      if (conversation) await tx.locks.lock('conversations', [conversation.id], 'update');
    }
    const now = await tx.effectiveNow();
    if (meal) await advanceLifecycle(tx, meal, now);
    const before = await loadReport(tx.client, reportId, auth.userId, true);
    const ctx = await targetContext(tx.client, before);
    const { rows: [bumped] } = await tx.client.query<{ version: string }>(`UPDATE support_cases SET version=version+1 WHERE id=$1 AND version=$2 RETURNING version`, [before.case_id, ifMatch]);
    if (!bumped) throw new DomainError('VERSION_CONFLICT', 'This report changed. Reload it before acting.', { currentVersion: String(before.case_version) });
    if (!allowedActions(before, ctx, auth.userId, now).includes(body.action)) throw new DomainError('STATE_CONFLICT', 'This action is not available for the report any more.');

    const type = before.target_type, target = before.target_id, subject = before.subject_id;
    const beforeState: Record<string, unknown> = { limited: before.limited, subjectStatus: before.subject_status, caseStatus: before.case_status };
    const afterState: Record<string, unknown> = {};
    const limit = async () => { if (!before.privacy_redacted && (ctx.user || ctx.meal || ctx.message)) await limitTarget(tx.client, type, target, now); };
    switch (body.action) {
      case 'UPHOLD': case 'HIDE_CONTENT': await limit(); break;
      case 'RESTORE': if (!before.privacy_redacted) await restoreTarget(tx.client, type, target); break;
      case 'CANCEL_MEAL': await cancelMealState(tx, meal!, 'other', now, auth.userId); await limit(); break;
      case 'RESET_PROFILE_TEXT': {
        beforeState.displayName = ctx.user!.displayName; beforeState.bio = ctx.user!.bio;
        await tx.client.query(`UPDATE profiles SET display_name=NULL,bio=NULL,updated_at=clock_timestamp() WHERE user_id=$1`, [target]);
        await tx.client.query(`UPDATE users SET version=version+1,updated_at=clock_timestamp() WHERE id=$1`, [target]);
        afterState.displayName = null; afterState.bio = null;
        break;
      }
      case 'REMOVE_PROFILE_PHOTO': {
        beforeState.hadPhoto = true;
        if (await deleteAvatar(tx.client, target)) await tx.client.query(`UPDATE users SET version=version+1,updated_at=clock_timestamp() WHERE id=$1`, [target]);
        afterState.hadPhoto = false;
        break;
      }
      case 'SUSPEND_USER': {
        await tx.client.query(`UPDATE users SET status='SUSPENDED',version=version+1,updated_at=clock_timestamp() WHERE id=$1 AND status='ACTIVE'`, [subject]);
        afterState.revokedSessionFamilies = await revokeAllForUser(tx.client, subject!, 'SUPPORT');
        await limit();
        break;
      }
      case 'UNSUSPEND_USER':
        await tx.client.query(`UPDATE users SET status='ACTIVE',version=version+1,updated_at=clock_timestamp() WHERE id=$1 AND status='SUSPENDED'`, [subject]);
        break;
    }
    const close = CLOSING.includes(body.action) || body.resolve === true;
    const outcome = close && !before.privacy_redacted ? (body.publicOutcome?.trim() || defaultOutcome(body.action)) : null;
    if (close) {
      await tx.client.query(`UPDATE support_cases SET status='RESOLVED' WHERE id=$1`, [before.case_id]);
      await tx.client.query(`UPDATE reports SET status='RESPONDED',public_outcome=$2 WHERE id=$1`, [reportId, outcome]);
    } else if (before.case_status === 'OPEN') {
      await tx.client.query(`UPDATE support_cases SET status='IN_REVIEW' WHERE id=$1`, [before.case_id]);
      await tx.client.query(`UPDATE reports SET status='IN_REVIEW' WHERE id=$1 AND status='RECEIVED'`, [reportId]);
    }
    const after = await loadReport(tx.client, reportId, auth.userId, true);
    Object.assign(afterState, { limited: after.limited, subjectStatus: after.subject_status, caseStatus: after.case_status });
    await tx.client.query(
      `INSERT INTO moderation_actions(report_id,case_id,actor_kind,actor_id,action,target_type,target_id,subject_user_id,note,before_state,after_state,public_outcome,created_at)
       VALUES($1,$2,'SUPPORT',$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
      [reportId, before.case_id, auth.userId, body.action, type, target, subject, note, JSON.stringify(beforeState), JSON.stringify(afterState), outcome, now]);
    await appendAudit(tx.client, { actorKind: 'SUPPORT', actorId: auth.userId, action: `moderation.${body.action.toLowerCase()}`, aggregateType: 'case', aggregateId: before.case_id, requestId: request.id, reason: note,
      payload: { reportId, targetType: type, targetId: target, subjectId: subject, limitedBefore: before.limited, limitedAfter: after.limited, subjectStatusBefore: before.subject_status, subjectStatusAfter: after.subject_status, resolved: close } });
    return { data: await reportDto(tx.client, after, auth.userId, now), version: String(after.case_version), resourceId: reportId };
  }, async (auth, { request }) => {
    const { rows } = await deps.pool.query(`SELECT 1 FROM support_case_grants g JOIN support_cases c ON c.id=g.case_id WHERE c.report_id=$1 AND g.user_id=$2`, [(request.params as { reportId: string }).reportId, auth.userId]);
    return rows.length === 1;
  });
}

