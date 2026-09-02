CREATE TABLE "access_methods" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"mobile_app" boolean DEFAULT true,
	"rfid_key_card" boolean DEFAULT false,
	"biometric" boolean DEFAULT true,
	"vehicle_tag" boolean DEFAULT false,
	"numeric_access_code" boolean DEFAULT true
);
--> statement-breakpoint
ALTER TABLE "access_methods" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "user_access_methods" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"user_id" uuid,
	"manager_id" uuid
);
--> statement-breakpoint
ALTER TABLE "user_access_methods" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "residents" ADD COLUMN "gate_entry" boolean DEFAULT true;--> statement-breakpoint
ALTER TABLE "residents" ADD COLUMN "guest_pre_authorize" boolean DEFAULT true;--> statement-breakpoint
ALTER TABLE "residents" ADD COLUMN "vehicle_registration" boolean DEFAULT true;--> statement-breakpoint
ALTER TABLE "residents" ADD COLUMN "emergency_alert" boolean DEFAULT true;--> statement-breakpoint
ALTER TABLE "user_access_methods" ADD CONSTRAINT "user_access_methods_resident_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."residents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_access_methods" ADD CONSTRAINT "user_access_methods_manager_id_fkey" FOREIGN KEY ("manager_id") REFERENCES "public"."managers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "access_methods_id_idx" ON "access_methods" USING btree ("id");--> statement-breakpoint
CREATE INDEX "user_access_methods_resident_id_idx" ON "user_access_methods" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_access_methods_manager_id_idx" ON "user_access_methods" USING btree ("manager_id");