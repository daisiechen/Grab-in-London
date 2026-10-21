import { bigint, boolean, pgTable, primaryKey, text, timestamp, uuid } from 'drizzle-orm/pg-core';
export const productSurveys = pgTable('product_surveys', {
  userId: uuid('user_id').notNull(),
  version: bigint('version', { mode: 'bigint' }).notNull(),
  again: boolean('again'),
  reasons: text('reasons').array().notNull(),
  submittedAt: timestamp('submitted_at', { withTimezone: true, mode: 'date' }).notNull(),
}, (t) => [primaryKey({ columns: [t.userId, t.version] })]);
