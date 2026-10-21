import { integer, jsonb, pgTable, primaryKey, text, timestamp, uuid } from 'drizzle-orm/pg-core';
const ts = (name: string) => timestamp(name, { withTimezone: true, mode: 'date' });
export const analyticsEvents = pgTable('analytics_events', {
  eventId: uuid('event_id').primaryKey(), anonymousId: text('anonymous_id').notNull(), userId: uuid('user_id'),
  sessionId: text('session_id').notNull(), appVersion: text('app_version').notNull(), authFamilyId: uuid('auth_family_id'), type: text('type').notNull(),
  occurredAt: ts('occurred_at').notNull(), receivedAt: ts('received_at').notNull().defaultNow(),
  schemaVersion: integer('schema_version').notNull(), environment: text('environment').notNull(),
  consentVersion: text('consent_version').notNull(), classification: text('classification').notNull(),
  properties: jsonb('properties').notNull(), requestHash: text('request_hash').notNull(),
});
export const analyticsSnapshotFacts = pgTable('analytics_snapshot_facts', {
  snapshotId: uuid('snapshot_id').notNull(), kind: text('kind').notNull(), facts: jsonb('facts').notNull(),
}, t => [primaryKey({ columns: [t.snapshotId,t.kind] })]);
export const analyticsConsents = pgTable('analytics_consents', {
  scopeKey: text('scope_key').primaryKey(), version: text('version').notNull(), grantedAt: ts('granted_at'), updatedAt: ts('updated_at').notNull(),
});
export const analyticsSnapshotSubjects = pgTable('analytics_snapshot_subjects', {
  snapshotId: uuid('snapshot_id').notNull(), userId: uuid('user_id').notNull(),
}, t => [primaryKey({ columns: [t.snapshotId,t.userId] })]);
