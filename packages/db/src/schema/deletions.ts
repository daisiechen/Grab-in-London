import { jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
const ts=(n:string)=>timestamp(n,{withTimezone:true,mode:'date'});
export const deletionRequests=pgTable('deletion_requests',{id:uuid('id').primaryKey().defaultRandom(),userId:uuid('user_id').notNull(),receiptTokenHash:text('receipt_token_hash').notNull(),status:text('status').notNull(),requestedAt:ts('requested_at').notNull(),completedAt:ts('completed_at'),expiresAt:ts('expires_at'),providerSteps:jsonb('provider_steps').notNull().default({}),policyVersion:text('policy_version').notNull()});
export const deletionJournal=pgTable('deletion_journal',{deletionId:uuid('deletion_id').primaryKey(),userId:uuid('user_id').notNull(),recordedAt:ts('recorded_at').notNull().defaultNow()});
