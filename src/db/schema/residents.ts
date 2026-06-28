import { pgTable, foreignKey, uuid, timestamp, text, pgEnum, index } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm/relations';
import { households } from './households.js';
import { persons } from './persons.js';
import { managers } from './managers.js';

export const roleEnum = pgEnum('roles', ['principal', 'assistant', 'member']);

export const residents = pgTable(
  'residents',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }),
    householdId: uuid('household_id').notNull(),
    personId: uuid('person_id').notNull(),
    role: roleEnum().default('member').notNull(),
    delistedAt: timestamp('delisted_at', { withTimezone: true, mode: 'string' }),
    addedByManager: uuid('added_by_manager'),
    addedByPerson: uuid('added_by_person'),
    code: text().notNull().unique(),
  },
  (table) => [
    foreignKey({
      columns: [table.householdId],
      foreignColumns: [households.id],
      name: 'residents_household_id_fkey',
    }),
    foreignKey({
      columns: [table.personId],
      foreignColumns: [persons.id],
      name: 'residents_person_id_fkey',
    }),
    foreignKey({
      columns: [table.addedByManager],
      foreignColumns: [managers.id],
      name: 'residents_added_by_manager_fkey',
    }),
    foreignKey({
      columns: [table.addedByPerson],
      foreignColumns: [persons.id],
      name: 'residents_added_by_person_fkey',
    }),
    index('residents_household_id_idx').on(table.householdId),
    index('residents_person_id_idx').on(table.personId),
    index('residents_household_person_delisted_idx').on(
      table.householdId,
      table.personId,
      table.delistedAt,
    )
  ],
).enableRLS();

export const residentsRelations = relations(residents, ({ one }) => ({
  household: one(households, {
    fields: [residents.householdId],
    references: [households.id],
  }),
  person: one(persons, {
    fields: [residents.personId],
    references: [persons.id],
    relationName: 'resident_person',
  }),
  manager: one(managers, {
    fields: [residents.addedByManager],
    references: [managers.id],
  }),
  addedByPerson: one(persons, {
    fields: [residents.addedByPerson],
    references: [persons.id],
    relationName: 'resident_added_by_person',
  }),
}));