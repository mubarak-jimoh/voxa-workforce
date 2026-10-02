import { eq } from "drizzle-orm";
import { readyDatabase } from "../db";
import { organisation } from "../db/schema";
import { appendMessage, createRun, setTaskStatus } from "./commands";
import { completionSummaryForTask } from "./completion";
import { executeTaskRun } from "./execution";
import {
  getOrCreateConversation,
  getTaskForScope,
  listStepsForTask,
} from "./queries";
import type { WorkScope } from "./scope";
import type { ResearchProvider } from "../research/provider";

export type WorkExecutePayload = {
  organisationId: string;
  employeeId: string;
  taskId: string;
  runId: string;
};

export type WorkExecuteResult = {
  ok: boolean;
  status:
    | "completed"
    | "blocked"
    | "cancelled"
    | "paused"
    | "waiting_for_approval"
    | "skipped"
    | "denied";
  summary?: string;
};

function scopeFromIds(
  db: Awaited<ReturnType<typeof readyDatabase>>,
  organisationId: string,
  employeeId: string,
): WorkScope {
  return { db, organisationId, employeeId };
}

export async function loadScopedTask(
  payload: WorkExecutePayload,
  scope?: WorkScope,
) {
  const resolved =
    scope ??
    scopeFromIds(
      await readyDatabase(),
      payload.organisationId,
      payload.employeeId,
    );
  if (
    scope &&
    (scope.organisationId !== payload.organisationId ||
      scope.employeeId !== payload.employeeId)
  ) {
    return { scope: resolved, task: null as null, denied: true as const };
  }
  const task = await getTaskForScope(resolved, payload.taskId);
  if (!task) {
    return { scope: resolved, task: null as null, denied: true as const };
  }
  if (
    task.organisationId !== payload.organisationId ||
    task.employeeId !== payload.employeeId
  ) {
    return { scope: resolved, task: null as null, denied: true as const };
  }
  return { scope: resolved, task, denied: false as const };
}

export { completionSummaryForTask };

/**
 * Authoritative durable worker. Reloads scoped state from the database.
 * Safe to retry: completed steps and existing research artifacts are skipped.
 * Pass `scope` in tests / same-process callers so the correct DB handle is used.
 */
export async function runWorkExecuteJob(
  payload: WorkExecutePayload,
  options?: { researchProvider?: ResearchProvider | null; scope?: WorkScope },
): Promise<WorkExecuteResult> {
  const loaded = await loadScopedTask(payload, options?.scope);
  if (loaded.denied || !loaded.task) {
    return { ok: false, status: "denied", summary: "Task not found in this organisation." };
  }
  const { scope, task } = loaded;

  if (task.status === "cancelled") {
    return { ok: true, status: "cancelled", summary: "Work was cancelled." };
  }
  if (task.status === "paused") {
    return { ok: true, status: "paused", summary: "Work is paused." };
  }
  if (task.status === "waiting_for_approval") {
    return {
      ok: true,
      status: "waiting_for_approval",
      summary: "Waiting for your approval.",
    };
  }
  if (["completed", "blocked", "failed"].includes(task.status)) {
    return {
      ok: true,
      status: task.status === "completed" ? "completed" : "blocked",
      summary: "Work already finished.",
    };
  }

  let runId = payload.runId;
  const steps = await listStepsForTask(scope, task.id);
  const matchingRun = steps.find((step) => step.runId === runId)?.runId;
  if (!matchingRun) {
    const open = steps.find((step) => step.runId)?.runId;
    if (open) {
      runId = open;
    } else {
      const run = await createRun(scope, task.id);
      runId = run.id;
    }
  }

  if (steps.length === 0) {
    await setTaskStatus(scope, task.id, "blocked", {
      blockedReason: "No execution plan is stored for this task.",
    });
    return { ok: false, status: "blocked", summary: "No execution plan is stored for this task." };
  }

  if (task.status === "queued" || task.status === "planning") {
    await setTaskStatus(scope, task.id, "running");
  }

  const outcome = await executeTaskRun(scope, {
    taskId: task.id,
    runId,
    researchProvider: options?.researchProvider,
  });

  const conversation = await getOrCreateConversation(scope);
  const summary =
    outcome.status === "completed"
      ? outcome.summary ??
        (await completionSummaryForTask(scope, task.id, "That work is complete."))
      : outcome.status === "cancelled"
        ? outcome.summary ?? "I stopped that work."
        : outcome.status === "waiting_for_approval"
          ? "Something needs your approval before I go further."
          : outcome.summary ??
            "I captured the brief. Required tools are not connected, so I stopped rather than inventing results.";

  await appendMessage(scope, {
    conversationId: conversation.id,
    role: "employee",
    body: summary,
    taskId: task.id,
  });

  return {
    ok: outcome.status === "completed" || outcome.status === "waiting_for_approval",
    status: outcome.status,
    summary,
  };
}

export async function organisationTimezone(organisationId: string): Promise<string> {
  const db = await readyDatabase();
  const rows = await db
    .select({ timezone: organisation.timezone })
    .from(organisation)
    .where(eq(organisation.id, organisationId))
    .limit(1);
  return rows[0]?.timezone ?? "Europe/London";
}
