import type { ToolId } from "./constants";
import {
  createArtifact,
  createApproval,
  finishRun,
  recordActivity,
  setStepStatus,
  setTaskStatus,
} from "./commands";
import { getTaskForScope, listArtifactsForTask, listStepsForTask } from "./queries";
import type { WorkScope } from "./scope";
import { createConfiguredResearchProvider } from "../research/factory";
import { isWebResearchAvailable, type ResearchProvider } from "../research/provider";
import { completionSummaryForTask } from "./completion";
import { webResearchTool } from "../research/tool";

function isCapturableBriefStep(title: string): boolean {
  return /^(capture|record|note)\b/i.test(title.trim()) || /\bcaptured brief\b/i.test(title);
}

const UNAVAILABLE: Partial<Record<ToolId, string>> = {
  ...(isWebResearchAvailable()
    ? {}
    : {
        web_research:
          "Web research is not connected. I will not invent companies or contacts.",
      }),
  find_contacts:
    "Contact lookup is not connected. I cannot fabricate decision-makers.",
  draft_outreach:
    "Outreach drafting needs a real prospect list first, and no writing provider is connected.",
  send_email:
    "Email sending is not connected. I will not claim messages were sent.",
};

export async function executeTaskRun(
  scope: WorkScope,
  input: { taskId: string; runId: string; researchProvider?: ResearchProvider | null },
): Promise<{
  status: "blocked" | "completed" | "waiting_for_approval" | "cancelled";
  summary?: string;
}> {
  const steps = await listStepsForTask(scope, input.taskId);
  if (steps.length === 0) {
    await setTaskStatus(scope, input.taskId, "blocked", {
      blockedReason: "No execution plan is stored for this task.",
    });
    await recordActivity(scope, {
      taskId: input.taskId,
      runId: input.runId,
      kind: "blocked",
      summary: "No execution plan is stored for this task.",
    });
    await finishRun(scope, input.runId, "failed");
    return { status: "blocked" };
  }

  let blockedReason: string | undefined;
  let waiting = false;
  let summary: string | undefined;

  for (const step of steps) {
    if (step.status === "completed" || step.status === "skipped") {
      continue;
    }
    const current = await getTaskForScope(scope, input.taskId);
    if (!current || current.status === "cancelled") {
      await finishRun(scope, input.runId, "cancelled");
      return { status: "cancelled", summary: "I stopped that work." };
    }
    if (current.status === "paused") {
      if (step.status === "running") {
        await setStepStatus(scope, step.id, "pending");
      }
      await finishRun(scope, input.runId, "cancelled");
      return {
        status: "cancelled",
        summary: "Paused — remaining work will wait until you resume.",
      };
    }
    await setStepStatus(scope, step.id, "running");
    const toolId = step.toolId as ToolId | null;
    const unavailable = toolId ? UNAVAILABLE[toolId] : undefined;

    if (toolId === "web_research") {
      const existing = await listArtifactsForTask(scope, input.taskId);
      if (existing.some((item) => item.kind === "list" && item.data?.type === "research_results")) {
        await setStepStatus(scope, step.id, "completed");
        await recordActivity(scope, {
          taskId: input.taskId,
          runId: input.runId,
          stepId: step.id,
          kind: "progress",
          summary: "Verified against the sources already collected.",
        });
        continue;
      }
      const provider =
        input.researchProvider === undefined
          ? createConfiguredResearchProvider()
          : input.researchProvider;
      if (!provider) {
        blockedReason =
          "Web research is not connected. I will not invent companies or contacts.";
        await recordActivity(scope, {
          taskId: input.taskId,
          runId: input.runId,
          stepId: step.id,
          kind: "blocked",
          summary: blockedReason,
        });
        await setStepStatus(scope, step.id, "blocked", blockedReason);
        const remaining = steps.slice(steps.indexOf(step) + 1);
        for (const rest of remaining) {
          await setStepStatus(scope, rest.id, "skipped", blockedReason);
        }
        break;
      }
      const task = await getTaskForScope(scope, input.taskId);
      const outcome = await webResearchTool.execute({
        scope,
        taskId: input.taskId,
        runId: input.runId,
        stepId: step.id,
        instruction: task?.instruction ?? step.detail ?? step.title,
        provider,
      });
      if (!outcome.ok) {
        if (outcome.code === "cancelled") {
          await finishRun(scope, input.runId, "cancelled");
          return { status: "cancelled", summary: outcome.reason };
        }
        blockedReason = outcome.reason;
        await recordActivity(scope, {
          taskId: input.taskId,
          runId: input.runId,
          stepId: step.id,
          kind: "blocked",
          summary: blockedReason,
        });
        await setStepStatus(scope, step.id, "blocked", blockedReason);
        const remaining = steps.slice(steps.indexOf(step) + 1);
        for (const rest of remaining) {
          await setStepStatus(scope, rest.id, "skipped", blockedReason);
        }
        break;
      }
      summary = outcome.summary;
      continue;
    }

    if (toolId === "find_contacts") {
      const existing = await listArtifactsForTask(scope, input.taskId);
      if (existing.some((item) => item.kind === "list" && item.data?.type === "research_results")) {
        await setStepStatus(scope, step.id, "skipped", "Contact discovery is not connected yet.");
        await recordActivity(scope, {
          taskId: input.taskId,
          runId: input.runId,
          stepId: step.id,
          kind: "note",
          summary: "Skipped contact discovery — that capability is not connected yet.",
        });
        continue;
      }
    }

    if (toolId === "record_brief") {
      if (!isCapturableBriefStep(step.title)) {
        const existing = await listArtifactsForTask(scope, input.taskId);
        if (existing.some((item) => item.kind === "list" && item.data?.type === "research_results")) {
          await setStepStatus(scope, step.id, "completed");
          continue;
        }
        blockedReason =
          "I can capture a brief, but I will not mark analysis, research or drafts as done without a connected tool.";
        await recordActivity(scope, {
          taskId: input.taskId,
          runId: input.runId,
          stepId: step.id,
          kind: "blocked",
          summary: blockedReason,
        });
        await setStepStatus(scope, step.id, "blocked", blockedReason);
        const remaining = steps.slice(steps.indexOf(step) + 1);
        for (const rest of remaining) {
          await setStepStatus(scope, rest.id, "skipped", blockedReason);
        }
        break;
      }
      const existingBriefs = await listArtifactsForTask(scope, input.taskId);
      if (existingBriefs.some((item) => item.kind === "brief" && item.data?.captured)) {
        await setStepStatus(scope, step.id, "completed");
        continue;
      }
      await createArtifact(scope, {
        taskId: input.taskId,
        kind: "brief",
        title: "Captured brief",
        body: step.detail ?? step.title,
        data: { captured: true },
      });
      await recordActivity(scope, {
        taskId: input.taskId,
        runId: input.runId,
        stepId: step.id,
        kind: "progress",
        summary: `Recorded the brief: ${step.title}`,
      });
      await setStepStatus(scope, step.id, "completed");
      continue;
    }

    if (toolId === "send_email") {
      await createApproval(scope, {
        taskId: input.taskId,
        title: "Email sending is not connected",
        summary:
          "Avery would ask before sending anything external. There is no mail connection, so nothing can be sent.",
        actionKind: "send_email",
        payload: {
          connected: false,
          wouldSend: false,
        },
      });
      await recordActivity(scope, {
        taskId: input.taskId,
        runId: input.runId,
        stepId: step.id,
        kind: "waiting",
        summary:
          "External send requires approval, and email is not connected yet.",
      });
      await setStepStatus(
        scope,
        step.id,
        "blocked",
        UNAVAILABLE.send_email,
      );
      waiting = true;
      blockedReason = UNAVAILABLE.send_email;
      continue;
    }

    if (unavailable) {
      await recordActivity(scope, {
        taskId: input.taskId,
        runId: input.runId,
        stepId: step.id,
        kind: "blocked",
        summary: unavailable,
      });
      await setStepStatus(scope, step.id, "blocked", unavailable);
      blockedReason = unavailable;
      const remaining = steps.slice(steps.indexOf(step) + 1);
      for (const rest of remaining) {
        await setStepStatus(scope, rest.id, "skipped", unavailable);
      }
      break;
    }

    blockedReason = "That step has no connected tool, so I will not mark it done.";
    await recordActivity(scope, {
      taskId: input.taskId,
      runId: input.runId,
      stepId: step.id,
      kind: "blocked",
      summary: blockedReason,
    });
    await setStepStatus(scope, step.id, "blocked", blockedReason);
    const remaining = steps.slice(steps.indexOf(step) + 1);
    for (const rest of remaining) {
      await setStepStatus(scope, rest.id, "skipped", blockedReason);
    }
    break;
  }

  if (waiting) {
    await setTaskStatus(scope, input.taskId, "waiting_for_approval", {
      blockedReason,
    });
    await finishRun(scope, input.runId, "completed");
    return { status: "waiting_for_approval" };
  }

  const latest = await getTaskForScope(scope, input.taskId);
  if (!latest || latest.status === "cancelled") {
    await finishRun(scope, input.runId, "cancelled");
    return { status: "cancelled", summary: "I stopped that work." };
  }
  if (latest.status === "paused") {
    await finishRun(scope, input.runId, "cancelled");
    return {
      status: "cancelled",
      summary: "Paused — remaining work will wait until you resume.",
    };
  }

  if (blockedReason) {
    await createArtifact(scope, {
      taskId: input.taskId,
      kind: "report",
      title: "What blocked this work",
      body: blockedReason,
      data: { inventedResults: false },
    });
    await setTaskStatus(scope, input.taskId, "blocked", { blockedReason });
    await recordActivity(scope, {
      taskId: input.taskId,
      runId: input.runId,
      kind: "blocked",
      summary: blockedReason,
    });
    await finishRun(scope, input.runId, "failed");
    return { status: "blocked" };
  }

  const closing =
    summary ?? "Finished the work that could be completed with connected tools.";
  const report = await completionSummaryForTask(scope, input.taskId, closing);
  await setTaskStatus(scope, input.taskId, "completed");
  await recordActivity(scope, {
    taskId: input.taskId,
    runId: input.runId,
    kind: "completed",
    summary: report,
  });
  await finishRun(scope, input.runId, "completed");
  return { status: "completed", summary: closing };
}
