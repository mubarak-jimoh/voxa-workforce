import { and, eq } from "drizzle-orm";
import {
  activity,
  approval,
  artifact,
  conversation,
  message,
  taskRun,
  taskStep,
  workSchedule,
  workTask,
} from "../db/schema";
import { ForbiddenError, InvalidTransitionError, NotFoundError } from "../errors";
import { canDecideApproval } from "../membership/permissions";
import type { MembershipRole } from "../employee/constants";
import type {
  ActivityKind,
  ApprovalAction,
  ArtifactKind,
  MessageRole,
  StepStatus,
  TaskPriority,
  TaskStatus,
} from "./constants";
import { getApprovalForScope, getOrCreateConversation, getTaskForScope } from "./queries";
import { newId, now, type WorkScope } from "./scope";

export async function appendMessage(
  scope: WorkScope,
  input: {
    conversationId: string;
    role: MessageRole;
    body: string;
    taskId?: string | null;
  },
) {
  const record = {
    id: newId(),
    organisationId: scope.organisationId,
    employeeId: scope.employeeId,
    conversationId: input.conversationId,
    taskId: input.taskId ?? null,
    role: input.role,
    body: input.body,
    createdAt: now(),
  };
  await scope.db.insert(message).values(record);
  await scope.db
    .update(conversation)
    .set({ updatedAt: now() })
    .where(eq(conversation.id, input.conversationId));
  return record;
}

export async function createTask(
  scope: WorkScope,
  input: {
    conversationId: string;
    createdByUserId: string;
    title: string;
    instruction: string;
    priority?: TaskPriority;
    dueAt?: Date | null;
  },
) {
  const created = {
    id: newId(),
    organisationId: scope.organisationId,
    employeeId: scope.employeeId,
    conversationId: input.conversationId,
    createdByUserId: input.createdByUserId,
    title: input.title,
    instruction: input.instruction,
    status: "queued" as const,
    priority: input.priority ?? ("normal" as const),
    dueAt: input.dueAt ?? null,
    blockedReason: null,
    errorMessage: null,
    createdAt: now(),
    startedAt: null,
    completedAt: null,
    updatedAt: now(),
  };
  await scope.db.insert(workTask).values(created);
  return created;
}

export async function setTaskStatus(
  scope: WorkScope,
  taskId: string,
  status: TaskStatus,
  extra?: { blockedReason?: string | null; errorMessage?: string | null },
) {
  const current = await getTaskForScope(scope, taskId);
  if (!current) {
    throw new NotFoundError("Task not found.");
  }
  const startedAt =
    status === "running" && !current.startedAt ? now() : current.startedAt;
  const completedAt = ["completed", "failed", "cancelled", "blocked"].includes(
    status,
  )
    ? now()
    : current.completedAt;
  await scope.db
    .update(workTask)
    .set({
      status,
      blockedReason: extra?.blockedReason ?? current.blockedReason,
      errorMessage: extra?.errorMessage ?? current.errorMessage,
      startedAt,
      completedAt,
      updatedAt: now(),
    })
    .where(
      and(
        eq(workTask.id, taskId),
        eq(workTask.organisationId, scope.organisationId),
      ),
    );
  return { ...current, status, startedAt, completedAt };
}

export async function createRun(scope: WorkScope, taskId: string) {
  const created = {
    id: newId(),
    organisationId: scope.organisationId,
    employeeId: scope.employeeId,
    taskId,
    status: "running" as const,
    startedAt: now(),
    completedAt: null,
  };
  await scope.db.insert(taskRun).values(created);
  return created;
}

export async function finishRun(
  scope: WorkScope,
  runId: string,
  status: "completed" | "failed" | "cancelled",
) {
  await scope.db
    .update(taskRun)
    .set({ status, completedAt: now() })
    .where(
      and(
        eq(taskRun.id, runId),
        eq(taskRun.organisationId, scope.organisationId),
      ),
    );
}

export async function createSteps(
  scope: WorkScope,
  input: {
    taskId: string;
    runId: string;
    steps: { title: string; detail?: string; toolId?: string }[];
  },
) {
  const created = input.steps.map((step, index) => ({
    id: newId(),
    organisationId: scope.organisationId,
    employeeId: scope.employeeId,
    taskId: input.taskId,
    runId: input.runId,
    position: index + 1,
    title: step.title,
    detail: step.detail ?? null,
    toolId: step.toolId ?? null,
    status: "pending" as const,
    blockedReason: null,
    createdAt: now(),
    completedAt: null,
  }));
  if (created.length > 0) {
    await scope.db.insert(taskStep).values(created);
  }
  return created;
}

export async function setStepStatus(
  scope: WorkScope,
  stepId: string,
  status: StepStatus,
  blockedReason?: string | null,
) {
  await scope.db
    .update(taskStep)
    .set({
      status,
      blockedReason: blockedReason ?? null,
      completedAt: status === "pending" || status === "running" ? null : now(),
    })
    .where(
      and(
        eq(taskStep.id, stepId),
        eq(taskStep.organisationId, scope.organisationId),
      ),
    );
}

export async function recordActivity(
  scope: WorkScope,
  input: {
    taskId?: string | null;
    runId?: string | null;
    stepId?: string | null;
    kind: ActivityKind;
    summary: string;
  },
) {
  const created = {
    id: newId(),
    organisationId: scope.organisationId,
    employeeId: scope.employeeId,
    taskId: input.taskId ?? null,
    runId: input.runId ?? null,
    stepId: input.stepId ?? null,
    kind: input.kind,
    summary: input.summary,
    createdAt: now(),
  };
  await scope.db.insert(activity).values(created);
  return created;
}

export async function createArtifact(
  scope: WorkScope,
  input: {
    taskId: string;
    kind: ArtifactKind;
    title: string;
    body?: string | null;
    data?: Record<string, unknown> | null;
  },
) {
  const created = {
    id: newId(),
    organisationId: scope.organisationId,
    employeeId: scope.employeeId,
    taskId: input.taskId,
    kind: input.kind,
    title: input.title,
    body: input.body ?? null,
    data: input.data ?? null,
    createdAt: now(),
  };
  await scope.db.insert(artifact).values(created);
  return created;
}

export async function createApproval(
  scope: WorkScope,
  input: {
    taskId: string;
    artifactId?: string | null;
    title: string;
    summary: string;
    actionKind: ApprovalAction;
    payload?: Record<string, unknown> | null;
  },
) {
  const existing = await scope.db
    .select()
    .from(approval)
    .where(
      and(
        eq(approval.taskId, input.taskId),
        eq(approval.organisationId, scope.organisationId),
        eq(approval.employeeId, scope.employeeId),
        eq(approval.actionKind, input.actionKind),
        eq(approval.status, "pending"),
      ),
    )
    .limit(1);
  if (existing[0]) {
    return existing[0];
  }
  const created = {
    id: newId(),
    organisationId: scope.organisationId,
    employeeId: scope.employeeId,
    taskId: input.taskId,
    artifactId: input.artifactId ?? null,
    title: input.title,
    summary: input.summary,
    actionKind: input.actionKind,
    status: "pending" as const,
    payload: input.payload ?? null,
    decidedAt: null,
    decidedByUserId: null,
    createdAt: now(),
  };
  await scope.db.insert(approval).values(created);
  return created;
}

export async function decideApproval(
  scope: WorkScope,
  input: {
    approvalId: string;
    decision: "approved" | "rejected";
    actorUserId: string;
    actorRole: MembershipRole;
  },
) {
  if (!canDecideApproval(input.actorRole)) {
    throw new ForbiddenError("Only an owner or admin can decide approvals.");
  }
  const current = await getApprovalForScope(scope, input.approvalId);
  if (!current) {
    throw new NotFoundError("Approval not found.");
  }
  if (current.status !== "pending") {
    throw new InvalidTransitionError("This approval has already been decided.");
  }
  await scope.db
    .update(approval)
    .set({
      status: input.decision,
      decidedAt: now(),
      decidedByUserId: input.actorUserId,
    })
    .where(eq(approval.id, input.approvalId));
  return { ...current, status: input.decision };
}

export async function createSchedule(
  scope: WorkScope,
  input: {
    createdByUserId: string;
    title: string;
    instruction: string;
    cadence: string;
  },
) {
  const created = {
    id: newId(),
    organisationId: scope.organisationId,
    employeeId: scope.employeeId,
    createdByUserId: input.createdByUserId,
    title: input.title,
    instruction: input.instruction,
    cadence: input.cadence,
    enabled: true,
    schedulerLive: false,
    nextRunAt: null,
    lastRunAt: null,
    lastTaskId: null,
    createdAt: now(),
    updatedAt: now(),
  };
  await scope.db.insert(workSchedule).values(created);
  return created;
}

export async function setScheduleEnabled(
  scope: WorkScope,
  scheduleId: string,
  enabled: boolean,
) {
  await scope.db
    .update(workSchedule)
    .set({ enabled, updatedAt: now() })
    .where(
      and(
        eq(workSchedule.id, scheduleId),
        eq(workSchedule.organisationId, scope.organisationId),
        eq(workSchedule.employeeId, scope.employeeId),
      ),
    );
}

export { getOrCreateConversation };
