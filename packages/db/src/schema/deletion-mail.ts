import {boolean,pgTable,text,timestamp,uuid} from 'drizzle-orm/pg-core';
const ts=(name:string)=>timestamp(name,{withTimezone:true,mode:'date'});
export const deletionMailEnvelopes=pgTable('deletion_mail_envelopes',{
 deletionId:uuid('deletion_id').primaryKey(),userId:uuid('user_id').notNull(),acceptedAt:ts('accepted_at').notNull(),expiresAt:ts('expires_at').notNull(),keyVersion:text('key_version'),nonce:text('nonce'),ciphertext:text('ciphertext'),authTag:text('auth_tag'),state:text('state').notNull(),receivedEventId:uuid('received_event_id').notNull().defaultRandom(),completedEventId:uuid('completed_event_id').notNull().defaultRandom(),completedEnqueued:boolean('completed_enqueued').notNull().default(false),
});
