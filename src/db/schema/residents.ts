import { pgTable, uuid, timestamp, text, pgEnum, index, boolean } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm/relations';
import { households } from './households.js';
import { persons } from './persons.js';
import { managers } from './managers.js';
import { estates } from './estates.js';
import { userAccessMethods } from './userAccessMethods.js';

export const roleEnum = pgEnum('roles', ['principal', 'assistant', 'member']);

export const residents = pgTable(
  'residents',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }),
    householdId: uuid('household_id')
      .notNull()
      .references(() => households.id, { onDelete: 'cascade' }),
    estateId: uuid('estate_id')
      .notNull()
      .references(() => estates.id, { onDelete: 'cascade' }),
    personId: uuid('person_id')
      .notNull()
      .references(() => persons.id, { onDelete: 'cascade' }),
    role: roleEnum().default('member').notNull(),
    delistedAt: timestamp('delisted_at', { withTimezone: true, mode: 'string' }),
    addedByManager: uuid('added_by_manager').references(() => managers.id),
    addedByPerson: uuid('added_by_person').references(() => persons.id),
    code: text().notNull().unique(),
    gateEntry: boolean('gate_entry').default(true).notNull(),
    guestPreAuthorize: boolean('guest_pre_authorize').default(true).notNull(),
    vehicleRegistration: boolean('vehicle_registration').default(true).notNull(),
    emergencyAlert: boolean('emergency_alert').default(true).notNull(),
  },
  (table) => [
    index('residents_household_id_idx').on(table.householdId),
    index('residents_person_id_idx').on(table.personId),
    index('residents_estate_id_idx').on(table.estateId),
    index('residents_household_person_delisted_idx').on(
      table.householdId,
      table.personId,
      table.delistedAt,
    ),
  ],
).enableRLS();

export const residentsRelations = relations(residents, ({ one, many }) => ({
  estate: one(estates, {
    fields: [residents.estateId],
    references: [estates.id],
  }),
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
  userAccessMethods: many(userAccessMethods),
}));
