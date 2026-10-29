/**
 * Moderation policy (owner decision 2026-10-28; docs/delivery/claude-takeover-plan.zh-CN.md §8).
 * Low-effort, reversible and audited:
 *  - every report hides the reported item from its reporter at once (reports table is the source);
 *  - when distinct reporters of one target within 7 days reach the configured threshold, the server
 *    limits the content for everyone (masked, never rewritten) and marks the case auto-actioned;
 *  - reporters get an automatic acknowledgement as their public outcome;
 *  - open cases without a staff action are closed after 30 days, leaving any automatic limit;
 *  - a daily digest of open cases goes to SUPPORT_EMAIL through the mail outbox.
 */
import type { Pool, PoolClient } from 'pg';
import { appendAudit, enqueueOutbox } from '@fancy/db';
import type { Tx } from '../common/transaction.ts';
import { withTransaction } from '../common/transaction.ts';

export type TargetType = 'USER' | 'MEAL' | 'MESSAGE';
export const REPORT_WINDOW_DAYS = 7;
export const AUTO_CLOSE_DAYS = 30;
export const DIGEST_LONDON_HOUR = 8;

/** Reporter-visible outcomes. Plain statements of what the code actually did. */
export const OUTCOMES = {
  received: 'Thanks — we’ve received your report and will review it.',
  limited: 'Thanks — we’ve received this and limited the content while we review.',
  upheld: 'Thanks for your report. We reviewed it and took action under our community guidelines.',
  restored: 'Thanks for your report. We reviewed it and did not find a breach of our community guidelines.',
  autoClosedLimited: 'Thanks for your report. The content stays limited and this report is now closed.',
  autoClosed: 'Thanks for your report. This report is now closed.',
} as const;

/** Owner of the reported item: the profile itself, the meal host or the message sender. */
export const subjectIdSql = (alias: string) =>
  `CASE ${alias}.target_type WHEN 'USER' THEN ${alias}.target_id WHEN 'MEAL' THEN (SELECT sm.host_id FROM meals sm WHERE sm.id=${alias}.target_id) ELSE (SELECT smsg.sender_id FROM messages smsg WHERE smsg.id=${alias}.target_id) END`;

/** Whether the reported item is currently limited for everyone. */
export const limitedSql = (alias: string) =>
  `COALESCE(CASE ${alias}.target_type WHEN 'USER' THEN (SELECT lp.moderation_hidden_at IS NOT NULL FROM profiles lp WHERE lp.user_id=${alias}.target_id) WHEN 'MEAL' THEN (SELECT lm.moderation_hidden_at IS NOT NULL FROM meals lm WHERE lm.id=${alias}.target_id) ELSE (SELECT lmsg.moderation_hidden_at IS NOT NULL FROM messages lmsg WHERE lmsg.id=${alias}.target_id) END,false)`;

/** Distinct reporters of the same target within the report window. */
export const reporterCountSql = (alias: string) =>
  `(SELECT count(DISTINCT rc.reporter_id)::int FROM reports rc WHERE rc.target_type=${alias}.target_type AND rc.target_id=${alias}.target_id AND rc.created_at>clock_timestamp()-interval '${REPORT_WINDOW_DAYS} days')`;

const TABLE: Record<TargetType, { table: string; key: string }> = {
  USER: { table: 'profiles', key: 'user_id' },
  MEAL: { table: 'meals', key: 'id' },
  MESSAGE: { table: 'messages', key: 'id' },
};

/** Masks the item for everyone; returns whether it was visible before (false = already limited or absent). */
export async function limitTarget(db: PoolClient, type: TargetType, id: string, now: Date): Promise<boolean> {
  const t = TABLE[type];
  const { rowCount } = await db.query(`UPDATE ${t.table} SET moderation_hidden_at=$2 WHERE ${t.key}=$1 AND moderation_hidden_at IS NULL`, [id, now]);
  return (rowCount ?? 0) > 0;
}

/** Lifts a limit; returns whether one was lifted. */
export async function restoreTarget(db: PoolClient, type: TargetType, id: string): Promise<boolean> {
  const t = TABLE[type];
  const { rowCount } = await db.query(`UPDATE ${t.table} SET moderation_hidden_at=NULL WHERE ${t.key}=$1 AND moderation_hidden_at IS NOT NULL`, [id]);
  return (rowCount ?? 0) > 0;
}

/**
 * Runs inside createReport after the report and its case exist. Locks: reporter/owner users are held;
 * a MEAL target's row is locked here (user → meal order).
 */
export async function applyReportAutomation(tx: Tx, input: { reportId: string; caseId: string; targetType: TargetType; targetId: string; threshold: number; requestId: string }): Promise<{ limited: boolean; autoActioned: boolean }> {
  const c = tx.client;
  if (input.targetType === 'MEAL') await tx.locks.lock('meals', [input.targetId], 'update');
  const now = await tx.effectiveNow();
  const { rows: [count] } = await c.query<{ n: number }>(
    `SELECT count(DISTINCT reporter_id)::int AS n FROM reports WHERE target_type=$1 AND target_id=$2 AND created_at>$3::timestamptz-interval '${REPORT_WINDOW_DAYS} days'`,
    [input.targetType, input.targetId, now]);
  const reached = count!.n >= input.threshold;
  if (reached) {
    const hidden = await limitTarget(c, input.targetType, input.targetId, now);
    const { rows: cases } = await c.query<{ id: string; report_id: string }>(
      `UPDATE support_cases SET auto_actioned_at=$3,version=version+1 WHERE target_type=$1 AND target_id=$2 AND status<>'RESOLVED' AND auto_actioned_at IS NULL RETURNING id,report_id`,
      [input.targetType, input.targetId, now]);
    await c.query(`UPDATE reports SET public_outcome=$3 WHERE target_type=$1 AND target_id=$2 AND status<>'RESPONDED' AND public_outcome IS DISTINCT FROM $3`, [input.targetType, input.targetId, OUTCOMES.limited]);
    if (hidden) {
      await c.query(
        `INSERT INTO moderation_actions(report_id,case_id,actor_kind,action,target_type,target_id,subject_user_id,before_state,after_state,public_outcome,created_at)
         VALUES($1,$2,'SYSTEM','AUTO_HIDE',$3,$4,(SELECT ${subjectIdSql('x')} FROM (SELECT $3::text AS target_type,$4::uuid AS target_id) x),'{"limited":false}','{"limited":true}',$5,$6)`,
        [input.reportId, input.caseId, input.targetType, input.targetId, OUTCOMES.limited, now]);
      await appendAudit(c, { actorKind: 'SYSTEM', actorId: null, action: 'moderation.auto_hidden', aggregateType: 'report', aggregateId: input.reportId, requestId: input.requestId, payload: { targetType: input.targetType, targetId: input.targetId, reporters: count!.n, threshold: input.threshold, cases: cases.length } });
    }
    return { limited: true, autoActioned: true };
  }
  const { rows: [state] } = await c.query<{ limited: boolean }>(`SELECT ${limitedSql('x')} AS limited FROM (SELECT $1::text AS target_type,$2::uuid AS target_id) x`, [input.targetType, input.targetId]);
  await c.query(`UPDATE reports SET public_outcome=$2 WHERE id=$1`, [input.reportId, state!.limited ? OUTCOMES.limited : OUTCOMES.received]);
  return { limited: state!.limited, autoActioned: false };
}

/** Closes open cases with no staff action after AUTO_CLOSE_DAYS; any automatic limit stays in place. */
export async function autoCloseStaleCases(pool: Pool): Promise<number> {
  return withTransaction(pool, async (tx) => {
    const c = tx.client;
    const { rows } = await c.query<{ id: string; report_id: string; target_type: TargetType; target_id: string; auto_actioned_at: Date | null; limited: boolean }>(
      `SELECT c.id,c.report_id,c.target_type,c.target_id,c.auto_actioned_at,${limitedSql('c')} AS limited FROM support_cases c
        WHERE c.status<>'RESOLVED' AND c.report_id IS NOT NULL AND c.created_at<=clock_timestamp()-interval '${AUTO_CLOSE_DAYS} days'
          AND NOT EXISTS(SELECT 1 FROM moderation_actions a WHERE a.case_id=c.id AND a.actor_kind='SUPPORT')
          AND NOT EXISTS(SELECT 1 FROM audit_events e WHERE e.aggregate_type='case' AND e.aggregate_id=c.id AND e.action IN ('support.case_resolved','attendance.corrected'))
        ORDER BY c.id LIMIT 200 FOR UPDATE OF c SKIP LOCKED`);
    for (const row of rows) {
      const outcome = row.limited ? OUTCOMES.autoClosedLimited : OUTCOMES.autoClosed;
      await c.query(`UPDATE support_cases SET status='RESOLVED',auto_closed_at=clock_timestamp(),version=version+1 WHERE id=$1`, [row.id]);
      // A privacy-purged report keeps no outcome text.
      await c.query(`UPDATE reports SET status='RESPONDED',public_outcome=CASE WHEN reason='PRIVACY_REDACTED' THEN NULL ELSE $2 END WHERE id=$1`, [row.report_id, outcome]);
      await c.query(
        `INSERT INTO moderation_actions(report_id,case_id,actor_kind,action,target_type,target_id,before_state,after_state,public_outcome) VALUES($1,$2,'SYSTEM','AUTO_CLOSE',$3,$4,$5,$6,$7)`,
        [row.report_id, row.id, row.target_type, row.target_id, JSON.stringify({ caseStatus: 'OPEN', limited: row.limited }), JSON.stringify({ caseStatus: 'RESOLVED', limited: row.limited }), outcome]);
      await appendAudit(c, { actorKind: 'SYSTEM', actorId: null, action: 'moderation.auto_closed', aggregateType: 'case', aggregateId: row.id, payload: { reportId: row.report_id, limited: row.limited } });
    }
    return rows.length;
  });
}

const londonParts = (at: Date) => Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23' }).formatToParts(at).map((p) => [p.type, p.value]));

/**
 * Queues at most one digest per London day (from 08:00 London) when SUPPORT_EMAIL is set and cases are
 * open. The outbox row carries only the digest id; the worker resolves the report ids into admin links.
 */
export async function queueModerationDigest(pool: Pool, supportEmail: string | null, at: Date): Promise<string | null> {
  if (!supportEmail) return null;
  const parts = londonParts(at);
  if (Number(parts.hour) < DIGEST_LONDON_HOUR) return null;
  const day = `${parts.year}-${parts.month}-${parts.day}`;
  return withTransaction(pool, async (tx) => {
    const c = tx.client;
    const { rows: open } = await c.query<{ id: string }>(`SELECT r.id FROM reports r JOIN support_cases c ON c.report_id=r.id WHERE c.status<>'RESOLVED' ORDER BY r.created_at,r.id LIMIT 50`);
    if (!open.length) return null;
    const { rows: [digest] } = await c.query<{ id: string }>(`INSERT INTO moderation_digests(digest_day,report_ids) VALUES($1,$2) ON CONFLICT (digest_day) DO NOTHING RETURNING id`, [day, open.map((r) => r.id)]);
    if (!digest) return null;
    await enqueueOutbox(c, { eventId: digest.id, recipientId: null, channel: 'EMAIL', template: 'moderation_digest', payload: { digestId: digest.id } });
    await appendAudit(c, { actorKind: 'SYSTEM', actorId: null, action: 'moderation.digest_queued', aggregateType: 'moderation_digest', aggregateId: digest.id, payload: { openCases: open.length } });
    return digest.id;
  });
}
