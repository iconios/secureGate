import { pgTable, uuid, timestamp, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm/relations';
import { managers } from './managers.js';
import { residents } from './residents.js';
import { accessMethods } from './accessMethods.js';

export const userAccessMethods = pgTable(
  'user_access_methods',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .$onUpdate(() => new Date().toISOString())
      .notNull(),
    accessMethodId: uuid('access_method_id')
      .notNull()
      .references(() => accessMethods.id, {
        onDelete: 'cascade',
        onUpdate: 'cascade',
      }),
    residentId: uuid('user_id').references(() => residents.id, {
      onDelete: 'cascade',
      onUpdate: 'cascade',
    }),
    managerId: uuid('manager_id').references(() => managers.id, {
      onDelete: 'cascade',
      onUpdate: 'cascade',
    }),
  },
  (table) => [
    uniqueIndex('user_access_methods_resident_method_uidx').on(
      table.residentId,
      table.accessMethodId,
    ),
    uniqueIndex('user_access_methods_manager_method_uidx').on(
      table.managerId,
      table.accessMethodId,
    ),
    index('user_access_methods_access_method_id_idx').on(table.accessMethodId),
    uniqueIndex('user_access_methods_resident_access_method_uidx').on(
      table.residentId,
      table.accessMethodId,
    ),

    uniqueIndex('user_access_methods_manager_access_method_uidx').on(
      table.managerId,
      table.accessMethodId,
    ),
  ],
).enableRLS();

export const userAccessMethodsRelations = relations(userAccessMethods, ({ one, many }) => ({
  resident: one(residents, {
    fields: [userAccessMethods.residentId],
    references: [residents.id],
  }),
  manager: one(managers, {
    fields: [userAccessMethods.managerId],
    references: [managers.id],
  }),
  accessMethod: one(accessMethods, {
    fields: [userAccessMethods.accessMethodId],
    references: [accessMethods.id],
  }),
}));
