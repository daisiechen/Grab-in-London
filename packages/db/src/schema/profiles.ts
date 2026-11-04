import { jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
export const profiles = pgTable('profiles', {
  userId: uuid('user_id').primaryKey(),
  displayName: text('display_name'),
  avatarImageId: uuid('avatar_image_id'),
  bio: text('bio'),
  languages: text('languages').array().notNull().default([]),
  lifeStatus: text('life_status'),
  interests: text('interests').array().notNull().default([]),
  background: jsonb('background').notNull().default({}),
  ageConfirmedVersion: text('age_confirmed_version'),
  communityAcceptedVersion: text('community_accepted_version'),
  /** 0030: first time the profile gate was complete; set once by the server. */
  completedAt: timestamp('completed_at', { withTimezone: true, mode: 'date' }),
  moderationHiddenAt: timestamp('moderation_hidden_at', { withTimezone: true, mode: 'date' }),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
});
