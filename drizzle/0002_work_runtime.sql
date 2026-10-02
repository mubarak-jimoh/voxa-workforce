CREATE TABLE "activity" (
	"id" text PRIMARY KEY NOT NULL,
	"organisation_id" text NOT NULL,
	"employee_id" text NOT NULL,
	"task_id" text,
	"run_id" text,
	"step_id" text,
	"kind" text NOT NULL,
	"summary" text NOT NULL,
	"created_at" timestamp NOT NULL,
	CONSTRAINT "activity_kind_check" CHECK (kind in ('started','progress','blocked','waiting','completed','failed','note'))
);
--> statement-breakpoint
CREATE TABLE "approval" (
	"id" text PRIMARY KEY NOT NULL,
	"organisation_id" text NOT NULL,
	"employee_id" text NOT NULL,
	"task_id" text NOT NULL,
	"artifact_id" text,
	"title" text NOT NULL,
	"summary" text NOT NULL,
	"action_kind" text NOT NULL,
	"status" text NOT NULL,
	"payload" jsonb,
	"decided_at" timestamp,
	"decided_by_user_id" text,
	"created_at" timestamp NOT NULL,
	CONSTRAINT "approval_status_check" CHECK (status in ('pending','approved','rejected')),
	CONSTRAINT "approval_action_check" CHECK (action_kind in ('send_email','publish','delete','external_write','other'))
);
--> statement-breakpoint
CREATE TABLE "artifact" (
	"id" text PRIMARY KEY NOT NULL,
	"organisation_id" text NOT NULL,
	"employee_id" text NOT NULL,
	"task_id" text NOT NULL,
	"kind" text NOT NULL,
	"title" text NOT NULL,
	"body" text,
	"data" jsonb,
	"created_at" timestamp NOT NULL,
	CONSTRAINT "artifact_kind_check" CHECK (kind in ('brief','report','list','draft','dataset','note'))
);
--> statement-breakpoint
CREATE TABLE "conversation" (
	"id" text PRIMARY KEY NOT NULL,
	"organisation_id" text NOT NULL,
	"employee_id" text NOT NULL,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "message" (
	"id" text PRIMARY KEY NOT NULL,
	"organisation_id" text NOT NULL,
	"employee_id" text NOT NULL,
	"conversation_id" text NOT NULL,
	"task_id" text,
	"role" text NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp NOT NULL,
	CONSTRAINT "message_role_check" CHECK (role in ('user','employee','system'))
);
--> statement-breakpoint
CREATE TABLE "task_run" (
	"id" text PRIMARY KEY NOT NULL,
	"organisation_id" text NOT NULL,
	"employee_id" text NOT NULL,
	"task_id" text NOT NULL,
	"status" text NOT NULL,
	"started_at" timestamp NOT NULL,
	"completed_at" timestamp,
	CONSTRAINT "task_run_status_check" CHECK (status in ('running','completed','failed','cancelled'))
);
--> statement-breakpoint
CREATE TABLE "task_step" (
	"id" text PRIMARY KEY NOT NULL,
	"organisation_id" text NOT NULL,
	"employee_id" text NOT NULL,
	"task_id" text NOT NULL,
	"run_id" text,
	"position" integer NOT NULL,
	"title" text NOT NULL,
	"detail" text,
	"tool_id" text,
	"status" text NOT NULL,
	"blocked_reason" text,
	"created_at" timestamp NOT NULL,
	"completed_at" timestamp,
	CONSTRAINT "task_step_status_check" CHECK (status in ('pending','running','completed','blocked','skipped','failed'))
);
--> statement-breakpoint
CREATE TABLE "work_schedule" (
	"id" text PRIMARY KEY NOT NULL,
	"organisation_id" text NOT NULL,
	"employee_id" text NOT NULL,
	"created_by_user_id" text NOT NULL,
	"title" text NOT NULL,
	"instruction" text NOT NULL,
	"cadence" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"scheduler_live" boolean DEFAULT false NOT NULL,
	"next_run_at" timestamp,
	"last_run_at" timestamp,
	"last_task_id" text,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "work_task" (
	"id" text PRIMARY KEY NOT NULL,
	"organisation_id" text NOT NULL,
	"employee_id" text NOT NULL,
	"conversation_id" text,
	"created_by_user_id" text NOT NULL,
	"title" text NOT NULL,
	"instruction" text NOT NULL,
	"status" text NOT NULL,
	"blocked_reason" text,
	"error_message" text,
	"created_at" timestamp NOT NULL,
	"started_at" timestamp,
	"completed_at" timestamp,
	"updated_at" timestamp NOT NULL,
	CONSTRAINT "work_task_status_check" CHECK (status in ('queued','planning','running','waiting_for_approval','blocked','completed','failed','cancelled','paused'))
);
--> statement-breakpoint
ALTER TABLE "activity" ADD CONSTRAINT "activity_organisation_id_organization_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity" ADD CONSTRAINT "activity_employee_id_employee_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employee"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity" ADD CONSTRAINT "activity_task_id_work_task_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."work_task"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity" ADD CONSTRAINT "activity_run_id_task_run_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."task_run"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity" ADD CONSTRAINT "activity_step_id_task_step_id_fk" FOREIGN KEY ("step_id") REFERENCES "public"."task_step"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approval" ADD CONSTRAINT "approval_organisation_id_organization_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approval" ADD CONSTRAINT "approval_employee_id_employee_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employee"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approval" ADD CONSTRAINT "approval_task_id_work_task_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."work_task"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approval" ADD CONSTRAINT "approval_artifact_id_artifact_id_fk" FOREIGN KEY ("artifact_id") REFERENCES "public"."artifact"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approval" ADD CONSTRAINT "approval_decided_by_user_id_user_id_fk" FOREIGN KEY ("decided_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "artifact" ADD CONSTRAINT "artifact_organisation_id_organization_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "artifact" ADD CONSTRAINT "artifact_employee_id_employee_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employee"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "artifact" ADD CONSTRAINT "artifact_task_id_work_task_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."work_task"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation" ADD CONSTRAINT "conversation_organisation_id_organization_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation" ADD CONSTRAINT "conversation_employee_id_employee_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employee"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message" ADD CONSTRAINT "message_organisation_id_organization_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message" ADD CONSTRAINT "message_employee_id_employee_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employee"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message" ADD CONSTRAINT "message_conversation_id_conversation_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversation"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message" ADD CONSTRAINT "message_task_id_work_task_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."work_task"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_run" ADD CONSTRAINT "task_run_organisation_id_organization_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_run" ADD CONSTRAINT "task_run_employee_id_employee_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employee"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_run" ADD CONSTRAINT "task_run_task_id_work_task_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."work_task"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_step" ADD CONSTRAINT "task_step_organisation_id_organization_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_step" ADD CONSTRAINT "task_step_employee_id_employee_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employee"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_step" ADD CONSTRAINT "task_step_task_id_work_task_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."work_task"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_step" ADD CONSTRAINT "task_step_run_id_task_run_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."task_run"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_schedule" ADD CONSTRAINT "work_schedule_organisation_id_organization_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_schedule" ADD CONSTRAINT "work_schedule_employee_id_employee_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employee"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_schedule" ADD CONSTRAINT "work_schedule_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_schedule" ADD CONSTRAINT "work_schedule_last_task_id_work_task_id_fk" FOREIGN KEY ("last_task_id") REFERENCES "public"."work_task"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_task" ADD CONSTRAINT "work_task_organisation_id_organization_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_task" ADD CONSTRAINT "work_task_employee_id_employee_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employee"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_task" ADD CONSTRAINT "work_task_conversation_id_conversation_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversation"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_task" ADD CONSTRAINT "work_task_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "activity_employee_idx" ON "activity" USING btree ("organisation_id","employee_id","created_at");--> statement-breakpoint
CREATE INDEX "activity_task_idx" ON "activity" USING btree ("task_id","created_at");--> statement-breakpoint
CREATE INDEX "approval_employee_status_idx" ON "approval" USING btree ("organisation_id","employee_id","status");--> statement-breakpoint
CREATE INDEX "artifact_task_idx" ON "artifact" USING btree ("task_id");--> statement-breakpoint
CREATE UNIQUE INDEX "conversation_employee_unique" ON "conversation" USING btree ("organisation_id","employee_id");--> statement-breakpoint
CREATE INDEX "message_conversation_idx" ON "message" USING btree ("conversation_id","created_at");--> statement-breakpoint
CREATE INDEX "task_run_task_idx" ON "task_run" USING btree ("task_id");--> statement-breakpoint
CREATE INDEX "task_step_task_idx" ON "task_step" USING btree ("task_id","position");--> statement-breakpoint
CREATE INDEX "work_schedule_employee_idx" ON "work_schedule" USING btree ("organisation_id","employee_id");--> statement-breakpoint
CREATE INDEX "work_task_org_employee_idx" ON "work_task" USING btree ("organisation_id","employee_id");--> statement-breakpoint
CREATE INDEX "work_task_status_idx" ON "work_task" USING btree ("status");