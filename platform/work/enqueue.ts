import { inngest } from "@/integrations/inngest/client";
import type { ResearchProvider } from "../research/provider";
import { WORK_EXECUTE_EVENT } from "./constants";
import { runWorkExecuteJob, type WorkExecutePayload } from "./execute-job";
import type { WorkScope } from "./scope";

export type WorkExecutorMode = "inline" | "inngest";

export function resolveWorkExecutor(
  source: NodeJS.ProcessEnv = process.env,
): WorkExecutorMode {
  const explicit = source.VOXA_WORK_EXECUTOR;
  if (explicit === "inline" || explicit === "sync") {
    return "inline";
  }
  if (explicit === "inngest") {
    return "inngest";
  }
  if (source.NODE_ENV === "test" || source.VOXA_WORK_EXECUTOR === "test") {
    return "inline";
  }
  return "inngest";
}

export function workExecuteIdempotencyKey(payload: WorkExecutePayload): string {
  return `work-execute-${payload.organisationId}-${payload.taskId}-${payload.runId}`;
}

/**
 * Enqueue durable execution. Payload carries IDs only — the worker reloads DB state.
 * In test/inline mode the same worker runs immediately against the provided scope.
 */
export async function enqueueWorkExecution(
  payload: WorkExecutePayload,
  options?: { scope?: WorkScope; researchProvider?: ResearchProvider | null },
): Promise<{ mode: WorkExecutorMode; enqueued: true }> {
  const mode = resolveWorkExecutor();
  if (mode === "inline") {
    await runWorkExecuteJob(payload, {
      scope: options?.scope,
      researchProvider: options?.researchProvider,
    });
    return { mode, enqueued: true };
  }

  try {
    await inngest.send({
      id: workExecuteIdempotencyKey(payload),
      name: WORK_EXECUTE_EVENT,
      data: {
        organisationId: payload.organisationId,
        employeeId: payload.employeeId,
        taskId: payload.taskId,
        runId: payload.runId,
      },
    });
  } catch (error) {
    console.error("durable_enqueue_failed", error);
    throw new Error(
      "Avery could not queue durable work. Start the Inngest Dev Server (npx inngest-cli@latest dev) or set INNGEST_EVENT_KEY.",
    );
  }
  return { mode, enqueued: true };
}
