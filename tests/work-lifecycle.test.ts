import { describe, expect, it } from "vitest";
import { interpretLeadHandler } from "@/employees/lead-handler/planner";
import { createTask, decideApproval } from "@/platform/work/commands";
import { ForbiddenError } from "@/platform/errors";
import {
  getTaskForScope,
  listActivity,
  listApprovals,
  listArtifactsForTask,
  listMessages,
  listSchedules,
  listStepsForTask,
  getOrCreateConversation,
} from "@/platform/work/queries";
import { applyInstruction } from "@/platform/work/submit";
import type { InterpreterContext } from "@/platform/ai/types";
import { createTestDatabase, createTestWorkspace, workScopeFor } from "./helpers";

function ctx(): InterpreterContext {
  return {
    employeeName: "Avery",
    roleLabel: "lead_handler",
    paused: false,
    openTaskTitles: [],
    pendingApprovalCount: 0,
    completedTodayCount: 0,
  };
}

describe("work lifecycle", () => {
  it("captures a simple brief, completes it, and persists conversation", async () => {
    const { db } = await createTestDatabase();
    const workspace = await createTestWorkspace(db);
    const scope = workScopeFor(db, workspace);
    const instruction = "Note that we sell commercial kitchen extraction cleaning.";
    const result = interpretLeadHandler(instruction, ctx());

    const applied = await applyInstruction({
      scope,
      userId: workspace.owner.id,
      employeeName: workspace.employee.name,
      instruction,
      result,
      paused: false,
    });

    expect(applied.taskId).toBeTruthy();
    const task = await getTaskForScope(scope, applied.taskId ?? "");
    expect(task?.status).toBe("completed");
    expect(task?.instruction).toBe(instruction);

    const artifacts = await listArtifactsForTask(scope, task?.id ?? "");
    expect(artifacts.some((item) => item.kind === "brief")).toBe(true);

    const conversation = await getOrCreateConversation(scope);
    const messages = await listMessages(scope, conversation.id);
    expect(messages.some((item) => item.role === "user" && item.body === instruction)).toBe(
      true,
    );
    expect(messages.some((item) => item.role === "employee")).toBe(true);

    const activity = await listActivity(scope, task?.id);
    expect(activity.some((item) => item.kind === "started")).toBe(true);
    expect(activity.some((item) => item.kind === "completed")).toBe(true);
  });

  it("does not invent prospect research when web tools are missing", async () => {
    const { db } = await createTestDatabase();
    const workspace = await createTestWorkspace(db);
    const scope = workScopeFor(db, workspace);
    const instruction = "Find 30 commercial cleaning companies in London";
    const result = interpretLeadHandler(instruction, ctx());

    const applied = await applyInstruction({
      scope,
      userId: workspace.owner.id,
      employeeName: workspace.employee.name,
      instruction,
      result,
      paused: false,
    });

    const task = await getTaskForScope(scope, applied.taskId ?? "");
    expect(task?.status).toBe("blocked");
    expect(task?.blockedReason).toMatch(/Web research is not connected/i);

    const artifacts = await listArtifactsForTask(scope, task?.id ?? "");
    const serialized = JSON.stringify(artifacts);
    expect(serialized).not.toMatch(/@|\.co\.uk|Ltd|prospect list/i);
    expect(artifacts.some((item) => item.kind === "brief")).toBe(true);
    expect(artifacts.some((item) => item.title === "What blocked this work")).toBe(true);
    expect(artifacts.some((item) => item.data?.inventedResults === false)).toBe(true);

    const steps = await listStepsForTask(scope, task?.id ?? "");
    expect(steps.some((step) => step.status === "blocked")).toBe(true);
    expect(steps.some((step) => step.status === "skipped")).toBe(true);
    expect(steps.some((step) => step.status === "completed" && step.toolId === "record_brief")).toBe(
      true,
    );
  });

  it("creates an approval for send without claiming email was sent", async () => {
    const { db } = await createTestDatabase();
    const workspace = await createTestWorkspace(db);
    const scope = workScopeFor(db, workspace);
    const instruction = "Send them after I approve them.";
    const result = interpretLeadHandler(instruction, ctx());

    const applied = await applyInstruction({
      scope,
      userId: workspace.owner.id,
      employeeName: workspace.employee.name,
      instruction,
      result,
      paused: false,
    });

    const task = await getTaskForScope(scope, applied.taskId ?? "");
    expect(task?.status).toBe("waiting_for_approval");

    const pending = await listApprovals(scope, "pending");
    expect(pending).toHaveLength(1);
    expect(pending[0]?.payload).toMatchObject({ connected: false, wouldSend: false });
    expect(pending[0]?.summary).toMatch(/no mail connection/i);

    await decideApproval(scope, {
      approvalId: pending[0]?.id ?? "",
      decision: "approved",
      actorUserId: workspace.owner.id,
      actorRole: "owner",
    });

    await expect(
      decideApproval(scope, {
        approvalId: pending[0]?.id ?? "",
        decision: "rejected",
        actorUserId: workspace.owner.id,
        actorRole: "member",
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("stores schedules as configuration with schedulerLive false", async () => {
    const { db } = await createTestDatabase();
    const workspace = await createTestWorkspace(db);
    const scope = workScopeFor(db, workspace);
    const instruction = "Every Monday find 20 new prospects";
    const result = interpretLeadHandler(instruction, ctx());

    await applyInstruction({
      scope,
      userId: workspace.owner.id,
      employeeName: workspace.employee.name,
      instruction,
      result,
      paused: false,
    });

    const schedules = await listSchedules(scope);
    expect(schedules).toHaveLength(1);
    expect(schedules[0]?.schedulerLive).toBe(false);
    expect(schedules[0]?.cadence).toBe("Every Monday");
    expect(schedules[0]?.nextRunAt).toBeNull();
  });

  it("pauses and cancels queued work", async () => {
    const { db } = await createTestDatabase();
    const workspace = await createTestWorkspace(db);
    const scope = workScopeFor(db, workspace);
    const conversation = await getOrCreateConversation(scope);
    const task = await createTask(scope, {
      conversationId: conversation.id,
      createdByUserId: workspace.owner.id,
      title: "Queued research",
      instruction: "Find 5 companies",
    });

    const pause = interpretLeadHandler("Pause that.", ctx());
    await applyInstruction({
      scope,
      userId: workspace.owner.id,
      employeeName: workspace.employee.name,
      instruction: "Pause that.",
      result: pause,
      paused: false,
    });
    expect((await getTaskForScope(scope, task.id))?.status).toBe("paused");

    const cancel = interpretLeadHandler("Cancel that.", ctx());
    await applyInstruction({
      scope,
      userId: workspace.owner.id,
      employeeName: workspace.employee.name,
      instruction: "Cancel that.",
      result: cancel,
      paused: false,
    });
    expect((await getTaskForScope(scope, task.id))?.status).toBe("cancelled");
  });

  it("does not assign new work while the employee is paused", async () => {
    const { db } = await createTestDatabase();
    const workspace = await createTestWorkspace(db);
    const scope = workScopeFor(db, workspace);
    const result = interpretLeadHandler("Research a company in Manchester", ctx());
    const applied = await applyInstruction({
      scope,
      userId: workspace.owner.id,
      employeeName: workspace.employee.name,
      instruction: "Research a company in Manchester",
      result,
      paused: true,
    });
    expect(applied.taskId).toBeUndefined();
    const conversation = await getOrCreateConversation(scope);
    const messages = await listMessages(scope, conversation.id);
    expect(messages.at(-1)?.body).toMatch(/is paused/i);
  });
});
