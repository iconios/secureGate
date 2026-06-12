import { pgTable, uuid, timestamp, text, smallint, numeric } from "drizzle-orm/pg-core"

export const subscriptionPlans = pgTable("subscription_plans", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	name: text(),
	pricePerPeriod: numeric("price_per_period"),
	status: text(),
	householdLimit: smallint("household_limit"),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }),
	description: text(),
	monthlyFee: numeric("monthly_fee"),
	yearlyFee: numeric("yearly_fee").default('0.00'),
});