import { relations, sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import type {
  EmployeeRoleType,
  EmployeeStatus,
  MembershipRole,
} from "../employee/constants";
import type {
  ActivityKind,
  ApprovalAction,
  ApprovalStatus,
  ArtifactKind,
  MessageRole,
  RunStatus,
  StepStatus,
  TaskPriority,
  TaskStatus,
} from "../work/constants";

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at").notNull(),
});

export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at").notNull(),
    token: text("token").notNull().unique(),
    createdAt: timestamp("created_at").notNull(),
    updatedAt: timestamp("updated_at").notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    activeOrganizationId: text("active_organization_id"),
  },
  (table) => [index("session_user_id_idx").on(table.userId)],
);

export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    /**
     * Better Auth 1.7+ account identity. Credential accounts use a synthetic
     * issuer such as `local:credential`. Accounts are unique on (issuer, accountId).
     */
    issuer: text("issuer").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at"),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at").notNull(),
    updatedAt: timestamp("updated_at").notNull(),
  },
  (table) => [
    index("account_user_id_idx").on(table.userId),
    uniqueIndex("account_issuer_account_id_uidx").on(
      table.issuer,
      table.accountId,
    ),
  ],
);

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at"),
  updatedAt: timestamp("updated_at"),
});

export const organisation = pgTable("organization", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  logo: text("logo"),
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at"),
  metadata: text("metadata"),
  timezone: text("timezone").notNull().default("Europe/London"),
});

export const member = pgTable(
  "member",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organisation.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    role: text("role").$type<MembershipRole>().notNull(),
    createdAt: timestamp("created_at").notNull(),
  },
  (table) => [
    index("member_organisation_id_idx").on(table.organizationId),
    index("member_user_id_idx").on(table.userId),
    uniqueIndex("member_org_user_unique").on(
      table.organizationId,
      table.userId,
    ),
    check("member_role_check", sql`role in ('owner', 'admin', 'member')`),
  ],
);

export const invitation = pgTable(
  "invitation",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organisation.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    role: text("role").$type<MembershipRole>().notNull(),
    status: text("status").notNull().default("pending"),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").notNull(),
    inviterId: text("inviter_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (table) => [
    index("invitation_organisation_id_idx").on(table.organizationId),
    check(
      "invitation_role_check",
      sql`role in ('owner', 'admin', 'member')`,
    ),
    check(
      "invitation_status_check",
      sql`status in ('pending', 'accepted', 'rejected', 'canceled')`,
    ),
  ],
);

export const employee = pgTable(
  "employee",
  {
    id: text("id").primaryKey(),
    organisationId: text("organisation_id")
      .notNull()
      .references(() => organisation.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    roleType: text("role_type").$type<EmployeeRoleType>().notNull(),
    status: text("status").$type<EmployeeStatus>().notNull(),
    createdAt: timestamp("created_at").notNull(),
    updatedAt: timestamp("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("employee_organisation_unique").on(table.organisationId),
    check(
      "employee_role_type_check",
      sql`role_type in ('lead_handler')`,
    ),
    check(
      "employee_status_check",
      sql`status in ('idle', 'paused', 'offline')`,
    ),
  ],
);

export const conversation = pgTable(
  "conversation",
  {
    id: text("id").primaryKey(),
    organisationId: text("organisation_id")
      .notNull()
      .references(() => organisation.id, { onDelete: "cascade" }),
    employeeId: text("employee_id")
      .notNull()
      .references(() => employee.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").notNull(),
    updatedAt: timestamp("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("conversation_employee_unique").on(
      table.organisationId,
      table.employeeId,
    ),
  ],
);

export const workTask = pgTable(
  "work_task",
  {
    id: text("id").primaryKey(),
    organisationId: text("organisation_id")
      .notNull()
      .references(() => organisation.id, { onDelete: "cascade" }),
    employeeId: text("employee_id")
      .notNull()
      .references(() => employee.id, { onDelete: "cascade" }),
    conversationId: text("conversation_id").references(() => conversation.id, {
      onDelete: "set null",
    }),
    createdByUserId: text("created_by_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    instruction: text("instruction").notNull(),
    status: text("status").$type<TaskStatus>().notNull(),
    priority: text("priority").$type<TaskPriority>().notNull().default("normal"),
    dueAt: timestamp("due_at"),
    blockedReason: text("blocked_reason"),
    errorMessage: text("error_message"),
    createdAt: timestamp("created_at").notNull(),
    startedAt: timestamp("started_at"),
    completedAt: timestamp("completed_at"),
    updatedAt: timestamp("updated_at").notNull(),
  },
  (table) => [
    index("work_task_org_employee_idx").on(
      table.organisationId,
      table.employeeId,
    ),
    index("work_task_status_idx").on(table.status),
    index("work_task_due_at_idx").on(table.dueAt),
    check(
      "work_task_status_check",
      sql`status in ('queued','planning','running','waiting_for_approval','blocked','completed','failed','cancelled','paused')`,
    ),
    check(
      "work_task_priority_check",
      sql`priority in ('normal','high','urgent')`,
    ),
  ],
);

export const message = pgTable(
  "message",
  {
    id: text("id").primaryKey(),
    organisationId: text("organisation_id")
      .notNull()
      .references(() => organisation.id, { onDelete: "cascade" }),
    employeeId: text("employee_id")
      .notNull()
      .references(() => employee.id, { onDelete: "cascade" }),
    conversationId: text("conversation_id")
      .notNull()
      .references(() => conversation.id, { onDelete: "cascade" }),
    taskId: text("task_id").references(() => workTask.id, {
      onDelete: "set null",
    }),
    role: text("role").$type<MessageRole>().notNull(),
    body: text("body").notNull(),
    createdAt: timestamp("created_at").notNull(),
  },
  (table) => [
    index("message_conversation_idx").on(table.conversationId, table.createdAt),
    check(
      "message_role_check",
      sql`role in ('user','employee','system')`,
    ),
  ],
);

export const taskRun = pgTable(
  "task_run",
  {
    id: text("id").primaryKey(),
    organisationId: text("organisation_id")
      .notNull()
      .references(() => organisation.id, { onDelete: "cascade" }),
    employeeId: text("employee_id")
      .notNull()
      .references(() => employee.id, { onDelete: "cascade" }),
    taskId: text("task_id")
      .notNull()
      .references(() => workTask.id, { onDelete: "cascade" }),
    status: text("status").$type<RunStatus>().notNull(),
    startedAt: timestamp("started_at").notNull(),
    completedAt: timestamp("completed_at"),
  },
  (table) => [
    index("task_run_task_idx").on(table.taskId),
    check(
      "task_run_status_check",
      sql`status in ('running','completed','failed','cancelled')`,
    ),
  ],
);

export const taskStep = pgTable(
  "task_step",
  {
    id: text("id").primaryKey(),
    organisationId: text("organisation_id")
      .notNull()
      .references(() => organisation.id, { onDelete: "cascade" }),
    employeeId: text("employee_id")
      .notNull()
      .references(() => employee.id, { onDelete: "cascade" }),
    taskId: text("task_id")
      .notNull()
      .references(() => workTask.id, { onDelete: "cascade" }),
    runId: text("run_id").references(() => taskRun.id, { onDelete: "set null" }),
    position: integer("position").notNull(),
    title: text("title").notNull(),
    detail: text("detail"),
    toolId: text("tool_id"),
    status: text("status").$type<StepStatus>().notNull(),
    blockedReason: text("blocked_reason"),
    createdAt: timestamp("created_at").notNull(),
    completedAt: timestamp("completed_at"),
  },
  (table) => [
    index("task_step_task_idx").on(table.taskId, table.position),
    check(
      "task_step_status_check",
      sql`status in ('pending','running','completed','blocked','skipped','failed')`,
    ),
  ],
);

export const activity = pgTable(
  "activity",
  {
    id: text("id").primaryKey(),
    organisationId: text("organisation_id")
      .notNull()
      .references(() => organisation.id, { onDelete: "cascade" }),
    employeeId: text("employee_id")
      .notNull()
      .references(() => employee.id, { onDelete: "cascade" }),
    taskId: text("task_id").references(() => workTask.id, {
      onDelete: "cascade",
    }),
    runId: text("run_id").references(() => taskRun.id, { onDelete: "set null" }),
    stepId: text("step_id").references(() => taskStep.id, {
      onDelete: "set null",
    }),
    kind: text("kind").$type<ActivityKind>().notNull(),
    summary: text("summary").notNull(),
    createdAt: timestamp("created_at").notNull(),
  },
  (table) => [
    index("activity_employee_idx").on(
      table.organisationId,
      table.employeeId,
      table.createdAt,
    ),
    index("activity_task_idx").on(table.taskId, table.createdAt),
    check(
      "activity_kind_check",
      sql`kind in ('started','progress','blocked','waiting','completed','failed','note')`,
    ),
  ],
);

export const artifact = pgTable(
  "artifact",
  {
    id: text("id").primaryKey(),
    organisationId: text("organisation_id")
      .notNull()
      .references(() => organisation.id, { onDelete: "cascade" }),
    employeeId: text("employee_id")
      .notNull()
      .references(() => employee.id, { onDelete: "cascade" }),
    taskId: text("task_id")
      .notNull()
      .references(() => workTask.id, { onDelete: "cascade" }),
    kind: text("kind").$type<ArtifactKind>().notNull(),
    title: text("title").notNull(),
    body: text("body"),
    data: jsonb("data").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at").notNull(),
  },
  (table) => [
    index("artifact_task_idx").on(table.taskId),
    check(
      "artifact_kind_check",
      sql`kind in ('brief','report','list','draft','dataset','note')`,
    ),
  ],
);

export const approval = pgTable(
  "approval",
  {
    id: text("id").primaryKey(),
    organisationId: text("organisation_id")
      .notNull()
      .references(() => organisation.id, { onDelete: "cascade" }),
    employeeId: text("employee_id")
      .notNull()
      .references(() => employee.id, { onDelete: "cascade" }),
    taskId: text("task_id")
      .notNull()
      .references(() => workTask.id, { onDelete: "cascade" }),
    artifactId: text("artifact_id").references(() => artifact.id, {
      onDelete: "set null",
    }),
    title: text("title").notNull(),
    summary: text("summary").notNull(),
    actionKind: text("action_kind").$type<ApprovalAction>().notNull(),
    status: text("status").$type<ApprovalStatus>().notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>(),
    decidedAt: timestamp("decided_at"),
    decidedByUserId: text("decided_by_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at").notNull(),
  },
  (table) => [
    index("approval_employee_status_idx").on(
      table.organisationId,
      table.employeeId,
      table.status,
    ),
    check(
      "approval_status_check",
      sql`status in ('pending','approved','rejected')`,
    ),
    check(
      "approval_action_check",
      sql`action_kind in ('send_email','publish','delete','external_write','other')`,
    ),
  ],
);

export const workSchedule = pgTable(
  "work_schedule",
  {
    id: text("id").primaryKey(),
    organisationId: text("organisation_id")
      .notNull()
      .references(() => organisation.id, { onDelete: "cascade" }),
    employeeId: text("employee_id")
      .notNull()
      .references(() => employee.id, { onDelete: "cascade" }),
    createdByUserId: text("created_by_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    instruction: text("instruction").notNull(),
    cadence: text("cadence").notNull(),
    enabled: boolean("enabled").notNull().default(true),
    schedulerLive: boolean("scheduler_live").notNull().default(false),
    nextRunAt: timestamp("next_run_at"),
    lastRunAt: timestamp("last_run_at"),
    lastTaskId: text("last_task_id").references(() => workTask.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at").notNull(),
    updatedAt: timestamp("updated_at").notNull(),
  },
  (table) => [
    index("work_schedule_employee_idx").on(
      table.organisationId,
      table.employeeId,
    ),
  ],
);

export const usageEvent = pgTable(
  "usage_event",
  {
    id: text("id").primaryKey(),
    organisationId: text("organisation_id")
      .notNull()
      .references(() => organisation.id, { onDelete: "cascade" }),
    employeeId: text("employee_id")
      .notNull()
      .references(() => employee.id, { onDelete: "cascade" }),
    provider: text("provider").notNull(),
    model: text("model").notNull(),
    operation: text("operation").notNull(),
    inputTokens: integer("input_tokens").notNull().default(0),
    outputTokens: integer("output_tokens").notNull().default(0),
    estimatedCostUsd: text("estimated_cost_usd"),
    createdAt: timestamp("created_at").notNull(),
  },
  (table) => [
    index("usage_event_org_idx").on(table.organisationId, table.createdAt),
    index("usage_event_employee_idx").on(table.employeeId, table.createdAt),
  ],
);

export const userRelations = relations(user, ({ many }) => ({
  sessions: many(session),
  accounts: many(account),
  memberships: many(member),
}));

export const organisationRelations = relations(organisation, ({ many }) => ({
  members: many(member),
  invitations: many(invitation),
  employees: many(employee),
  conversations: many(conversation),
  workTasks: many(workTask),
}));

export const memberRelations = relations(member, ({ one }) => ({
  organisation: one(organisation, {
    fields: [member.organizationId],
    references: [organisation.id],
  }),
  user: one(user, {
    fields: [member.userId],
    references: [user.id],
  }),
}));

export const employeeRelations = relations(employee, ({ one, many }) => ({
  organisation: one(organisation, {
    fields: [employee.organisationId],
    references: [organisation.id],
  }),
  conversations: many(conversation),
  workTasks: many(workTask),
}));

export const conversationRelations = relations(conversation, ({ one, many }) => ({
  organisation: one(organisation, {
    fields: [conversation.organisationId],
    references: [organisation.id],
  }),
  employee: one(employee, {
    fields: [conversation.employeeId],
    references: [employee.id],
  }),
  messages: many(message),
}));

export const workTaskRelations = relations(workTask, ({ one, many }) => ({
  organisation: one(organisation, {
    fields: [workTask.organisationId],
    references: [organisation.id],
  }),
  employee: one(employee, {
    fields: [workTask.employeeId],
    references: [employee.id],
  }),
  messages: many(message),
  runs: many(taskRun),
  steps: many(taskStep),
  activities: many(activity),
  artifacts: many(artifact),
  approvals: many(approval),
}));

export const schema = {
  user,
  session,
  account,
  verification,
  organisation,
  member,
  invitation,
  employee,
  conversation,
  message,
  workTask,
  taskRun,
  taskStep,
  activity,
  artifact,
  approval,
  workSchedule,
  usageEvent,
};

export type User = typeof user.$inferSelect;
export type Organisation = typeof organisation.$inferSelect;
export type Membership = typeof member.$inferSelect;
export type Invitation = typeof invitation.$inferSelect;
export type Employee = typeof employee.$inferSelect;
export type Conversation = typeof conversation.$inferSelect;
export type Message = typeof message.$inferSelect;
export type WorkTask = typeof workTask.$inferSelect;
export type TaskRun = typeof taskRun.$inferSelect;
export type TaskStep = typeof taskStep.$inferSelect;
export type Activity = typeof activity.$inferSelect;
export type Artifact = typeof artifact.$inferSelect;
export type Approval = typeof approval.$inferSelect;
export type WorkSchedule = typeof workSchedule.$inferSelect;
export type UsageEventRow = typeof usageEvent.$inferSelect;
