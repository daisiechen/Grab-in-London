import { integer, pgTable, primaryKey, text, timestamp, uuid } from 'drizzle-orm/pg-core';
export const apiRateLimits = pgTable('api_rate_limits', { actorId:uuid('actor_id').notNull(),bucket:text('bucket').notNull(),windowStart:timestamp('window_start',{withTimezone:true,mode:'date'}).notNull(),count:integer('count').notNull() }, t=>[primaryKey({columns:[t.actorId,t.bucket,t.windowStart]})]);
