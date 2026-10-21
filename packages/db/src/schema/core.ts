/** Drizzle mirrors of migrations/0001_core_kernel.sql (constraints live in SQL; a db test checks column parity). */
import { bigint, integer, jsonb, pgTable, primaryKey, smallint, text, timestamp, uuid } from 'drizzle-orm/pg-core';

const ts = (name: string) => timestamp(name, { withTimezone: true, mode: 'date' });
const big = (name: string) => bigint(name, { mode: 'bigint' });

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  status: text('status', { enum: ['ACTIVE', 'DELETING', 'DELETED'] }).notNull().default('ACTIVE'),
  version: big('version').notNull().default(1n),
  privacyEpoch: big('privacy_epoch').notNull().default(0n),
  createdAt: ts('created_at').notNull().defaultNow(),
  updatedAt: ts('updated_at').notNull().defaultNow(),
});

export const idempotency = pgTable('idempotency', {
  privacyEpoch: big('privacy_epoch').notNull().default(0n),
  actorId: uuid('actor_id').notNull(),
  operation: text('operation').notNull(),
  key: uuid('key').notNull(),
  requestHash: text('request_hash').notNull(),
  state: text('state', { enum: ['IN_PROGRESS', 'COMPLETED'] }).notNull(),
  claimToken: uuid('claim_token').notNull(),
  leaseUntil: ts('lease_until').notNull(),
  responseStatus: integer('response_status'),
  responseJson: jsonb('response_json'),
  resourceId: uuid('resource_id'),
  createdAt: ts('created_at').notNull().defaultNow(),
  completedAt: ts('completed_at'),
  expiresAt: ts('expires_at').notNull(),
}, (t) => [primaryKey({ columns: [t.actorId, t.operation, t.key] })]);

export const businessEvents = pgTable('business_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  aggregateType: text('aggregate_type').notNull(),
  aggregateId: uuid('aggregate_id').notNull(),
  aggregateSeq: big('aggregate_seq').notNull(),
  kind: text('kind').notNull(),
  effectiveAt: ts('effective_at').notNull(),
  recordedAt: ts('recorded_at').notNull().defaultNow(),
  actorKind: text('actor_kind', { enum: ['USER', 'SYSTEM', 'SUPPORT'] }).notNull(),
  actorId: uuid('actor_id'),
  revision: big('revision'),
  payload: jsonb('payload').notNull(),
});

export const auditEvents = pgTable('audit_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  occurredAt: ts('occurred_at').notNull().defaultNow(),
  actorKind: text('actor_kind', { enum: ['USER', 'SYSTEM', 'SUPPORT'] }).notNull(),
  actorId: uuid('actor_id'),
  action: text('action').notNull(),
  aggregateType: text('aggregate_type').notNull(),
  aggregateId: uuid('aggregate_id'),
  requestId: text('request_id'),
  reason: text('reason'),
  payload: jsonb('payload').notNull(),
});

export const notifications = pgTable('notifications', {
  id: uuid('id').primaryKey().defaultRandom(),
  eventId: uuid('event_id').notNull(),
  recipientId: uuid('recipient_id').notNull(),
  channel: text('channel').notNull().default('IN_APP'),
  template: text('template').notNull(),
  refs: jsonb('refs').notNull(),
  createdAt: ts('created_at').notNull().defaultNow(),
  readAt: ts('read_at'),
});

export const outbox = pgTable('outbox', {
  claimToken: uuid('claim_token'),
  leaseUntil: ts('lease_until'),
  lookupAttempts: integer('lookup_attempts').notNull().default(0),
  id: uuid('id').primaryKey().defaultRandom(),
  eventId: uuid('event_id').notNull(),
  recipientId: uuid('recipient_id'),
  channel: text('channel', { enum: ['EMAIL'] }).notNull(),
  template: text('template').notNull(),
  payload: jsonb('payload').notNull(),
  status: text('status', { enum: ['PENDING', 'SENDING', 'SENT', 'UNKNOWN', 'FAILED', 'DEAD'] }).notNull().default('PENDING'),
  attempts: integer('attempts').notNull().default(0),
  nextAttemptAt: ts('next_attempt_at').notNull().defaultNow(),
  providerId: text('provider_id'),
  lastErrorCode: text('last_error_code'),
  createdAt: ts('created_at').notNull().defaultNow(),
  updatedAt: ts('updated_at').notNull().defaultNow(),
});

export const jobs = pgTable('jobs', {
  id: uuid('id').primaryKey().defaultRandom(),
  kind: text('kind').notNull(),
  resourceId: uuid('resource_id').notNull(),
  dueAt: ts('due_at').notNull(),
  state: text('state', { enum: ['PENDING', 'RUNNING', 'DONE', 'DEAD'] }).notNull().default('PENDING'),
  attempts: integer('attempts').notNull().default(0),
  maxAttempts: integer('max_attempts').notNull().default(8),
  runAfter: ts('run_after').notNull(),
  leaseOwner: text('lease_owner'),
  leaseUntil: ts('lease_until'),
  claimToken: uuid('claim_token'),
  lastError: text('last_error'),
  createdAt: ts('created_at').notNull().defaultNow(),
  completedAt: ts('completed_at'),
});

export const privacyControl = pgTable('privacy_control', {
  id: smallint('id').primaryKey(),
  epoch: big('epoch').notNull().default(0n),
  updatedAt: ts('updated_at').notNull().defaultNow(),
});
