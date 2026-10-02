ALTER TABLE "organization" ADD COLUMN "timezone" text DEFAULT 'Europe/London' NOT NULL;--> statement-breakpoint
ALTER TABLE "work_task" ADD COLUMN "priority" text DEFAULT 'normal' NOT NULL;--> statement-breakpoint
ALTER TABLE "work_task" ADD COLUMN "due_at" timestamp;--> statement-breakpoint
ALTER TABLE "work_task" ADD CONSTRAINT "work_task_priority_check" CHECK (priority in ('normal','high','urgent'));--> statement-breakpoint
CREATE INDEX "work_task_due_at_idx" ON "work_task" USING btree ("due_at");
