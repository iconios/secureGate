-- Current sql file was generated after introspecting the database
-- If you want to run this migration please uncomment this code before executing migrations
/*
CREATE TYPE "public"."entity_type" AS ENUM('manager', 'resident', 'guard', 'guest', 'vehicle');--> statement-breakpoint
CREATE TYPE "public"."estate_status" AS ENUM('pending', 'active', 'inactive', 'expired', 'pending_payment');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('paid', 'rejected', 'pending', 'initializing', 'failed', 'initialization_failed');--> statement-breakpoint
CREATE TABLE "estate_managers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"manager_id" uuid NOT NULL,
	"estate_id" uuid NOT NULL
);
--> statement-breakpoint
ALTER TABLE "estate_managers" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "managers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"full_name" text,
	"email" text NOT NULL,
	"phone" text,
	"password_hash" text,
	"last_login_at" timestamp with time zone,
	"updated_at" timestamp with time zone,
	"is_verified" boolean DEFAULT false NOT NULL,
	"verified_at" timestamp with time zone,
	CONSTRAINT "managers_email_key" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "managers" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "estates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"location" text,
	"name" text,
	"state" text,
	"plan_id" uuid,
	"payment_id" uuid,
	"updated_at" timestamp with time zone,
	"number_of_households" smallint DEFAULT '0',
	"status" "estate_status" NOT NULL,
	"logo_url" text
);
--> statement-breakpoint
ALTER TABLE "estates" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "subscription_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"name" text,
	"price_per_period" numeric,
	"status" text,
	"household_limit" smallint,
	"updated_at" timestamp with time zone,
	"description" text,
	"monthly_fee" numeric,
	"yearly_fee" numeric DEFAULT '0.00'
);
--> statement-breakpoint
ALTER TABLE "subscription_plans" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "activity_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"timestamp" timestamp with time zone DEFAULT now() NOT NULL,
	"manager_id" uuid,
	"estate_id" uuid,
	"action" text,
	"device_info" text,
	"previous_value" text,
	"new_value" text,
	"ip_address" text,
	"entity_type" text,
	"resident_id" uuid,
	"guard_id" uuid
);
--> statement-breakpoint
ALTER TABLE "activity_logs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"transaction_id" uuid,
	"estate_id" uuid NOT NULL,
	"expires_at" timestamp with time zone,
	"paid_by" uuid NOT NULL,
	"reference" text NOT NULL,
	"paid_at" time with time zone,
	"purpose" text,
	"amount" numeric,
	"status" text,
	"period" text DEFAULT 'month',
	"authorization_url" text,
	"access_code" text,
	"initialized_at" timestamp with time zone,
	"currency" text DEFAULT 'NGN',
	"provider" text,
	"payer_email" text,
	"provider_response" jsonb,
	"plan_id" uuid,
	CONSTRAINT "payments_gateway_reference_key" UNIQUE("reference")
);
--> statement-breakpoint
ALTER TABLE "payments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "email_verification_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"email" text NOT NULL,
	"purpose" text,
	"code_hash" text,
	"status" text,
	"sent_count" smallint DEFAULT '0',
	"last_Sent_at" timestamp with time zone,
	"next_allowed_at" timestamp with time zone,
	"window_started_at" timestamp with time zone,
	"window_expires_at" timestamp with time zone,
	"code_expires_at" timestamp with time zone,
	"used_at" timestamp with time zone,
	"ip_address" text,
	"user_agent" text,
	"updated_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "email_verification_requests" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "estate_managers" ADD CONSTRAINT "estate_managers_estate_id_fkey" FOREIGN KEY ("estate_id") REFERENCES "public"."estates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "estate_managers" ADD CONSTRAINT "estate_managers_manager_id_fkey" FOREIGN KEY ("manager_id") REFERENCES "public"."managers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "estates" ADD CONSTRAINT "estates_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "estates" ADD CONSTRAINT "estates_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "public"."subscription_plans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_estate_id_fkey" FOREIGN KEY ("estate_id") REFERENCES "public"."estates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_paid_by_fkey" FOREIGN KEY ("paid_by") REFERENCES "public"."estate_managers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "public"."subscription_plans"("id") ON DELETE no action ON UPDATE no action;
*/