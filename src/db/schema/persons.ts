import {
  pgTable,
  foreignKey,
  uuid,
  timestamp,
  text,
  pgEnum,
  date,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm/relations';
import { estates } from './estates.js';
import { sql } from 'drizzle-orm';

export const genderEnum = pgEnum('genders', ['male', 'female', 'unknown']);

export const persons = pgTable(
  'persons',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }),
    fullName: text('full_name').notNull(),
    gender: genderEnum().default('unknown').notNull(),
    dateOfBirth: date('date_of_birth'),
    photoUrl: text('photo_url'),
    phone: text(),
    estateId: uuid('estate_id').notNull(),
    email: text(),
  },
  (table) => [
    foreignKey({
      columns: [table.estateId],
      foreignColumns: [estates.id],
      name: 'persons_estate_id_fkey',
    }),
    uniqueIndex('persons_estate_email_unique_idx').on(table.estateId, sql`lower(${table.email})`),
    uniqueIndex('persons_estate_phone_unique_idx').on(table.estateId, sql`lower(${table.phone})`),
  ],
).enableRLS();

export const personsRelations = relations(persons, ({ one }) => ({
  estate: one(estates, {
    fields: [persons.estateId],
    references: [estates.id],
  }),
}));
