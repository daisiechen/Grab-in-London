/** Drizzle mirrors of migrations/0003_identity.sql (constraints live in SQL). */
import { boolean, integer, interval, jsonb, pgTable, primaryKey, text, timestamp, uuid } from 'drizzle-orm/pg-core';

const ts = (name: string) => timestamp(name, { withTimezone: true, mode: 'date' });

export const privateContact = pgTable('private_contact', {
  userId: uuid('user_id').primaryKey(),
  email: text('email').notNull(),
  emailVerifiedAt: ts('email_verified_at').notNull(),
  updatedAt: ts('updated_at').notNull().defaultNow(),
});

export const identities = pgTable('identities', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull(),
  issuer: text('issuer').notNull(),
  subject: text('subject').notNull(),
  provider: text('provider', { enum: ['EMAIL', 'GOOGLE', 'APPLE'] }).notNull(),
  emailVerified: boolean('email_verified').notNull().default(false),
  linkedAt: ts('linked_at').notNull().defaultNow(),
});

export const sessionFamilies = pgTable('session_families', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull(),
  kind: text('kind', { enum: ['WEB', 'IOS', 'SUPPORT_CLI'] }).notNull(),
  authTime: ts('auth_time').notNull(),
  amr: text('amr').array().notNull(),
  absoluteExpiresAt: ts('absolute_expires_at').notNull(),
  createdAt: ts('created_at').notNull().defaultNow(),
  revokedAt: ts('revoked_at'),
  revokeReason: text('revoke_reason'),
});

export const sessions = pgTable('sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  familyId: uuid('family_id').notNull(),
  tokenHash: text('token_hash').notNull(),
  expiresAt: ts('expires_at').notNull(),
  idleTimeout: interval('idle_timeout'),
  lastUsedAt: ts('last_used_at').notNull().defaultNow(),
  createdAt: ts('created_at').notNull().defaultNow(),
});

export const refreshTokens = pgTable('refresh_tokens', {
  id: uuid('id').primaryKey().defaultRandom(),
  familyId: uuid('family_id').notNull(),
  tokenHash: text('token_hash').notNull(),
  parentId: uuid('parent_id'),
  expiresAt: ts('expires_at').notNull(),
  consumedAt: ts('consumed_at'),
  createdAt: ts('created_at').notNull().defaultNow(),
});

export const authTransactions = pgTable('auth_transactions', {
  id: uuid('id').primaryKey().defaultRandom(),
  kind: text('kind', { enum: ['EMAIL_OTP', 'OAUTH', 'LINK', 'HANDOFF'] }).notNull(),
  purpose: text('purpose', { enum: ['LOGIN', 'REAUTH'] }).notNull().default('LOGIN'),
  client: text('client', { enum: ['WEB', 'IOS', 'SUPPORT_CLI'] }).notNull(),
  clientRequestId: uuid('client_request_id'),
  userId: uuid('user_id'),
  emailHash: text('email_hash'),
  ipHash: text('ip_hash'),
  secretHash: text('secret_hash'),
  binderHash: text('binder_hash'),
  appChallenge: text('app_challenge'),
  provider: text('provider'),
  providerState: jsonb('provider_state').notNull(),
  returnTarget: text('return_target'),
  resultFamilyId: uuid('result_family_id'),
  attempts: integer('attempts').notNull().default(0),
  maxAttempts: integer('max_attempts').notNull().default(5),
  expiresAt: ts('expires_at').notNull(),
  consumedAt: ts('consumed_at'),
  createdAt: ts('created_at').notNull().defaultNow(),
});

export const roles = pgTable('roles', {
  userId: uuid('user_id').notNull(),
  role: text('role', { enum: ['analyst', 'data_admin', 'support'] }).notNull(),
  grantedBy: text('granted_by').notNull(),
  grantedAt: ts('granted_at').notNull().defaultNow(),
}, (t) => [primaryKey({ columns: [t.userId, t.role] })]);
