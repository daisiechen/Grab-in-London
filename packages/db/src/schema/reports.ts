import { bigint, date, integer, jsonb, pgTable, primaryKey, text, timestamp, uuid } from 'drizzle-orm/pg-core';
export const reports = pgTable('reports', {
  id: uuid('id').primaryKey().defaultRandom(), reporterId: uuid('reporter_id').notNull(), targetType: text('target_type').notNull(), targetId: uuid('target_id').notNull(), reason: text('reason').notNull(), details: text('details').notNull(), receipt: text('receipt').notNull(), status: text('status').notNull().default('RECEIVED'), publicOutcome: text('public_outcome'), createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
});
export const supportCases = pgTable('support_cases', {
  id: uuid('id').primaryKey().defaultRandom(), reportId: uuid('report_id'), targetType: text('target_type').notNull(), targetId: uuid('target_id').notNull(), details: text('details').notNull(), status: text('status').notNull().default('OPEN'), version: bigint('version', { mode: 'bigint' }).notNull().default(1n), autoActionedAt: timestamp('auto_actioned_at', { withTimezone: true, mode: 'date' }), autoClosedAt: timestamp('auto_closed_at', { withTimezone: true, mode: 'date' }), urgentAlertId: uuid('urgent_alert_id'), createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
});
export const supportCaseGrants = pgTable('support_case_grants', { caseId: uuid('case_id').notNull(), userId: uuid('user_id').notNull() }, (t) => [primaryKey({ columns: [t.caseId,t.userId] })]);
export const moderationActions = pgTable('moderation_actions', {
  id: uuid('id').primaryKey().defaultRandom(), reportId: uuid('report_id').notNull(), caseId: uuid('case_id').notNull(), actorKind: text('actor_kind').notNull(), actorId: uuid('actor_id'), action: text('action').notNull(), targetType: text('target_type').notNull(), targetId: uuid('target_id').notNull(), subjectUserId: uuid('subject_user_id'), note: text('note'), beforeState: jsonb('before_state').notNull().default({}), afterState: jsonb('after_state').notNull().default({}), publicOutcome: text('public_outcome'), createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
});
export const moderationDigests = pgTable('moderation_digests', {
  id: uuid('id').primaryKey().defaultRandom(), digestDay: date('digest_day').notNull(), reportIds: uuid('report_ids').array().notNull(), createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
});
export const moderationAlerts = pgTable('moderation_alerts', {
  id: uuid('id').primaryKey().defaultRandom(), kind: text('kind').notNull(), alertDay: date('alert_day'), reason: text('reason'), reportIds: uuid('report_ids').array().notNull().default([]), reportCount: integer('report_count').notNull(), stats: jsonb('stats').notNull(), createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
});
