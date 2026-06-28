CREATE TYPE "public"."genders" AS ENUM('male', 'female', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."roles" AS ENUM('principal', 'assistant', 'member');--> statement-breakpoint
CREATE TABLE "households" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone,
	"code" text NOT NULL,
	"estate_id" uuid NOT NULL,
	"block_or_street" text,
	"unit_number" text NOT NULL,
	CONSTRAINT "households_code_unique" UNIQUE("code")
);
--> statement-breakpoint
ALTER TABLE "households" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "persons" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone,
	"full_name" text NOT NULL,
	"gender" "genders" DEFAULT 'unknown' NOT NULL,
	"date_of_birth" date,
	"photo_url" text,
	"phone" text NOT NULL,
	"estate_id" uuid NOT NULL,
	"email" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "persons" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "residents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone,
	"household_id" uuid NOT NULL,
	"person_id" uuid NOT NULL,
	"role" "roles" DEFAULT 'member' NOT NULL,
	"delisted_at" timestamp with time zone,
	"added_by_manager" uuid,
	"added_by_person" uuid,
	"code" text NOT NULL,
	CONSTRAINT "residents_code_unique" UNIQUE("code")
);
--> statement-breakpoint
ALTER TABLE "residents" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "households" ADD CONSTRAINT "households_estate_id_fkey" FOREIGN KEY ("estate_id") REFERENCES "public"."estates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "persons" ADD CONSTRAINT "persons_estate_id_fkey" FOREIGN KEY ("estate_id") REFERENCES "public"."estates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "residents" ADD CONSTRAINT "residents_household_id_fkey" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "residents" ADD CONSTRAINT "residents_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "public"."persons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "residents" ADD CONSTRAINT "residents_added_by_manager_fkey" FOREIGN KEY ("added_by_manager") REFERENCES "public"."managers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "residents" ADD CONSTRAINT "residents_added_by_person_fkey" FOREIGN KEY ("added_by_person") REFERENCES "public"."persons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "households_estate_id_idx" ON "households" USING btree ("estate_id");--> statement-breakpoint
CREATE UNIQUE INDEX "persons_estate_email_unique_idx" ON "persons" USING btree ("estate_id",lower("email"));--> statement-breakpoint
CREATE INDEX "residents_household_id_idx" ON "residents" USING btree ("household_id");--> statement-breakpoint
CREATE INDEX "residents_person_id_idx" ON "residents" USING btree ("person_id");--> statement-breakpoint
CREATE INDEX "residents_household_person_delisted_idx" ON "residents" USING btree ("household_id","person_id","delisted_at");--> statement-breakpoint
CREATE INDEX "email_verification_requests_email_code_hash_status_idx" ON "email_verification_requests" USING btree ("email","code_hash","status");--> statement-breakpoint
CREATE INDEX "estate_managers_manager_id_idx" ON "estate_managers" USING btree ("manager_id");--> statement-breakpoint
CREATE INDEX "estate_managers_estate_id_idx" ON "estate_managers" USING btree ("estate_id");--> statement-breakpoint
CREATE INDEX "payments_estate_id_idx" ON "payments" USING btree ("estate_id");--> statement-breakpoint
CREATE INDEX "payments_plan_id_idx" ON "payments" USING btree ("plan_id");--> statement-breakpoint
CREATE INDEX "payments_paid_by_idx" ON "payments" USING btree ("paid_by");