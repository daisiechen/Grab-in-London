/**
 * Moderation policy (owner decision 2026-10-28; docs/delivery/claude-takeover-plan.zh-CN.md §8).
 * Low-effort, reversible and audited:
 *  - every report hides the reported item from its reporter at once (reports table is the source);
 *  - when distinct reporters of one target within 7 days reach the configured threshold, the server
 *    limits the content for everyone (masked, never rewritten) and marks the case auto-actioned;
 *  - reporters get an automatic acknowledgement as their public outcome;
 *  - open cases without a staff action are closed after 30 days, leaving any automatic limit;
 *  - a daily digest of open cases goes to SUPPORT_EMAIL through the mail outbox;
 *  - (2026-10-29) urgent reasons (safety, harassment, under_18) queue an immediate alert to
 *    SUPPORT_EMAIL and to the owner's assistant Ethan, coalesced to one per 10 minutes and at most one
 *    per case; Ethan also gets a morning digest push and an evening reminder when reports are due soon.
 *    Alerts carry counts and admin links only, never report text, names or user ids.
 */
import type { Pool, PoolClient } from 'pg';
import { appendAudit, enqueueOutbox } from '@fancy/db';
import { MODERATION_SLA_HOURS, URGENT_REPORT_REASONS } from '@fancy/contracts';
import type { Tx } from '../common/transaction.ts';
import { withTransaction } from '../common/transaction.ts';

export type TargetType = 'USER' | 'MEAL' | 'MESSAGE';
export const REPORT_WINDOW_DAYS = 7;
export const AUTO_CLOSE_DAYS = 30;
export const DIGEST_LONDON_HOUR = 8;
export const EVENING_LONDON_HOUR = 20;
/** Evening reminder threshold: some open report is overdue or due within this many hours. */
export const DUE_SOON_HOURS = 6;
/** At most one urgent alert per this many minutes; later urgent reports are coalesced into the next one. */
export const URGENT_COALESCE_MINUTES = 10;
/**
 * An urgent alert that follows the previous one within this many minutes continues the same burst, so
 * its `count` is cumulative (Ethan re-notifies within a window only when the count grows).
 */
export const URGENT_BURST_MINUTES = 2 * URGENT_COALESCE_MINUTES;
type UrgentReason = (typeof URGENT_REPORT_REASONS)[number];
/** Highest first: the reason an urgent alert names when it covers several reports. */
export const URGENT_PRIORITY: readonly UrgentReason[] = ['safety', 'under_18', 'harassment'];

/** Where alerts go: the support inbox (email) and/or the Ethan push. */
export interface AlertTargets { supportEmail: string | null; ethan: boolean }

/** Queue-wide counts carried by every alert (no text, names or user ids). */
export interface ModerationStats { open: number; autoLimited: number; overdue: number; dueWithin6h: number; oldestHoursLeft: number | null; urgentOpen: number }

export async function moderationStats(c: PoolClient, now: Date): Promise<ModerationStats> {
  const { rows: [row] } = await c.query<{ open: number; auto_limited: number; overdue: number; due_soon: number; oldest: Date | null; urgent_open: number }>(
    `SELECT count(*)::int AS open,
            count(*) FILTER (WHERE c.auto_actioned_at IS NOT NULL)::int AS auto_limited,
            count(*) FILTER (WHERE r.created_at+make_interval(hours=>$2)<$1)::int AS overdue,
            count(*) FILTER (WHERE r.created_at+make_interval(hours=>$2)>=$1 AND r.created_at+make_interval(hours=>$2)<=$1::timestamptz+make_interval(hours=>$3))::int AS due_soon,
            min(r.created_at) AS oldest,
            count(*) FILTER (WHERE r.reason=ANY($4::text[]))::int AS urgent_open
       FROM reports r JOIN support_cases c ON c.report_id=r.id WHERE c.status<>'RESOLVED'`,
    [now, MODERATION_SLA_HOURS, DUE_SOON_HOURS, [...URGENT_REPORT_REASONS]]);
  const oldestHoursLeft = row!.oldest ? Math.round(((row!.oldest.getTime() + MODERATION_SLA_HOURS * 3600_000 - now.getTime()) / 3600_000) * 10) / 10 : null;
  return { open: row!.open, autoLimited: row!.auto_limited, overdue: row!.overdue, dueWithin6h: row!.due_soon, oldestHoursLeft, urgentOpen: row!.urgent_open };
}

async function enqueueAlert(c: PoolClient, alertId: string, template: string, targets: AlertTargets) {
  if (targets.supportEmail) await enqueueOutbox(c, { eventId: alertId, recipientId: null, channel: 'EMAIL', template, payload: { alertId } });
  if (targets.ethan) await enqueueOutbox(c, { eventId: alertId, recipientId: null, channel: 'ETHAN', template, payload: { alertId } });
}

/**
 * Queues one urgent alert covering every open urgent case not yet alerted (created within the 24-hour
 * target), unless an urgent alert went out in the last URGENT_COALESCE_MINUTES; the worker retries
 * every minute so coalesced reports go out when the window ends. Each case is alerted at most once.
 * Runs in createReport's transaction (transactional outbox) and from the worker.
 */
export async function queueUrgentAlert(c: PoolClient, targets: AlertTargets, now: Date, requestId?: string): Promise<string | null> {
  if (!targets.supportEmail && !targets.ethan) return null;
  await c.query(`SELECT pg_advisory_xact_lock(hashtext('fancy.moderation.urgent_alert'))`);
  const { rows: [previous] } = await c.query<{ created_at: Date; report_count: number }>(`SELECT created_at,report_count FROM moderation_alerts WHERE kind='urgent' ORDER BY created_at DESC LIMIT 1`);
  if (previous && previous.created_at.getTime() > now.getTime() - URGENT_COALESCE_MINUTES * 60_000) return null;
  // SKIP LOCKED: a case held by a staff claim is picked up by the worker's next pass.
  const { rows: pending } = await c.query<{ case_id: string; report_id: string; reason: UrgentReason }>(
    `SELECT c.id AS case_id,r.id AS report_id,r.reason FROM support_cases c JOIN reports r ON r.id=c.report_id
      WHERE c.status<>'RESOLVED' AND c.urgent_alert_id IS NULL AND r.reason=ANY($1::text[]) AND r.created_at>$2::timestamptz-make_interval(hours=>$3)
      ORDER BY r.created_at,r.id LIMIT 50 FOR UPDATE OF c SKIP LOCKED`,
    [[...URGENT_REPORT_REASONS], now, MODERATION_SLA_HOURS]);
  if (!pending.length) return null;
  const reason = URGENT_PRIORITY.find((p) => pending.some((x) => x.reason === p))!;
  // Cumulative within a burst: a follow-up alert adds to the previous alert's count.
  const continues = !!previous && previous.created_at.getTime() > now.getTime() - URGENT_BURST_MINUTES * 60_000;
  const count = (continues ? previous!.report_count : 0) + pending.length;
  const stats = await moderationStats(c, now);
  const { rows: [alert] } = await c.query<{ id: string }>(
    `INSERT INTO moderation_alerts(kind,reason,report_ids,report_count,stats,created_at) VALUES('urgent',$1,$2,$3,$4,$5) RETURNING id`,
    [reason, pending.map((p) => p.report_id), count, JSON.stringify(stats), now]);
  await c.query(`UPDATE support_cases SET urgent_alert_id=$1 WHERE id=ANY($2::uuid[])`, [alert!.id, pending.map((p) => p.case_id)]);
  await enqueueAlert(c, alert!.id, 'moderation_urgent', targets);
  await appendAudit(c, { actorKind: 'SYSTEM', actorId: null, action: 'moderation.urgent_alert_queued', aggregateType: 'moderation_alert', aggregateId: alert!.id, ...(requestId ? { requestId } : {}), payload: { reason, reports: pending.length, count } });
  return alert!.id;
}

/** Worker entry: sends coalesced urgent reports once the 10-minute window has passed. */
export async function queuePendingUrgentAlert(pool: Pool, targets: AlertTargets, at: Date): Promise<string | null> {
  if (!targets.supportEmail && !targets.ethan) return null;
  return withTransaction(pool, (tx) => queueUrgentAlert(tx.client, targets, at));
}

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
export async function queueModerationDigest(pool: Pool, supportEmail: string | null, at: Date, ethan = false): Promise<string | null> {
  if (!supportEmail && !ethan) return null;
  const parts = londonParts(at);
  if (Number(parts.hour) < DIGEST_LONDON_HOUR) return null;
  const day = `${parts.year}-${parts.month}-${parts.day}`;
  // Ethan's morning push goes alongside the digest (own once-a-day key, so it also works without email).
  if (ethan) await queueDailyPush(pool, 'morning', day, at);
  if (!supportEmail) return null;
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

/** Once per London day; morning needs open reports, evening needs one overdue or due within 6 hours. */
async function queueDailyPush(pool: Pool, kind: 'morning' | 'evening', day: string, at: Date): Promise<string | null> {
  return withTransaction(pool, async (tx) => {
    const c = tx.client;
    const stats = await moderationStats(c, at);
    const count = kind === 'morning' ? stats.open : stats.overdue + stats.dueWithin6h;
    if (!count) return null;
    const { rows: [alert] } = await c.query<{ id: string }>(
      `INSERT INTO moderation_alerts(kind,alert_day,report_count,stats,created_at) VALUES($1,$2,$3,$4,$5) ON CONFLICT (kind,alert_day) WHERE kind<>'urgent' DO NOTHING RETURNING id`,
      [kind, day, count, JSON.stringify(stats), at]);
    if (!alert) return null;
    await enqueueAlert(c, alert.id, `moderation_${kind}`, { supportEmail: null, ethan: true });
    await appendAudit(c, { actorKind: 'SYSTEM', actorId: null, action: `moderation.${kind}_push_queued`, aggregateType: 'moderation_alert', aggregateId: alert.id, payload: { count } });
    return alert.id;
  });
}

/** Evening reminder to Ethan (from 20:00 London), once per day, only when reports are overdue or due soon. */
export async function queueEveningReminder(pool: Pool, ethan: boolean, at: Date): Promise<string | null> {
  if (!ethan) return null;
  const parts = londonParts(at);
  if (Number(parts.hour) < EVENING_LONDON_HOUR) return null;
  return queueDailyPush(pool, 'evening', `${parts.year}-${parts.month}-${parts.day}`, at);
}
