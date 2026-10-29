/** Drizzle mirror of migrations/0029_safety_record_holds.sql (constraints live in SQL). */
import { jsonb, pgTable, primaryKey, text, timestamp, uuid } from 'drizzle-orm/pg-core';
const ts = (n: string) => timestamp(n, { withTimezone: true, mode: 'date' });
export const safetyRecordHolds = pgTable('safety_record_holds', {
  caseId: uuid('case_id').notNull(), userId: uuid('user_id').notNull(), role: text('role').notNull(),
  evidence: jsonb('evidence').notNull().default({}), heldAt: ts('held_at').notNull(), createdAt: ts('created_at').notNull().defaultNow(),
}, (t) => [primaryKey({ columns: [t.caseId, t.userId] })]);
