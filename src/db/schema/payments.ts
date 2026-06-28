import {
  pgTable,
  foreignKey,
  uuid,
  timestamp,
  unique,
  text,
  numeric,
  jsonb,
  index,
} from 'drizzle-orm/pg-core';
import { estates } from './estates.js';
import { relations } from 'drizzle-orm/relations';
import { subscriptionPlans } from './subscriptionPlans.js';
import { managers } from './managers.js';

export const payments = pgTable(
  'payments',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    transactionId: uuid('transaction_id'),
    estateId: uuid('estate_id').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'string' }),
    paidBy: uuid('paid_by').notNull(),
    reference: text().notNull(),
    paidAt: timestamp('paid_at', { withTimezone: true, mode: 'string' }),
    purpose: text(),
    amount: numeric(),
    status: text(),
    period: text().default('month'),
    authorizationUrl: text('authorization_url'),
    accessCode: text('access_code'),
    initializedAt: timestamp('initialized_at', { withTimezone: true, mode: 'string' }),
    currency: text().default('NGN'),
    provider: text(),
    payerEmail: text('payer_email'),
    providerResponse: jsonb('provider_response'),
    planId: uuid('plan_id'),
  },
  (table) => [
    foreignKey({
      columns: [table.paidBy],
      foreignColumns: [managers.id],
      name: 'payments_paid_by_fkey',
    }),
    foreignKey({
      columns: [table.planId],
      foreignColumns: [subscriptionPlans.id],
      name: 'payments_plan_id_fkey',
    }),
    unique('payments_gateway_reference_key').on(table.reference),
    index('payments_estate_id_idx').on(table.estateId),
    index('payments_plan_id_idx').on(table.planId),
    index('payments_paid_by_idx').on(table.paidBy),
  ],
).enableRLS();

export const paymentsRelations = relations(payments, ({ one, many }) => ({
  estate: one(estates as any, {
    fields: [payments.estateId],
    references: [estates.id],
    relationName: 'payments_estateId_estates_id',
  }),
  manager: one(managers, {
    fields: [payments.paidBy],
    references: [managers.id],
  }),
  subscriptionPlan: one(subscriptionPlans, {
    fields: [payments.planId],
    references: [subscriptionPlans.id],
  }),
}));
