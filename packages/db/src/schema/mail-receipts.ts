import {pgTable,text,timestamp,uuid} from 'drizzle-orm/pg-core';
const ts=(name:string)=>timestamp(name,{withTimezone:true,mode:'date'});
export const mailProviderMessages=pgTable('mail_provider_messages',{
 outboxId:uuid('outbox_id').primaryKey(),provider:text('provider').notNull().default('resend'),providerEmailId:uuid('provider_email_id'),dispatchedAt:ts('dispatched_at').notNull().defaultNow(),dispatchHash:text('dispatch_hash').notNull(),sentAt:ts('sent_at'),deliveredAt:ts('delivered_at'),bouncedAt:ts('bounced_at'),receivedAt:ts('received_at').notNull().defaultNow(),
});
export const mailProviderReceipts=pgTable('mail_provider_receipts',{
 svixId:text('svix_id').primaryKey(),outboxId:uuid('outbox_id').notNull(),providerEmailId:uuid('provider_email_id').notNull(),eventType:text('event_type').notNull(),payloadSha256:text('payload_sha256').notNull(),providerOccurredAt:ts('provider_occurred_at').notNull(),signedAttemptAt:ts('signed_attempt_at').notNull(),receivedAt:ts('received_at').notNull().defaultNow(),
});
