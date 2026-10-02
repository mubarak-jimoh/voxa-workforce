export const TASK_STATUSES = [
  "queued",
  "planning",
  "running",
  "waiting_for_approval",
  "blocked",
  "completed",
  "failed",
  "cancelled",
  "paused",
] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const STEP_STATUSES = [
  "pending",
  "running",
  "completed",
  "blocked",
  "skipped",
  "failed",
] as const;
export type StepStatus = (typeof STEP_STATUSES)[number];

export const RUN_STATUSES = [
  "running",
  "completed",
  "failed",
  "cancelled",
] as const;
export type RunStatus = (typeof RUN_STATUSES)[number];

export const MESSAGE_ROLES = ["user", "employee", "system"] as const;
export type MessageRole = (typeof MESSAGE_ROLES)[number];

export const ARTIFACT_KINDS = [
  "brief",
  "report",
  "list",
  "draft",
  "dataset",
  "note",
] as const;
export type ArtifactKind = (typeof ARTIFACT_KINDS)[number];

export const APPROVAL_STATUSES = ["pending", "approved", "rejected"] as const;
export type ApprovalStatus = (typeof APPROVAL_STATUSES)[number];

export const APPROVAL_ACTIONS = [
  "send_email",
  "publish",
  "delete",
  "external_write",
  "other",
] as const;
export type ApprovalAction = (typeof APPROVAL_ACTIONS)[number];

export const ACTIVITY_KINDS = [
  "started",
  "progress",
  "blocked",
  "waiting",
  "completed",
  "failed",
  "note",
] as const;
export type ActivityKind = (typeof ACTIVITY_KINDS)[number];

export const DISPLAY_STATUSES = ["idle", "working", "waiting", "paused"] as const;
export type DisplayStatus = (typeof DISPLAY_STATUSES)[number];

export const TOOL_IDS = [
  "record_brief",
  "web_research",
  "find_contacts",
  "draft_outreach",
  "send_email",
] as const;
export type ToolId = (typeof TOOL_IDS)[number];

export const TASK_PRIORITIES = ["normal", "high", "urgent"] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

export const DEFAULT_WORK_TIMEZONE = "Europe/London";

export const WORK_EXECUTE_EVENT = "work/execute.run" as const;

export function isTaskStatus(value: string): value is TaskStatus {
  return (TASK_STATUSES as readonly string[]).includes(value);
}

export function isApprovalStatus(value: string): value is ApprovalStatus {
  return (APPROVAL_STATUSES as readonly string[]).includes(value);
}

export const TASK_STATUS_SQL = TASK_STATUSES.map((value) => `'${value}'`).join(", ");
export const STEP_STATUS_SQL = STEP_STATUSES.map((value) => `'${value}'`).join(", ");
export const RUN_STATUS_SQL = RUN_STATUSES.map((value) => `'${value}'`).join(", ");
export const MESSAGE_ROLE_SQL = MESSAGE_ROLES.map((value) => `'${value}'`).join(", ");
export const ARTIFACT_KIND_SQL = ARTIFACT_KINDS.map((value) => `'${value}'`).join(", ");
export const APPROVAL_STATUS_SQL = APPROVAL_STATUSES.map((value) => `'${value}'`).join(", ");
export const APPROVAL_ACTION_SQL = APPROVAL_ACTIONS.map((value) => `'${value}'`).join(", ");
export const ACTIVITY_KIND_SQL = ACTIVITY_KINDS.map((value) => `'${value}'`).join(", ");
