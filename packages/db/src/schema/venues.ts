import { pgTable, text, uuid } from 'drizzle-orm/pg-core';
export const venues = pgTable('venues', {
  id: uuid('id').primaryKey().defaultRandom(),
  placeId: text('place_id').notNull(),
  provider: text('provider', { enum: ['google', 'fixture'] }).notNull(),
  areaCode: text('area_code').notNull().default('unknown'),
});
