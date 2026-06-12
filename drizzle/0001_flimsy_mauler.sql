ALTER TABLE "activity_logs" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "email_verification_requests" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "estate_managers" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "estates" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "managers" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "payments" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "subscription_plans" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "payments" DROP CONSTRAINT "payments_estate_id_fkey";
--> statement-breakpoint
ALTER TABLE "payments" DROP CONSTRAINT "payments_paid_by_fkey";
--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_paid_by_fkey" FOREIGN KEY ("paid_by") REFERENCES "public"."managers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
DROP TYPE "public"."entity_type";--> statement-breakpoint
DROP TYPE "public"."payment_status";