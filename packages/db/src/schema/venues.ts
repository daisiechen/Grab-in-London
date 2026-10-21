import { bigint, pgTable, text, uuid } from 'drizzle-orm/pg-core';
export const venues = pgTable('venues', {
  id: uuid('id').primaryKey().defaultRandom(),
  placeId: text('place_id').notNull(),
  provider: text('provider', { enum: ['google', 'fixture'] }).notNull(),
  areaCode: text('area_code').notNull().default('unknown'),
  areaVersion:text('area_version'),
  areaRevision:bigint('area_revision',{mode:'bigint'}).notNull().default(0n),
});
