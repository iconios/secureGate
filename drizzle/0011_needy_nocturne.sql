ALTER TABLE "residents" DROP CONSTRAINT "residents_estate_id_fkey";
--> statement-breakpoint
DROP INDEX "residents_estate_id_idx";--> statement-breakpoint
ALTER TABLE "residents" ADD COLUMN "estate_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "residents" ADD CONSTRAINT "residents_estate_id_fkey" FOREIGN KEY ("estate_id") REFERENCES "public"."estates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "residents_estate_id_idx" ON "residents" USING btree ("estate_id");