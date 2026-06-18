CREATE TABLE "configuration_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"key" text NOT NULL,
	"description" text,
	"value" text NOT NULL,
	"updated_at" timestamp with time zone
);
