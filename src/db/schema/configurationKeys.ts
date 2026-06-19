import { pgTable, uuid, timestamp, text } from 'drizzle-orm/pg-core';

export const configurationKeys = pgTable('configuration_keys', {
  id: uuid().defaultRandom().primaryKey().notNull(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
  key: text().notNull().unique(),
  description: text(),
  value: text().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }),
});
