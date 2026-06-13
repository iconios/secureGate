import { pgTable, foreignKey, uuid, timestamp, text, smallint, pgEnum } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { payments } from './payments.js';
import { relations } from 'drizzle-orm/relations';
import { estateManagers } from './estateManagers.js';
import { subscriptionPlans } from './subscriptionPlans.js';

export const estateStatus = pgEnum('estate_status', [
  'pending',
  'active',
  'inactive',
  'expired',
  'pending_payment',
]);

export const estates = pgTable(
  'estates',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    location: text(),
    name: text(),
    state: text(),
    planId: uuid('plan_id'),
    paymentId: uuid('payment_id'),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }),
    deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'string' }),
    numberOfHouseholds: smallint('number_of_households').default(sql`'0'`),
    status: estateStatus().notNull(),
    logoUrl: text('logo_url'),
  },
  (table) => [
    foreignKey({
      columns: [table.paymentId],
      foreignColumns: [payments.id],
      name: 'estates_payment_id_fkey',
    }),
    foreignKey({
      columns: [table.planId],
      foreignColumns: [subscriptionPlans.id],
      name: 'estates_plan_id_fkey',
    }),
  ],
);

export const estatesRelations = relations(estates, ({ one, many }) => ({
  estateManagers: many(estateManagers),
  payment: one(payments, {
    fields: [estates.paymentId],
    references: [payments.id],
    relationName: 'estates_paymentId_payments_id',
  }),
  subscriptionPlan: one(subscriptionPlans, {
    fields: [estates.planId],
    references: [subscriptionPlans.id],
  }),
  payments: many(payments, {
    relationName: 'payments_estateId_estates_id',
  }),
}));
