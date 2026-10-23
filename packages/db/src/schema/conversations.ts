/** Drizzle mirrors of migrations/0002_conversation_kernel.sql. */
import { bigint, pgTable, primaryKey, text, timestamp, uuid } from 'drizzle-orm/pg-core';

const ts = (name: string) => timestamp(name, { withTimezone: true, mode: 'date' });
const big = (name: string) => bigint(name, { mode: 'bigint' });

export const conversations = pgTable('conversations', {
  id: uuid('id').primaryKey().defaultRandom(),
  kind: text('kind', { enum: ['GROUP', 'DIRECT'] }).notNull(),
  mealId: uuid('meal_id'),
  pairId: uuid('pair_id'),
  authorizationEpoch: big('authorization_epoch').notNull().default(1n),
  head: big('head').notNull().default(0n),
  dissolvedAt: ts('dissolved_at'),
  dissolvedSeq: big('dissolved_seq'),
  version: big('version').notNull().default(1n),
  createdAt: ts('created_at').notNull().defaultNow(),
});

export const conversationEvents = pgTable('conversation_events', {
  conversationId: uuid('conversation_id').notNull(),
  seq: big('seq').notNull(),
  kind: text('kind', { enum: ['JOIN', 'LEAVE', 'DISSOLVE', 'MESSAGE'] }).notNull(),
  actorId: uuid('actor_id'),
  effectiveAt: ts('effective_at').notNull(),
  recordedAt: ts('recorded_at').notNull().defaultNow(),
}, (t) => [primaryKey({ columns: [t.conversationId, t.seq] })]);

export const membershipIntervals = pgTable('membership_intervals', {
  id: uuid('id').primaryKey().defaultRandom(),
  conversationId: uuid('conversation_id').notNull(),
  userId: uuid('user_id').notNull(),
  joinSeq: big('join_seq').notNull(),
  leaveSeq: big('leave_seq'),
});
