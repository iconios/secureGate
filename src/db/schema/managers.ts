import { pgTable, uuid, timestamp, unique, text, boolean } from "drizzle-orm/pg-core"
import { relations } from "drizzle-orm/relations";
import { estateManagers } from "./estateManagers.js";

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

export const managersRelations = relations(managers, ({many}) => ({
	estateManagers: many(estateManagers),
}));