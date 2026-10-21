import { bigint, pgTable, primaryKey, text, timestamp, uuid } from 'drizzle-orm/pg-core';
export const reports = pgTable('reports', {
  id: uuid('id').primaryKey().defaultRandom(), reporterId: uuid('reporter_id').notNull(), targetType: text('target_type').notNull(), targetId: uuid('target_id').notNull(), reason: text('reason').notNull(), details: text('details').notNull(), receipt: text('receipt').notNull(), status: text('status').notNull().default('RECEIVED'), publicOutcome: text('public_outcome'), createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
});
export const supportCases = pgTable('support_cases', {
  id: uuid('id').primaryKey().defaultRandom(), reportId: uuid('report_id'), targetType: text('target_type').notNull(), targetId: uuid('target_id').notNull(), details: text('details').notNull(), status: text('status').notNull().default('OPEN'), version: bigint('version', { mode: 'bigint' }).notNull().default(1n), createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
});
export const supportCaseGrants = pgTable('support_case_grants', { caseId: uuid('case_id').notNull(), userId: uuid('user_id').notNull() }, (t) => [primaryKey({ columns: [t.caseId,t.userId] })]);
