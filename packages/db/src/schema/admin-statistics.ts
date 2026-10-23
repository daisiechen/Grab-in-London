import { bigint, integer, pgTable, primaryKey, text, timestamp, uuid } from 'drizzle-orm/pg-core';
const ts = (name: string) => timestamp(name, { withTimezone: true, mode: 'date' });
/** Drizzle mirrors of migrations/0026_admin_statistics_refresh.sql. */
export const analyticsSnapshotClassificationInputs = pgTable('analytics_snapshot_classification_inputs', {
  snapshotId: uuid('snapshot_id').notNull(), userId: uuid('user_id').notNull(),
  revision: bigint('revision', { mode: 'bigint' }).notNull(), classification: text('classification').notNull(),
}, t => [primaryKey({ columns: [t.snapshotId, t.userId] })]);
export const adminStatisticsRefreshes = pgTable('admin_statistics_refreshes', {
  id: uuid('id').primaryKey(), actorId: uuid('actor_id').notNull(), intentKey: uuid('intent_key').notNull(),
  requestId: text('request_id').notNull(), targetUserId: uuid('target_user_id').notNull(),
  acceptedRevision: bigint('accepted_revision', { mode: 'bigint' }).notNull(), state: text('state').notNull(),
  snapshotId: uuid('snapshot_id'), attempts: integer('attempts').notNull(), failureCode: text('failure_code'),
  createdAt: ts('created_at').notNull().defaultNow(), updatedAt: ts('updated_at').notNull().defaultNow(),
});
