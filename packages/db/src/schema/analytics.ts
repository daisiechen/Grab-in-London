import { bigint, jsonb, pgTable, primaryKey, text, timestamp, uuid } from 'drizzle-orm/pg-core';
const ts = (name: string) => timestamp(name, { withTimezone: true, mode: 'date' });
export const accountClassifications = pgTable('account_classifications', {
  userId: uuid('user_id').notNull(), revision: bigint('revision', { mode: 'bigint' }).notNull(),
  classification: text('classification').notNull(), actorId: uuid('actor_id').notNull(),
  reason: text('reason').notNull(), createdAt: ts('created_at').notNull().defaultNow(),
}, t => [primaryKey({ columns: [t.userId, t.revision] })]);
export const analyticsSnapshots = pgTable('analytics_snapshots', {
  id: uuid('id').primaryKey().defaultRandom(), asOf: ts('as_of').notNull(),
  definitionVersion: text('definition_version').notNull(), historyCoverageStart: ts('history_coverage_start').notNull(),
  privacyEpoch: bigint('privacy_epoch', { mode: 'bigint' }).notNull(), sourceStatus: jsonb('source_status').notNull(),
  classificationRevision: bigint('classification_revision', { mode: 'bigint' }).notNull(),
  quality: jsonb('quality').notNull(), dimensions: jsonb('dimensions').notNull(), revokedAt: ts('revoked_at'),
  createdAt: ts('created_at').notNull().defaultNow(),
});
