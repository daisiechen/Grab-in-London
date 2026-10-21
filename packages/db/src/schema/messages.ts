import { bigint, boolean, pgTable, primaryKey, text, timestamp, uuid } from 'drizzle-orm/pg-core';
export const messages = pgTable('messages', {
  id: uuid('id').primaryKey().defaultRandom(),
  conversationId: uuid('conversation_id').notNull(), seq: bigint('seq', { mode: 'bigint' }).notNull(),
  senderId: uuid('sender_id').notNull(), clientMessageId: uuid('client_message_id').notNull(), body: text('body').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull(), redacted: boolean('redacted').notNull().default(false),
});
export const conversationReads = pgTable('conversation_reads', {
  conversationId: uuid('conversation_id').notNull(), userId: uuid('user_id').notNull(),
  throughSeq: bigint('through_seq', { mode: 'bigint' }).notNull().default(0n),
}, (t) => [primaryKey({ columns: [t.conversationId, t.userId] })]);
