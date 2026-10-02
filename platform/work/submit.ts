import type { InterpreterResult } from "../ai/types";
import { eq } from "drizzle-orm";
import { organisation } from "../db/schema";
import {
  appendMessage,
  createRun,
  createSchedule,
  createSteps,
  createTask,
  getOrCreateConversation,
  recordActivity,
  setTaskStatus,
} from "./commands";
import { formatDueLabel, parseDeadline, resolveWorkTimezone } from "./deadline";
import { enqueueWorkExecution } from "./enqueue";
import { runWorkExecuteJob } from "./execute-job";
import { parsePriority } from "./priority";
import { findOpenTask, getTaskForScope, listStepsForTask } from "./queries";
import type { WorkScope } from "./scope";
import type { ResearchProvider } from "../research/provider";

export type ExecuteMode = boolean | "queue";

async function scopeTimezone(scope: WorkScope): Promise<string> {
  const rows = await scope.db
    .select({ timezone: organisation.timezone })
    .from(organisation)
    .where(eq(organisation.id, scope.organisationId))
    .limit(1);
  return resolveWorkTimezone(rows[0]?.timezone);
}

export async function applyInstruction(input: {
  scope: WorkScope;
  userId: string;
  employeeName: string;
  instruction: string;
  result: InterpreterResult;
  paused: boolean;
  researchProvider?: ResearchProvider | null;
  /** true = sync (tests), false = seed only, "queue" = durable enqueue */
  execute?: ExecuteMode;
}): Promise<{ taskId?: string; runId?: string; mode?: "inline" | "inngest" | "sync" | "seeded" }> {
  const conversation = await getOrCreateConversation(input.scope);
  await appendMessage(input.scope, {
    conversationId: conversation.id,
    role: "user",
    body: input.instruction,
  });

  if (input.result.kind === "reply") {
    await appendMessage(input.scope, {
      conversationId: conversation.id,
      role: "employee",
      body: input.result.body,
    });
    return {};
  }

  if (input.paused && input.result.kind !== "control") {
    await appendMessage(input.scope, {
      conversationId: conversation.id,
      role: "employee",
      body: `${input.employeeName} is paused. Resume the employee before assigning new work.`,
    });
    return {};
  }

  if (input.result.kind === "schedule") {
    await createSchedule(input.scope, {
      createdByUserId: input.userId,
      title: input.result.title,
      instruction: input.result.instruction,
      cadence: input.result.cadence,
    });
    await recordActivity(input.scope, {
      kind: "note",
      summary: `Saved schedule: ${input.result.title} (${input.result.cadence}). Not live.`,
    });
    await appendMessage(input.scope, {
      conversationId: conversation.id,
      role: "employee",
      body: input.result.reply,
    });
    return {};
  }

  if (input.result.kind === "control") {
    const task = await targetTask(
      input.scope,
      input.result.action,
      input.result.taskId,
    );
    if (!task) {
      await appendMessage(input.scope, {
        conversationId: conversation.id,
        role: "employee",
        body: "There's no matching open work to change.",
      });
      return {};
    }
    if (input.result.action === "resume" && task.status !== "paused") {
      await appendMessage(input.scope, {
        conversationId: conversation.id,
        role: "employee",
        body: "That work isn't paused, so there's nothing to resume.",
        taskId: task.id,
      });
      return { taskId: task.id };
    }
    const next =
      input.result.action === "pause"
        ? "paused"
        : input.result.action === "resume"
          ? "queued"
          : "cancelled";
    await setTaskStatus(input.scope, task.id, next);
    await recordActivity(input.scope, {
      taskId: task.id,
      kind: "note",
      summary:
        next === "paused"
          ? `Paused: ${task.title}`
          : next === "cancelled"
            ? `Cancelled: ${task.title}`
            : `Resumed: ${task.title}`,
    });
    await appendMessage(input.scope, {
      conversationId: conversation.id,
      role: "employee",
      body: input.result.reply,
      taskId: task.id,
    });
    if (next === "queued") {
      return resumeTask(input.scope, task.id, input.execute ?? true, input.researchProvider);
    }
    return { taskId: task.id };
  }

  const timeZone = await scopeTimezone(input.scope);
  const deadline = parseDeadline(input.instruction, { timeZone });
  const priority = parsePriority(input.instruction);

  const task = await createTask(input.scope, {
    conversationId: conversation.id,
    createdByUserId: input.userId,
    title: input.result.title,
    instruction: input.instruction,
    priority,
    dueAt: deadline?.dueAt ?? null,
  });
  await appendMessage(input.scope, {
    conversationId: conversation.id,
    role: "employee",
    body: input.result.acknowledgement,
    taskId: task.id,
  });
  if (deadline) {
    await recordActivity(input.scope, {
      taskId: task.id,
      kind: "note",
      summary: `Deadline set: ${formatDueLabel(deadline.dueAt, timeZone)} (${timeZone}).`,
    });
  }
  if (priority !== "normal") {
    await recordActivity(input.scope, {
      taskId: task.id,
      kind: "note",
      summary: `Priority: ${priority}.`,
    });
  }

  const execute = input.execute ?? true;
  if (execute === false) {
    const seeded = await seedTask(input.scope, task.id, input.result.plan);
    return { taskId: task.id, runId: seeded.runId, mode: "seeded" };
  }
  if (execute === "queue") {
    const seeded = await seedTask(input.scope, task.id, input.result.plan);
    const queued = await enqueueWorkExecution(
      {
        organisationId: input.scope.organisationId,
        employeeId: input.scope.employeeId,
        taskId: task.id,
        runId: seeded.runId,
      },
      { scope: input.scope, researchProvider: input.researchProvider },
    );
    return { taskId: task.id, runId: seeded.runId, mode: queued.mode };
  }

  await runTask(
    input.scope,
    task.id,
    input.result.plan,
    input.researchProvider,
  );
  return { taskId: task.id, mode: "sync" };
}

async function seedTask(
  scope: WorkScope,
  taskId: string,
  plan?: { title: string; detail?: string; toolId: string }[],
) {
  await setTaskStatus(scope, taskId, "planning");
  const run = await createRun(scope, taskId);
  if (plan && plan.length > 0) {
    await createSteps(scope, { taskId, runId: run.id, steps: plan });
  }
  await recordActivity(scope, {
    taskId,
    runId: run.id,
    kind: "started",
    summary: "Queued for durable execution.",
  });
  await setTaskStatus(scope, taskId, "queued");
  return { runId: run.id };
}

async function runTask(
  scope: WorkScope,
  taskId: string,
  plan?: { title: string; detail?: string; toolId: string }[],
  researchProvider?: ResearchProvider | null,
) {
  await setTaskStatus(scope, taskId, "planning");
  const run = await createRun(scope, taskId);
  if (plan && plan.length > 0) {
    await createSteps(scope, { taskId, runId: run.id, steps: plan });
  }
  await recordActivity(scope, {
    taskId,
    runId: run.id,
    kind: "started",
    summary: "Started work.",
  });
  await setTaskStatus(scope, taskId, "running");
  await runWorkExecuteJob(
    {
      organisationId: scope.organisationId,
      employeeId: scope.employeeId,
      taskId,
      runId: run.id,
    },
    { researchProvider, scope },
  );
}

async function resumeTask(
  scope: WorkScope,
  taskId: string,
  execute: ExecuteMode,
  researchProvider?: ResearchProvider | null,
) {
  const steps = await listStepsForTask(scope, taskId);
  let runId = steps.find((step) => step.runId)?.runId;
  if (!runId) {
    const run = await createRun(scope, taskId);
    runId = run.id;
  }
  if (execute === "queue") {
    const queued = await enqueueWorkExecution(
      {
        organisationId: scope.organisationId,
        employeeId: scope.employeeId,
        taskId,
        runId,
      },
      { scope, researchProvider },
    );
    return { taskId, runId, mode: queued.mode };
  }
  if (execute === false) {
    return { taskId, runId, mode: "seeded" as const };
  }
  await runWorkExecuteJob(
    {
      organisationId: scope.organisationId,
      employeeId: scope.employeeId,
      taskId,
      runId,
    },
    { researchProvider, scope },
  );
  return { taskId, runId, mode: "sync" as const };
}

async function targetTask(
  scope: WorkScope,
  action: "pause" | "resume" | "cancel",
  preferredId?: string,
) {
  if (preferredId) {
    const preferred = await getTaskForScope(scope, preferredId);
    if (preferred) {
      return preferred;
    }
  }
  if (action === "resume") {
    return findOpenTask(scope, ["paused"]);
  }
  return (
    (await findOpenTask(scope, ["running", "planning", "queued"])) ??
    (await findOpenTask(scope, ["waiting_for_approval", "paused", "blocked"]))
  );
}

export async function executeExistingTask(
  scope: WorkScope,
  taskId: string,
  researchProvider?: ResearchProvider | null,
) {
  const task = await getTaskForScope(scope, taskId);
  if (!task) {
    return;
  }
  const steps = await listStepsForTask(scope, task.id);
  let runId = steps.find((step) => step.runId)?.runId;
  if (!runId) {
    const run = await createRun(scope, task.id);
    runId = run.id;
  }
  await runWorkExecuteJob(
    {
      organisationId: scope.organisationId,
      employeeId: scope.employeeId,
      taskId: task.id,
      runId,
    },
    { researchProvider, scope },
  );
}

export async function enqueueExistingTask(scope: WorkScope, taskId: string) {
  const task = await getTaskForScope(scope, taskId);
  if (!task) {
    return null;
  }
  const steps = await listStepsForTask(scope, task.id);
  let runId = steps.find((step) => step.runId)?.runId;
  if (!runId) {
    const run = await createRun(scope, task.id);
    runId = run.id;
  }
  return enqueueWorkExecution(
    {
      organisationId: scope.organisationId,
      employeeId: scope.employeeId,
      taskId: task.id,
      runId,
    },
    { scope },
  );
}
