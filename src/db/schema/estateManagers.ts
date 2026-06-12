import { pgTable, foreignKey, uuid, timestamp } from "drizzle-orm/pg-core"
import { relations } from "drizzle-orm/relations";
import { estates } from "./estates.js";
import { managers } from "./managers.js";

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

export const estateManagersRelations = relations(estateManagers, ({one, many}) => ({
	estate: one(estates, {
		fields: [estateManagers.estateId],
		references: [estates.id]
	}),
	manager: one(managers, {
		fields: [estateManagers.managerId],
		references: [managers.id]
	}),
}));