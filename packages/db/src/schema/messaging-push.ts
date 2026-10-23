/** Mirrors 0027_messaging_push.sql; constraints and revocation triggers live in SQL. */
import { bigint, boolean, integer, pgTable, primaryKey, text, timestamp, uuid } from 'drizzle-orm/pg-core';
const ts = (name: string) => timestamp(name, { withTimezone: true, mode: 'date' });
const big = (name: string) => bigint(name, { mode: 'bigint' });
export const messageMentions = pgTable('message_mentions', {
 messageId: uuid('message_id').notNull(), ordinal: integer('ordinal').notNull(), kind: text('kind').notNull(), userId: uuid('user_id'), startOffset: integer('start_offset').notNull(), endOffset: integer('end_offset').notNull(),
}, t => [primaryKey({ columns: [t.messageId, t.ordinal] })]);
export const conversationNotificationSettings = pgTable('conversation_notification_settings', {
 conversationId: uuid('conversation_id').notNull(), userId: uuid('user_id').notNull(), muted: boolean('muted').notNull().default(false), version: big('version').notNull().default(1n),
}, t => [primaryKey({ columns: [t.conversationId, t.userId] })]);
export const messageNotificationRecipients = pgTable('message_notification_recipients', {
 eventId: uuid('event_id').primaryKey().defaultRandom(), messageId: uuid('message_id').notNull(), conversationId: uuid('conversation_id').notNull(), recipientId: uuid('recipient_id').notNull(), membershipEpoch: uuid('membership_epoch').notNull(), groupEpoch: big('group_epoch').notNull(), template: text('template').notNull(), notificationId: uuid('notification_id'), state: text('state').notNull().default('PENDING'), createdAt: ts('created_at').notNull(), expiresAt: ts('expires_at').notNull(),
});
export const pushSubscriptions = pgTable('push_subscriptions', {
 id: uuid('id').primaryKey().defaultRandom(), userId: uuid('user_id').notNull(), familyId: uuid('family_id').notNull(), installationId: uuid('installation_id').notNull(), platform: text('platform').notNull(), environment: text('environment').notNull(), destinationHash: text('destination_hash').notNull(), encryptedDestination: text('encrypted_destination').notNull(), keyVersion: text('key_version').notNull(), appBuild: text('app_build').notNull(), version: big('version').notNull().default(1n), createdAt: ts('created_at').notNull().defaultNow(), revokedAt: ts('revoked_at'),
});
export const pushDeliveries = pgTable('push_deliveries', {
 id: uuid('id').primaryKey().defaultRandom(), eventId: uuid('event_id').notNull(), subscriptionId: uuid('subscription_id').notNull(), state: text('state').notNull().default('PENDING'), attempts: integer('attempts').notNull().default(0), nextAttemptAt: ts('next_attempt_at').notNull().defaultNow(), claimToken: uuid('claim_token'), leaseUntil: ts('lease_until'), providerId: text('provider_id'), lastErrorCode: text('last_error_code'), createdAt: ts('created_at').notNull().defaultNow(), updatedAt: ts('updated_at').notNull().defaultNow(),
});
