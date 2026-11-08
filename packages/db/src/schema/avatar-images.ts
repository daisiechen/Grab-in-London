import { customType, integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
const bytea = customType<{ data: Buffer; driverData: Buffer }>({ dataType: () => 'bytea' });
/** Member-uploaded profile photo (metadata-free JPEG); see migration 0026. */
export const avatarImages = pgTable('avatar_images', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().unique(),
  contentType: text('content_type').notNull(),
  bytes: bytea('bytes').notNull(),
  width: integer('width').notNull(),
  height: integer('height').notNull(),
  sha256: text('sha256').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
});
