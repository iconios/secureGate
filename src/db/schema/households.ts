import {
  pgTable,
  foreignKey,
  uuid,
  timestamp,
  text,
  index,
  uniqueIndex,
  boolean,
} from 'drizzle-orm/pg-core';
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
    mobileAccess: boolean('mobile_access').default(true),
    guestPreAuthorize: boolean('guest_pre_authorize').default(true),
    guestArrivalNotify: boolean('guest_arrival_notify').default(true),
    emergencyAlerts: boolean('emergency_alerts').default(true),
  },
  (table) => [
    foreignKey({
      columns: [table.estateId],
      foreignColumns: [estates.id],
      name: 'households_estate_id_fkey',
    }),
    index('households_estate_id_idx').on(table.estateId),
    index('households_unit_number_idx').on(table.unitNumber),
    index('households_code_idx').on(table.code),
    index('households_estate_id_code_idx').on(table.estateId, table.code),
    uniqueIndex('households_estate_id_unit_number_block_or_street_idx').on(
      table.estateId,
      table.blockOrStreet,
      table.unitNumber,
    ),
  ],
).enableRLS();

export const householdsRelations = relations(households, ({ one, many }) => ({
  estate: one(estates, {
    fields: [households.estateId],
    references: [estates.id],
  }),
}));
