import{integer,jsonb,pgTable,smallint,text,timestamp,uuid}from'drizzle-orm/pg-core';
const ts=(name:string)=>timestamp(name,{withTimezone:true,mode:'date'});
export const analyticsDiscoveryRequests=pgTable('analytics_discovery_requests',{
 requestId:uuid('request_id').primaryKey(),scopeKey:text('scope_key').notNull(),anonymousId:text('anonymous_id').notNull(),userId:uuid('user_id'),sessionId:text('session_id').notNull(),resultCount:integer('result_count').notNull(),resultMealIds:uuid('result_meal_ids').array().notNull(),eligibleMealIds:uuid('eligible_meal_ids').array().notNull(),outcome:text('outcome').notNull(),filters:jsonb('filters').notNull(),occurredAt:ts('occurred_at').notNull(),receivedAt:ts('received_at').notNull(),environment:text('environment').notNull(),classification:text('classification').notNull(),
});
export const analyticsDeliveries=pgTable('analytics_deliveries',{
 id:uuid('id').primaryKey().defaultRandom(),eventId:uuid('event_id'),userId:uuid('user_id'),outcome:text('outcome').notNull(),reason:text('reason'),receivedAt:ts('received_at').notNull().defaultNow(),environment:text('environment').notNull(),classification:text('classification').notNull(),
});
export const analyticsDeliveryCoverage=pgTable('analytics_delivery_coverage',{
 id:smallint('id').primaryKey(),startedAt:ts('started_at').notNull().defaultNow(),
});
