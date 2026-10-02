"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getRoleLabel, getRoleSummary, systemPromptForRole } from "@/employees/runtime";
import { interpretWithAvery } from "@/platform/ai/brain";
import { readyDatabase } from "@/platform/db";
import {
  AppError,
  ForbiddenError,
  InvalidTransitionError,
  NotFoundError,
  ValidationError,
} from "@/platform/errors";
import { canCommandEmployee, canDecideApproval } from "@/platform/membership/permissions";
import { loadTenantContext } from "@/platform/tenant/load";
import {
  decideApproval,
  recordActivity,
  setScheduleEnabled,
  setTaskStatus,
} from "@/platform/work/commands";
import {
  getApprovalForScope,
  getTaskForScope,
  listApprovals,
} from "@/platform/work/queries";
import { scopeFromTenant } from "@/platform/work/scope";
import { applyInstruction, enqueueExistingTask } from "@/platform/work/submit";

export type WorkFormState = { error?: string } | null;

function revalidateWork() {
  revalidatePath("/employee");
  revalidatePath("/employee/inbox");
  revalidatePath("/employee/activity");
  revalidatePath("/employee/tasks");
  revalidatePath("/employee/schedule");
  revalidatePath("/employee", "layout");
}

export async function submitInstructionAction(
  _prev: WorkFormState,
  formData: FormData,
): Promise<WorkFormState> {
  const instruction = String(formData.get("instruction") ?? "").trim();
  if (instruction.length < 2) {
    return { error: "Tell Avery what you need." };
  }

  try {
    const tenant = await loadTenantContext();
    if (!canCommandEmployee(tenant.membershipRole)) {
      return { error: "You cannot assign work to this employee." };
    }
    const db = await readyDatabase();
    const scope = scopeFromTenant(db, tenant);
    const result = await interpretWithAvery({
      scope,
      instruction,
      organisationName: tenant.organisation.name,
      employeeName: tenant.employee.name,
      roleLabel: getRoleLabel(tenant.employee.roleType),
      roleSummary: getRoleSummary(tenant.employee.roleType),
      paused: tenant.employee.status === "paused",
      systemPrompt: systemPromptForRole({
        roleType: tenant.employee.roleType,
        employeeName: tenant.employee.name,
        organisationName: tenant.organisation.name,
      }),
    });
    await applyInstruction({
      scope,
      userId: tenant.userId,
      employeeName: tenant.employee.name,
      instruction,
      result,
      paused: tenant.employee.status === "paused",
      execute: result.kind === "work" || result.kind === "control" ? "queue" : true,
    });
    revalidateWork();
    return null;
  } catch (error) {
    if (error instanceof AppError) {
      return { error: error.message };
    }
    return { error: "Avery could not take that instruction." };
  }
}

export async function decideApprovalAction(formData: FormData) {
  const approvalId = String(formData.get("approvalId") ?? "");
  const decision = String(formData.get("decision") ?? "");
  const tenant = await loadTenantContext();
  if (!canDecideApproval(tenant.membershipRole)) {
    throw new ForbiddenError("Only an owner or admin can decide approvals.");
  }
  const db = await readyDatabase();
  const scope = scopeFromTenant(db, tenant);
  const approval = await getApprovalForScope(scope, approvalId);
  if (!approval) {
    throw new NotFoundError("Approval not found.");
  }
  const resolved = decision === "approved" ? "approved" : "rejected";
  await decideApproval(scope, {
    approvalId,
    decision: resolved,
    actorUserId: tenant.userId,
    actorRole: tenant.membershipRole,
  });
  await recordActivity(scope, {
    taskId: approval.taskId,
    kind: "note",
    summary:
      resolved === "approved"
        ? `Approved: ${approval.title}. Nothing was sent — email is not connected.`
        : `Rejected: ${approval.title}.`,
  });
  const remaining = (await listApprovals(scope, "pending")).filter(
    (item) => item.taskId === approval.taskId,
  );
  if (remaining.length === 0) {
    if (resolved === "approved") {
      await setTaskStatus(scope, approval.taskId, "blocked", {
        blockedReason: "Email is not connected. Approval was recorded; nothing was sent.",
      });
    } else {
      await setTaskStatus(scope, approval.taskId, "cancelled");
    }
  }
  revalidateWork();
  revalidatePath(`/employee/tasks/${approval.taskId}`);
}

export async function controlTaskAction(formData: FormData) {
  const taskId = String(formData.get("taskId") ?? "");
  const action = String(formData.get("action") ?? "");
  const tenant = await loadTenantContext();
  const db = await readyDatabase();
  const scope = scopeFromTenant(db, tenant);
  const task = await getTaskForScope(scope, taskId);
  if (!task) {
    throw new NotFoundError("Task not found.");
  }
  if (action === "pause") {
    if (!["queued", "planning", "running"].includes(task.status)) {
      throw new InvalidTransitionError("This work cannot be paused.");
    }
    await setTaskStatus(scope, taskId, "paused");
  } else if (action === "resume") {
    if (task.status !== "paused") {
      throw new InvalidTransitionError("Only paused work can be resumed.");
    }
    await setTaskStatus(scope, taskId, "queued");
    await recordActivity(scope, {
      taskId,
      kind: "note",
      summary: `Resumed: ${task.title}`,
    });
    await enqueueExistingTask(scope, taskId);
    revalidateWork();
    revalidatePath(`/employee/tasks/${taskId}`);
    return;
  } else if (action === "cancel") {
    if (
      !["queued", "planning", "running", "paused", "waiting_for_approval", "blocked"].includes(
        task.status,
      )
    ) {
      throw new InvalidTransitionError("This work cannot be cancelled.");
    }
    await setTaskStatus(scope, taskId, "cancelled");
  } else {
    throw new ValidationError("Unknown task control.");
  }
  await recordActivity(scope, {
    taskId,
    kind: "note",
    summary: `${action} ${task.title}`,
  });
  revalidateWork();
  revalidatePath(`/employee/tasks/${taskId}`);
}

export async function toggleScheduleAction(formData: FormData) {
  const scheduleId = String(formData.get("scheduleId") ?? "");
  const enabled = String(formData.get("enabled") ?? "") === "true";
  const tenant = await loadTenantContext();
  const db = await readyDatabase();
  const scope = scopeFromTenant(db, tenant);
  await setScheduleEnabled(scope, scheduleId, enabled);
  revalidatePath("/employee/schedule");
  revalidateWork();
}

export async function openTaskAction(formData: FormData) {
  const taskId = String(formData.get("taskId") ?? "");
  redirect(`/employee/tasks/${taskId}`);
}
