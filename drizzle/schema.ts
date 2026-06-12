import { pgTable, foreignKey, uuid, timestamp, unique, text, boolean, smallint, numeric, time, jsonb, pgEnum } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"

export const entityType = pgEnum("entity_type", ['manager', 'resident', 'guard', 'guest', 'vehicle'])
export const estateStatus = pgEnum("estate_status", ['pending', 'active', 'inactive', 'expired', 'pending_payment'])
export const paymentStatus = pgEnum("payment_status", ['paid', 'rejected', 'pending', 'initializing', 'failed', 'initialization_failed'])

export const managers = pgTable("managers", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	fullName: text("full_name"),
	email: text().notNull(),
	phone: text(),
	passwordHash: text("password_hash"),
	lastLoginAt: timestamp("last_login_at", { withTimezone: true, mode: 'string' }),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }),
	isVerified: boolean("is_verified").default(false).notNull(),
	verifiedAt: timestamp("verified_at", { withTimezone: true, mode: 'string' }),
}, (table) => [
	unique("managers_email_key").on(table.email),
]);

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

export const estates = pgTable("estates", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	location: text(),
	name: text(),
	state: text(),
	planId: uuid("plan_id"),
	paymentId: uuid("payment_id"),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }),
	numberOfHouseholds: smallint("number_of_households").default(sql`'0'`),
	status: estateStatus().notNull(),
	logoUrl: text("logo_url"),
}, (table) => [
	foreignKey({
			columns: [table.paymentId],
			foreignColumns: [payments.id],
			name: "estates_payment_id_fkey"
		}),
	foreignKey({
			columns: [table.planId],
			foreignColumns: [subscriptionPlans.id],
			name: "estates_plan_id_fkey"
		}),
]);

export const estateManagers = pgTable("estate_managers", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	managerId: uuid("manager_id").notNull(),
	estateId: uuid("estate_id").notNull(),
}, (table) => [
	foreignKey({
			columns: [table.estateId],
			foreignColumns: [estates.id],
			name: "estate_managers_estate_id_fkey"
		}),
	foreignKey({
			columns: [table.managerId],
			foreignColumns: [managers.id],
			name: "estate_managers_manager_id_fkey"
		}),
]);

export const activityLogs = pgTable("activity_logs", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	timestamp: timestamp({ withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	managerId: uuid("manager_id"),
	estateId: uuid("estate_id"),
	action: text(),
	deviceInfo: text("device_info"),
	previousValue: text("previous_value"),
	newValue: text("new_value"),
	ipAddress: text("ip_address"),
	entityType: text("entity_type"),
	residentId: uuid("resident_id"),
	guardId: uuid("guard_id"),
});

export const payments = pgTable("payments", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	transactionId: uuid("transaction_id"),
	estateId: uuid("estate_id").notNull(),
	expiresAt: timestamp("expires_at", { withTimezone: true, mode: 'string' }),
	paidBy: uuid("paid_by").notNull(),
	reference: text().notNull(),
	paidAt: time("paid_at", { withTimezone: true }),
	purpose: text(),
	amount: numeric(),
	status: text(),
	period: text().default('month'),
	authorizationUrl: text("authorization_url"),
	accessCode: text("access_code"),
	initializedAt: timestamp("initialized_at", { withTimezone: true, mode: 'string' }),
	currency: text().default('NGN'),
	provider: text(),
	payerEmail: text("payer_email"),
	providerResponse: jsonb("provider_response"),
	planId: uuid("plan_id"),
}, (table) => [
	foreignKey({
			columns: [table.paidBy],
			foreignColumns: [managers.id],
			name: "payments_paid_by_fkey"
		}),
	foreignKey({
			columns: [table.planId],
			foreignColumns: [subscriptionPlans.id],
			name: "payments_plan_id_fkey"
		}),
	unique("payments_gateway_reference_key").on(table.reference),
]);

export const emailVerificationRequests = pgTable("email_verification_requests", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	email: text().notNull(),
	purpose: text(),
	codeHash: text("code_hash"),
	status: text(),
	sentCount: smallint("sent_count").default(sql`'0'`),
	lastSentAt: timestamp("last_Sent_at", { withTimezone: true, mode: 'string' }),
	nextAllowedAt: timestamp("next_allowed_at", { withTimezone: true, mode: 'string' }),
	windowStartedAt: timestamp("window_started_at", { withTimezone: true, mode: 'string' }),
	windowExpiresAt: timestamp("window_expires_at", { withTimezone: true, mode: 'string' }),
	codeExpiresAt: timestamp("code_expires_at", { withTimezone: true, mode: 'string' }),
	usedAt: timestamp("used_at", { withTimezone: true, mode: 'string' }),
	ipAddress: text("ip_address"),
	userAgent: text("user_agent"),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }),
});
