ALTER TABLE "households" ADD COLUMN "mobile_access" boolean DEFAULT true;--> statement-breakpoint
ALTER TABLE "households" ADD COLUMN "guest_pre_authorize" boolean DEFAULT true;--> statement-breakpoint
ALTER TABLE "households" ADD COLUMN "guest_arrival_notify" boolean DEFAULT true;--> statement-breakpoint
ALTER TABLE "households" ADD COLUMN "emergency_alerts" boolean DEFAULT true;