import { pgTable, foreignKey, uuid, timestamp, text, index } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm/relations';
import { estates } from './estates.js';

export const households = pgTable(
  'households',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }),
    code: text().notNull().unique(),
    estateId: uuid('estate_id').notNull(),
    blockOrStreet: text('block_or_street'),
    unitNumber: text('unit_number').notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.estateId],
      foreignColumns: [estates.id],
      name: 'households_estate_id_fkey',
    }),
    index('households_estate_id_idx').on(table.estateId),
  ],
).enableRLS();

export const householdsRelations = relations(households, ({ one, many }) => ({
  estate: one(estates, {
    fields: [households.estateId],
    references: [estates.id],
  }),
}));
