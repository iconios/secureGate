CREATE INDEX "households_unit_number_idx" ON "households" USING btree ("unit_number");--> statement-breakpoint
CREATE INDEX "households_code_idx" ON "households" USING btree ("code");--> statement-breakpoint
CREATE INDEX "households_estate_id_code_idx" ON "households" USING btree ("estate_id","code");--> statement-breakpoint
CREATE UNIQUE INDEX "households_estate_id_unit_number_block_or_street_idx" ON "households" USING btree ("estate_id","block_or_street","unit_number");