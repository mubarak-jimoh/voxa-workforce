CREATE TABLE "usage_event" (
	"id" text PRIMARY KEY NOT NULL,
	"organisation_id" text NOT NULL,
	"employee_id" text NOT NULL,
	"provider" text NOT NULL,
	"model" text NOT NULL,
	"operation" text NOT NULL,
	"input_tokens" integer DEFAULT 0 NOT NULL,
	"output_tokens" integer DEFAULT 0 NOT NULL,
	"estimated_cost_usd" text,
	"created_at" timestamp NOT NULL
);
--> statement-breakpoint
ALTER TABLE "usage_event" ADD CONSTRAINT "usage_event_organisation_id_organization_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usage_event" ADD CONSTRAINT "usage_event_employee_id_employee_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employee"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "usage_event_org_idx" ON "usage_event" USING btree ("organisation_id","created_at");--> statement-breakpoint
CREATE INDEX "usage_event_employee_idx" ON "usage_event" USING btree ("employee_id","created_at");
