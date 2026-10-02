import { describe, expect, it } from "vitest";
import { interpretLeadHandler } from "@/employees/lead-handler/planner";
import {
  getTaskForScope,
  listActivity,
  listApprovals,
  listArtifactsForTask,
  listMessages,
  getOrCreateConversation,
} from "@/platform/work/queries";
import { applyInstruction } from "@/platform/work/submit";
import { createTestDatabase, createTestWorkspace, workScopeFor } from "./helpers";

describe("work tenant isolation", () => {
  it("does not leak tasks, activity, artifacts or approvals across organisations", async () => {
    const { db } = await createTestDatabase();
    const orgA = await createTestWorkspace(db, {
      organisationName: "Oak & Wool",
      email: "a@example.com",
    });
    const orgB = await createTestWorkspace(db, {
      organisationName: "Lime Street Joinery",
      email: "b@example.com",
    });
    const scopeA = workScopeFor(db, orgA);
    const scopeB = workScopeFor(db, orgB);

    const instruction = "Find 10 hotel groups in Manchester";
    const result = interpretLeadHandler(instruction, {
      employeeName: orgA.employee.name,
      roleLabel: "lead_handler",
      paused: false,
      openTaskTitles: [],
      pendingApprovalCount: 0,
      completedTodayCount: 0,
    });
    const applied = await applyInstruction({
      scope: scopeA,
      userId: orgA.owner.id,
      employeeName: orgA.employee.name,
      instruction,
      result,
      paused: false,
    });

    const taskId = applied.taskId ?? "";
    expect(await getTaskForScope(scopeA, taskId)).toBeTruthy();
    expect(await getTaskForScope(scopeB, taskId)).toBeNull();
    expect(await listArtifactsForTask(scopeB, taskId)).toHaveLength(0);
    expect(await listActivity(scopeB, taskId)).toHaveLength(0);
    expect(await listApprovals(scopeB)).toHaveLength(0);

    const conversationB = await getOrCreateConversation(scopeB);
    const messagesB = await listMessages(scopeB, conversationB.id);
    expect(messagesB).toHaveLength(0);
  });
});
