import { describe, expect, it } from "vitest";
import { interpretWithAvery } from "@/platform/ai/brain";
import { createHeuristicAdapter } from "@/platform/ai/heuristic";
import { executeInternalTool } from "@/platform/ai/tools";
import { averySystemPrompt } from "@/employees/lead-handler/prompt";
import { createFixtureProvider } from "@/platform/research/fixture";
import { createApproval, setTaskStatus } from "@/platform/work/commands";
import { parseDeadline } from "@/platform/work/deadline";
import {
  enqueueWorkExecution,
  resolveWorkExecutor,
  workExecuteIdempotencyKey,
} from "@/platform/work/enqueue";
import { runWorkExecuteJob } from "@/platform/work/execute-job";
import { parsePriority } from "@/platform/work/priority";
import {
  getTaskForScope,
  listActivity,
  listApprovals,
  listArtifactsForTask,
  listStepsForTask,
} from "@/platform/work/queries";
import { applyInstruction } from "@/platform/work/submit";
import { createTestDatabase, createTestWorkspace, workScopeFor } from "./helpers";

function prompt(name = "Avery", org = "Northridge") {
  return averySystemPrompt({
    employeeName: name,
    roleLabel: "Lead Handler",
    roleSummary: "Handles prospect research, qualification and outreach preparation.",
    organisationName: org,
  });
}

async function interpret(
  dbWorkspace: Awaited<ReturnType<typeof createTestWorkspace>> & {
    db: Awaited<ReturnType<typeof createTestDatabase>>["db"];
  },
  instruction: string,
) {
  return interpretWithAvery({
    scope: workScopeFor(dbWorkspace.db, dbWorkspace),
    instruction,
    organisationName: dbWorkspace.organisation.name,
    employeeName: dbWorkspace.employee.name,
    roleLabel: "Lead Handler",
    paused: false,
    systemPrompt: prompt(dbWorkspace.employee.name, dbWorkspace.organisation.name),
    adapter: createHeuristicAdapter(),
  });
}

const RESEARCH =
  "Find me 10 commercial cleaning companies in South London. Verify them and have the results ready in 10 minutes.";

describe("deadline and priority parsing", () => {
  it("interprets natural deadlines in Europe/London without assuming bare UTC", () => {
    const now = new Date("2026-09-04T10:00:00.000Z");
    const inTen = parseDeadline("have the results ready in 10 minutes", {
      now,
      timeZone: "Europe/London",
    });
    expect(inTen?.dueAt.getTime()).toBe(now.getTime() + 10 * 60 * 1000);

    const byFive = parseDeadline("Get this done by 5pm", {
      now: new Date("2026-09-04T08:00:00.000Z"),
      timeZone: "Europe/London",
    });
    expect(byFive?.dueAt).toBeTruthy();
    expect(byFive!.dueAt.getUTCHours()).toBeGreaterThanOrEqual(15);

    const friday = parseDeadline("Find 20 prospects before Friday", {
      now: new Date("2026-09-01T10:00:00.000Z"),
      timeZone: "Europe/London",
    });
    expect(friday?.label.toLowerCase()).toMatch(/fri/);
  });

  it("parses restrained priorities", () => {
    expect(parsePriority("Do this first.")).toBe("urgent");
    expect(parsePriority("This is urgent.")).toBe("urgent");
    expect(parsePriority("High priority research")).toBe("high");
    expect(parsePriority("Find companies in Croydon")).toBe("normal");
  });
});

describe("durable work execution", () => {
  it("uses the inline executor in tests", () => {
    expect(resolveWorkExecutor()).toBe("inline");
  });

  it("queues durable execution and persists deadline + priority", async () => {
    const { db } = await createTestDatabase();
    const workspace = await createTestWorkspace(db);
    const scope = workScopeFor(db, workspace);
    const result = await interpret({ ...workspace, db }, RESEARCH);
    const applied = await applyInstruction({
      scope,
      userId: workspace.owner.id,
      employeeName: workspace.employee.name,
      instruction: RESEARCH,
      result,
      paused: false,
      execute: "queue",
      researchProvider: createFixtureProvider(),
    });

    expect(applied.mode).toBe("inline");
    expect(applied.runId).toBeTruthy();
    const task = await getTaskForScope(scope, applied.taskId ?? "");
    expect(task?.dueAt).toBeTruthy();
    expect(task?.priority).toBe("normal");
    expect(task?.status).toBe("completed");
    const artifacts = await listArtifactsForTask(scope, task!.id);
    expect(artifacts.some((item) => item.data?.type === "research_results")).toBe(true);
    const activity = await listActivity(scope, task!.id);
    expect(activity.some((item) => /Deadline set/i.test(item.summary))).toBe(true);
    expect(activity.some((item) => /Research complete|I found/i.test(item.summary))).toBe(true);
  });

  it("denies cross-tenant worker payloads", async () => {
    const { db } = await createTestDatabase();
    const orgA = await createTestWorkspace(db, { email: "a@example.com" });
    const orgB = await createTestWorkspace(db, { email: "b@example.com" });
    const scopeA = workScopeFor(db, orgA);
    const result = await interpret({ ...orgA, db }, "Capture a brief about office cleaning.");
    const applied = await applyInstruction({
      scope: scopeA,
      userId: orgA.owner.id,
      employeeName: orgA.employee.name,
      instruction: "Capture a brief about office cleaning.",
      result,
      paused: false,
      execute: false,
    });
    const denied = await runWorkExecuteJob(
      {
        organisationId: orgB.organisation.id,
        employeeId: orgB.employee.id,
        taskId: applied.taskId ?? "",
        runId: applied.runId ?? "missing",
      },
      { scope: workScopeFor(db, orgB) },
    );
    expect(denied.status).toBe("denied");
  });

  it("skips completed steps and does not duplicate research artifacts on retry", async () => {
    const { db } = await createTestDatabase();
    const workspace = await createTestWorkspace(db);
    const scope = workScopeFor(db, workspace);
    const result = await interpret({ ...workspace, db }, RESEARCH);
    const applied = await applyInstruction({
      scope,
      userId: workspace.owner.id,
      employeeName: workspace.employee.name,
      instruction: RESEARCH,
      result,
      paused: false,
      researchProvider: createFixtureProvider(),
    });
    const before = await listArtifactsForTask(scope, applied.taskId ?? "");
    const researchBefore = before.filter((item) => item.data?.type === "research_results");
    expect(researchBefore.length).toBe(1);

    const steps = await listStepsForTask(scope, applied.taskId ?? "");
    const retry = await runWorkExecuteJob(
      {
        organisationId: scope.organisationId,
        employeeId: scope.employeeId,
        taskId: applied.taskId ?? "",
        runId: steps[0]?.runId ?? "",
      },
      { scope, researchProvider: createFixtureProvider() },
    );
    expect(retry.status).toBe("completed");
    const after = await listArtifactsForTask(scope, applied.taskId ?? "");
    expect(after.filter((item) => item.data?.type === "research_results")).toHaveLength(1);
  });

  it("does not duplicate pending approvals on retry", async () => {
    const { db } = await createTestDatabase();
    const workspace = await createTestWorkspace(db);
    const scope = workScopeFor(db, workspace);
    const result = await interpret({ ...workspace, db }, "Send the outreach email after I approve.");
    const applied = await applyInstruction({
      scope,
      userId: workspace.owner.id,
      employeeName: workspace.employee.name,
      instruction: "Send the outreach email after I approve.",
      result,
      paused: false,
    });
    const taskId = applied.taskId ?? "";
    await createApproval(scope, {
      taskId,
      title: "Email sending is not connected",
      summary: "test",
      actionKind: "send_email",
    });
    await createApproval(scope, {
      taskId,
      title: "Email sending is not connected",
      summary: "test again",
      actionKind: "send_email",
    });
    const pending = (await listApprovals(scope, "pending")).filter(
      (item) => item.taskId === taskId,
    );
    expect(pending).toHaveLength(1);
  });

  it("stops cancelled and paused work instead of completing later", async () => {
    const { db } = await createTestDatabase();
    const workspace = await createTestWorkspace(db);
    const scope = workScopeFor(db, workspace);
    const result = await interpret({ ...workspace, db }, RESEARCH);
    const applied = await applyInstruction({
      scope,
      userId: workspace.owner.id,
      employeeName: workspace.employee.name,
      instruction: RESEARCH,
      result,
      paused: false,
      execute: false,
      researchProvider: createFixtureProvider(),
    });
    await setTaskStatus(scope, applied.taskId ?? "", "cancelled");
    const cancelled = await runWorkExecuteJob(
      {
        organisationId: scope.organisationId,
        employeeId: scope.employeeId,
        taskId: applied.taskId ?? "",
        runId: applied.runId ?? "",
      },
      { scope, researchProvider: createFixtureProvider() },
    );
    expect(cancelled.status).toBe("cancelled");
    expect((await getTaskForScope(scope, applied.taskId ?? ""))?.status).toBe("cancelled");

    const second = await interpret({ ...workspace, db }, "Find 3 cleaners in Brixton urgently.");
    const seeded = await applyInstruction({
      scope,
      userId: workspace.owner.id,
      employeeName: workspace.employee.name,
      instruction: "Find 3 cleaners in Brixton urgently.",
      result: second,
      paused: false,
      execute: false,
    });
    await setTaskStatus(scope, seeded.taskId ?? "", "paused");
    const paused = await runWorkExecuteJob(
      {
        organisationId: scope.organisationId,
        employeeId: scope.employeeId,
        taskId: seeded.taskId ?? "",
        runId: seeded.runId ?? "",
      },
      { scope, researchProvider: createFixtureProvider() },
    );
    expect(paused.status).toBe("paused");
    expect((await getTaskForScope(scope, seeded.taskId ?? ""))?.status).toBe("paused");
  });

  it("resumes remaining work from queued state", async () => {
    const { db } = await createTestDatabase();
    const workspace = await createTestWorkspace(db);
    const scope = workScopeFor(db, workspace);
    const seeded = await applyInstruction({
      scope,
      userId: workspace.owner.id,
      employeeName: workspace.employee.name,
      instruction: "Capture a brief for South London cleaning prospects.",
      result: await interpret(
        { ...workspace, db },
        "Capture a brief for South London cleaning prospects.",
      ),
      paused: false,
      execute: false,
    });
    const before = await listStepsForTask(scope, seeded.taskId ?? "");
    expect(before.every((step) => step.status === "pending")).toBe(true);
    await setTaskStatus(scope, seeded.taskId ?? "", "queued");
    await enqueueWorkExecution(
      {
        organisationId: scope.organisationId,
        employeeId: scope.employeeId,
        taskId: seeded.taskId ?? "",
        runId: seeded.runId ?? before[0]?.runId ?? "",
      },
      { scope },
    );
    const finished = await getTaskForScope(scope, seeded.taskId ?? "");
    expect(["completed", "blocked"]).toContain(finished?.status);
    const after = await listStepsForTask(scope, seeded.taskId ?? "");
    expect(after.some((step) => step.status === "completed" || step.status === "blocked")).toBe(
      true,
    );
  });

  it("answers queue questions from persisted state", async () => {
    const { db } = await createTestDatabase();
    const workspace = await createTestWorkspace(db);
    const scope = workScopeFor(db, workspace);
    await applyInstruction({
      scope,
      userId: workspace.owner.id,
      employeeName: workspace.employee.name,
      instruction: RESEARCH,
      result: await interpret({ ...workspace, db }, RESEARCH),
      paused: false,
      execute: false,
    });
    const status = await interpret({ ...workspace, db }, "What are you doing?");
    expect(status.kind).toBe("reply");
    const queue = await executeInternalTool(scope, "get_work_queue", "{}");
    expect(queue.ok).toBe(true);
    expect(queue.data).toMatchObject({
      queued: expect.any(Array),
      active: expect.any(Array),
    });
  });

  it("builds a stable idempotency key from scoped ids only", () => {
    expect(
      workExecuteIdempotencyKey({
        organisationId: "org",
        employeeId: "emp",
        taskId: "task",
        runId: "run",
      }),
    ).toBe("work-execute-org-task-run");
  });
});
