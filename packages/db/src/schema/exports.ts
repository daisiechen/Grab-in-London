import { bigint, integer, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
const ts=(name:string)=>timestamp(name,{withTimezone:true,mode:'date'});
export const analyticsExports=pgTable('analytics_exports',{
  id:uuid('id').primaryKey().defaultRandom(),actorId:uuid('actor_id').notNull(),snapshotId:uuid('snapshot_id').notNull(),
  privacyEpoch:bigint('privacy_epoch',{mode:'bigint'}).notNull(),metric:text('metric').notNull(),filterHash:text('filter_hash').notNull(),filters:jsonb('filters').notNull(),
  byteCount:integer('byte_count').notNull(),rowCount:integer('row_count').notNull(),createdAt:ts('created_at').notNull().defaultNow(),expiresAt:ts('expires_at').notNull(),revokedAt:ts('revoked_at'),
});
