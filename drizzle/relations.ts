import { relations } from "drizzle-orm/relations";
import { estates, estateManagers, managers, payments, subscriptionPlans } from "./schema";

export const estateManagersRelations = relations(estateManagers, ({one, many}) => ({
	estate: one(estates, {
		fields: [estateManagers.estateId],
		references: [estates.id]
	}),
	manager: one(managers, {
		fields: [estateManagers.managerId],
		references: [managers.id]
	}),
	payments: many(payments),
}));

export const estatesRelations = relations(estates, ({one, many}) => ({
	estateManagers: many(estateManagers),
	payment: one(payments as any, {
		fields: [estates.paymentId],
		references: [payments.id],
		relationName: "estates_paymentId_payments_id"
	}),
	subscriptionPlan: one(subscriptionPlans, {
		fields: [estates.planId],
		references: [subscriptionPlans.id]
	}),
	payments: many(payments as any, {
		relationName: "payments_estateId_estates_id"
	}),
}));

export const managersRelations = relations(managers, ({many}) => ({
	estateManagers: many(estateManagers),
}));

export const paymentsRelations = relations(payments, ({one, many}) => ({
	estates: many(estates as any, {
		relationName: "estates_paymentId_payments_id"
	}),
	estate: one(estates as any, {
		fields: [payments.estateId],
		references: [estates.id],
		relationName: "payments_estateId_estates_id"
	}),
	estateManager: one(estateManagers, {
		fields: [payments.paidBy],
		references: [estateManagers.id]
	}),
	subscriptionPlan: one(subscriptionPlans, {
		fields: [payments.planId],
		references: [subscriptionPlans.id]
	}),
}));

export const subscriptionPlansRelations = relations(subscriptionPlans, ({many}) => ({
	estates: many(estates),
	payments: many(payments),
}));
