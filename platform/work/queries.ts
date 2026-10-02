import { and, desc, eq, gte, inArray } from "drizzle-orm";
import {
  activity,
  approval,
  artifact,
  conversation,
  message,
  taskStep,
  workSchedule,
  workTask,
} from "../db/schema";
import type { Artifact } from "../db/schema";
import { displayStatusForEmployee } from "./display-status";
import type { WorkScope } from "./scope";
import type { DisplayStatus, TaskStatus } from "./constants";

function scopedTask(scope: WorkScope, taskId: string) {
  return and(
    eq(workTask.id, taskId),
    eq(workTask.organisationId, scope.organisationId),
    eq(workTask.employeeId, scope.employeeId),
  );
}

export async function getOrCreateConversation(scope: WorkScope) {
  const existing = await scope.db
    .select()
    .from(conversation)
    .where(
      and(
        eq(conversation.organisationId, scope.organisationId),
        eq(conversation.employeeId, scope.employeeId),
      ),
    )
    .limit(1);
  if (existing[0]) {
    return existing[0];
  }
  const created = {
    id: crypto.randomUUID(),
    organisationId: scope.organisationId,
    employeeId: scope.employeeId,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  await scope.db.insert(conversation).values(created);
  return created;
}

export async function listMessages(scope: WorkScope, conversationId: string) {
  return scope.db
    .select()
    .from(message)
    .where(
      and(
        eq(message.conversationId, conversationId),
        eq(message.organisationId, scope.organisationId),
        eq(message.employeeId, scope.employeeId),
      ),
    )
    .orderBy(message.createdAt);
}

export async function listTasks(scope: WorkScope) {
  return scope.db
    .select()
    .from(workTask)
    .where(
      and(
        eq(workTask.organisationId, scope.organisationId),
        eq(workTask.employeeId, scope.employeeId),
      ),
    )
    .orderBy(desc(workTask.createdAt));
}

export async function getTaskForScope(scope: WorkScope, taskId: string) {
  const rows = await scope.db
    .select()
    .from(workTask)
    .where(scopedTask(scope, taskId))
    .limit(1);
  return rows[0] ?? null;
}

export async function listStepsForTask(scope: WorkScope, taskId: string) {
  return scope.db
    .select()
    .from(taskStep)
    .where(
      and(
        eq(taskStep.taskId, taskId),
        eq(taskStep.organisationId, scope.organisationId),
        eq(taskStep.employeeId, scope.employeeId),
      ),
    )
    .orderBy(taskStep.position);
}

export async function listActivity(scope: WorkScope, taskId?: string) {
  const filters = [
    eq(activity.organisationId, scope.organisationId),
    eq(activity.employeeId, scope.employeeId),
  ];
  if (taskId) {
    filters.push(eq(activity.taskId, taskId));
  }
  return scope.db
    .select()
    .from(activity)
    .where(and(...filters))
    .orderBy(desc(activity.createdAt));
}

export async function getArtifactForScope(scope: WorkScope, artifactId: string) {
  const rows = await scope.db
    .select()
    .from(artifact)
    .where(
      and(
        eq(artifact.id, artifactId),
        eq(artifact.organisationId, scope.organisationId),
        eq(artifact.employeeId, scope.employeeId),
      ),
    )
    .limit(1);
  return rows[0] ?? null;
}

export async function listArtifactsForTask(scope: WorkScope, taskId: string) {
  return scope.db
    .select()
    .from(artifact)
    .where(
      and(
        eq(artifact.taskId, taskId),
        eq(artifact.organisationId, scope.organisationId),
        eq(artifact.employeeId, scope.employeeId),
      ),
    )
    .orderBy(desc(artifact.createdAt));
}

export async function listArtifactsSince(scope: WorkScope, since: Date): Promise<Artifact[]> {
  return scope.db
    .select()
    .from(artifact)
    .where(
      and(
        eq(artifact.organisationId, scope.organisationId),
        eq(artifact.employeeId, scope.employeeId),
        gte(artifact.createdAt, since),
      ),
    )
    .orderBy(desc(artifact.createdAt));
}

export async function listStepsForTaskIds(scope: WorkScope, taskIds: string[]) {
  if (taskIds.length === 0) {
    return [];
  }
  return scope.db
    .select()
    .from(taskStep)
    .where(
      and(
        eq(taskStep.organisationId, scope.organisationId),
        eq(taskStep.employeeId, scope.employeeId),
        inArray(taskStep.taskId, taskIds),
      ),
    )
    .orderBy(taskStep.position);
}

export async function listArtifactsForTaskIds(scope: WorkScope, taskIds: string[]) {
  if (taskIds.length === 0) {
    return [];
  }
  return scope.db
    .select()
    .from(artifact)
    .where(
      and(
        eq(artifact.organisationId, scope.organisationId),
        eq(artifact.employeeId, scope.employeeId),
        inArray(artifact.taskId, taskIds),
      ),
    )
    .orderBy(desc(artifact.createdAt));
}

export async function listApprovalsForTask(scope: WorkScope, taskId: string) {
  return scope.db
    .select()
    .from(approval)
    .where(
      and(
        eq(approval.taskId, taskId),
        eq(approval.organisationId, scope.organisationId),
        eq(approval.employeeId, scope.employeeId),
      ),
    )
    .orderBy(desc(approval.createdAt));
}

export async function listApprovals(scope: WorkScope, status?: "pending") {
  const filters = [
    eq(approval.organisationId, scope.organisationId),
    eq(approval.employeeId, scope.employeeId),
  ];
  if (status) {
    filters.push(eq(approval.status, status));
  }
  return scope.db
    .select()
    .from(approval)
    .where(and(...filters))
    .orderBy(desc(approval.createdAt));
}

export async function getApprovalForScope(scope: WorkScope, approvalId: string) {
  const rows = await scope.db
    .select()
    .from(approval)
    .where(
      and(
        eq(approval.id, approvalId),
        eq(approval.organisationId, scope.organisationId),
        eq(approval.employeeId, scope.employeeId),
      ),
    )
    .limit(1);
  return rows[0] ?? null;
}

export async function listSchedules(scope: WorkScope) {
  return scope.db
    .select()
    .from(workSchedule)
    .where(
      and(
        eq(workSchedule.organisationId, scope.organisationId),
        eq(workSchedule.employeeId, scope.employeeId),
      ),
    )
    .orderBy(desc(workSchedule.createdAt));
}

export function startOfToday(): Date {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

export async function countCompletedToday(scope: WorkScope) {
  const rows = await scope.db
    .select({ id: workTask.id })
    .from(workTask)
    .where(
      and(
        eq(workTask.organisationId, scope.organisationId),
        eq(workTask.employeeId, scope.employeeId),
        eq(workTask.status, "completed"),
        gte(workTask.completedAt, startOfToday()),
      ),
    );
  return rows.length;
}

export async function loadWorkspaceSnapshot(
  scope: WorkScope,
  availability: "idle" | "paused" | "offline",
) {
  const tasks = await listTasks(scope);
  const pendingApprovals = await listApprovals(scope, "pending");
  const schedules = await listSchedules(scope);
  const conversationRecord = await getOrCreateConversation(scope);
  const messages = await listMessages(scope, conversationRecord.id);
  const recentActivity = (await listActivity(scope)).slice(0, 40);
  const completedToday = await countCompletedToday(scope);
  const artifactsToday = await listArtifactsSince(scope, startOfToday());
  const displayStatus: DisplayStatus = displayStatusForEmployee({
    availability,
    taskStatuses: tasks.map((task) => task.status),
  });

  const working = tasks.filter((task) =>
    ["running", "planning"].includes(task.status),
  );
  const queued = tasks.filter((task) => task.status === "queued");
  const waiting = tasks.filter((task) => task.status === "waiting_for_approval");
  const blocked = tasks.filter((task) => task.status === "blocked");
  const featuredIds = [
    ...new Set(
      [
        ...messages.map((entry) => entry.taskId),
        ...working.map((task) => task.id),
        ...queued.map((task) => task.id),
        ...waiting.map((task) => task.id),
      ].filter((id): id is string => Boolean(id)),
    ),
  ];
  const [featuredSteps, featuredArtifacts] = await Promise.all([
    listStepsForTaskIds(scope, featuredIds),
    listArtifactsForTaskIds(scope, featuredIds),
  ]);

  return {
    conversation: conversationRecord,
    messages,
    tasks,
    pendingApprovals,
    schedules,
    recentActivity,
    completedToday,
    displayStatus,
    counts: {
      working: working.length,
      queued: queued.length,
      scheduled: schedules.filter((item) => item.enabled).length,
      needsApproval: pendingApprovals.length,
      completedToday,
      blocked: blocked.length,
      briefsToday: artifactsToday.filter((item) => item.kind === "brief").length,
      draftsToday: artifactsToday.filter((item) => item.kind === "draft").length,
    },
    working,
    queued,
    waiting,
    blocked,
    stepsByTaskId: groupByTaskId(featuredSteps),
    artifactsByTaskId: groupByTaskId(featuredArtifacts),
  };
}

function groupByTaskId<T extends { taskId: string | null }>(rows: T[]): Record<string, T[]> {
  const grouped: Record<string, T[]> = {};
  for (const row of rows) {
    if (!row.taskId) {
      continue;
    }
    const list = grouped[row.taskId] ?? [];
    list.push(row);
    grouped[row.taskId] = list;
  }
  return grouped;
}

export async function findOpenTask(scope: WorkScope, statuses: readonly TaskStatus[]) {
  const tasks = await listTasks(scope);
  return tasks.find((task) => statuses.includes(task.status)) ?? null;
}
