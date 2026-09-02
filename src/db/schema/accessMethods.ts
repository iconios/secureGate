import { pgTable, uuid, timestamp, boolean, text, varchar, uniqueIndex } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm/relations';
import { userAccessMethods } from './userAccessMethods.js';

export const accessMethods = pgTable(
  'access_methods',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    methodKey: varchar('method_key', { length: 50 }).notNull(),
    name: varchar('name', { length: 100 }).notNull(),
    description: varchar('description', { length: 255 }).notNull(),
    isActive: boolean('is_active').default(true).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .$onUpdate(() => new Date().toISOString())
      .notNull(),
  },
  (table) => [uniqueIndex('access_methods_method_key_uidx').on(table.methodKey)],
).enableRLS();

export const accessMethodsRelations = relations(accessMethods, ({ one, many }) => ({
  userAccessMethods: many(userAccessMethods),
}));
