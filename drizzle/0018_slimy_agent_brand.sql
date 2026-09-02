CREATE TYPE "public"."day_of_week" AS ENUM('monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday');--> statement-breakpoint
CREATE TYPE "public"."schedule_type" AS ENUM('always_active', 'custom_hours');--> statement-breakpoint
CREATE TABLE "access_schedules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"resident_id" uuid NOT NULL,
	"schedule_type" "schedule_type" DEFAULT 'always_active' NOT NULL,
	"allow_public_holidays" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "access_schedules" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "access_time_slots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"access_schedule_id" uuid NOT NULL,
	"day_of_week" "day_of_week" NOT NULL,
	"start_time" time NOT NULL,
	"end_time" time NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "access_time_slots_time_order_check" CHECK ("access_time_slots"."end_time" > "access_time_slots"."start_time")
);
--> statement-breakpoint
ALTER TABLE "access_time_slots" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "persons" DROP CONSTRAINT "persons_estate_id_fkey";
--> statement-breakpoint
ALTER TABLE "residents" DROP CONSTRAINT "residents_estate_id_fkey";
--> statement-breakpoint
ALTER TABLE "residents" DROP CONSTRAINT "residents_household_id_fkey";
--> statement-breakpoint
ALTER TABLE "residents" DROP CONSTRAINT "residents_person_id_fkey";
--> statement-breakpoint
ALTER TABLE "residents" DROP CONSTRAINT "residents_added_by_manager_fkey";
--> statement-breakpoint
ALTER TABLE "residents" DROP CONSTRAINT "residents_added_by_person_fkey";
--> statement-breakpoint
ALTER TABLE "user_access_methods" DROP CONSTRAINT "user_access_methods_resident_id_fkey";
--> statement-breakpoint
ALTER TABLE "user_access_methods" DROP CONSTRAINT "user_access_methods_manager_id_fkey";
--> statement-breakpoint
DROP INDEX "access_methods_id_idx";--> statement-breakpoint
DROP INDEX "user_access_methods_resident_id_idx";--> statement-breakpoint
DROP INDEX "user_access_methods_manager_id_idx";--> statement-breakpoint
ALTER TABLE "residents" ALTER COLUMN "gate_entry" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "residents" ALTER COLUMN "guest_pre_authorize" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "residents" ALTER COLUMN "vehicle_registration" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "residents" ALTER COLUMN "emergency_alert" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "access_methods" ADD COLUMN "method_key" varchar(50) NOT NULL;--> statement-breakpoint
ALTER TABLE "access_methods" ADD COLUMN "name" varchar(100) NOT NULL;--> statement-breakpoint
ALTER TABLE "access_methods" ADD COLUMN "description" varchar(255) NOT NULL;--> statement-breakpoint
ALTER TABLE "access_methods" ADD COLUMN "is_active" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "access_methods" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "user_access_methods" ADD COLUMN "access_method_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "access_schedules" ADD CONSTRAINT "access_schedules_resident_id_residents_id_fk" FOREIGN KEY ("resident_id") REFERENCES "public"."residents"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "access_time_slots" ADD CONSTRAINT "access_time_slots_access_schedule_id_access_schedules_id_fk" FOREIGN KEY ("access_schedule_id") REFERENCES "public"."access_schedules"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE UNIQUE INDEX "access_schedules_resident_id_uidx" ON "access_schedules" USING btree ("resident_id");--> statement-breakpoint
CREATE UNIQUE INDEX "access_time_slots_unique_slot_uidx" ON "access_time_slots" USING btree ("access_schedule_id","day_of_week","start_time","end_time");--> statement-breakpoint
CREATE INDEX "access_time_slots_schedule_day_idx" ON "access_time_slots" USING btree ("access_schedule_id","day_of_week");--> statement-breakpoint
ALTER TABLE "persons" ADD CONSTRAINT "persons_estate_id_estates_id_fk" FOREIGN KEY ("estate_id") REFERENCES "public"."estates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "residents" ADD CONSTRAINT "residents_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "residents" ADD CONSTRAINT "residents_estate_id_estates_id_fk" FOREIGN KEY ("estate_id") REFERENCES "public"."estates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "residents" ADD CONSTRAINT "residents_person_id_persons_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."persons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "residents" ADD CONSTRAINT "residents_added_by_manager_managers_id_fk" FOREIGN KEY ("added_by_manager") REFERENCES "public"."managers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "residents" ADD CONSTRAINT "residents_added_by_person_persons_id_fk" FOREIGN KEY ("added_by_person") REFERENCES "public"."persons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_access_methods" ADD CONSTRAINT "user_access_methods_access_method_id_access_methods_id_fk" FOREIGN KEY ("access_method_id") REFERENCES "public"."access_methods"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "user_access_methods" ADD CONSTRAINT "user_access_methods_user_id_residents_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."residents"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "user_access_methods" ADD CONSTRAINT "user_access_methods_manager_id_managers_id_fk" FOREIGN KEY ("manager_id") REFERENCES "public"."managers"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE UNIQUE INDEX "access_methods_method_key_uidx" ON "access_methods" USING btree ("method_key");--> statement-breakpoint
CREATE UNIQUE INDEX "user_access_methods_resident_method_uidx" ON "user_access_methods" USING btree ("user_id","access_method_id");--> statement-breakpoint
CREATE UNIQUE INDEX "user_access_methods_manager_method_uidx" ON "user_access_methods" USING btree ("manager_id","access_method_id");--> statement-breakpoint
CREATE INDEX "user_access_methods_access_method_id_idx" ON "user_access_methods" USING btree ("access_method_id");--> statement-breakpoint
CREATE UNIQUE INDEX "user_access_methods_resident_access_method_uidx" ON "user_access_methods" USING btree ("user_id","access_method_id");--> statement-breakpoint
CREATE UNIQUE INDEX "user_access_methods_manager_access_method_uidx" ON "user_access_methods" USING btree ("manager_id","access_method_id");--> statement-breakpoint
ALTER TABLE "access_methods" DROP COLUMN "mobile_app";--> statement-breakpoint
ALTER TABLE "access_methods" DROP COLUMN "rfid_key_card";--> statement-breakpoint
ALTER TABLE "access_methods" DROP COLUMN "biometric";--> statement-breakpoint
ALTER TABLE "access_methods" DROP COLUMN "vehicle_tag";--> statement-breakpoint
ALTER TABLE "access_methods" DROP COLUMN "numeric_access_code";