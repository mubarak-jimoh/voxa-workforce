import { NonRetriableError } from "inngest";
import { inngest } from "../client";
import { WORK_EXECUTE_EVENT } from "@/platform/work/constants";
import { runWorkExecuteJob } from "@/platform/work/execute-job";

export const workExecuteRun = inngest.createFunction(
  {
    id: "work-execute-run",
    triggers: [{ event: WORK_EXECUTE_EVENT }],
    retries: 4,
    concurrency: {
      key: "event.data.taskId",
      limit: 1,
    },
  },
  async ({ event, step }) => {
    const data = event.data as {
      organisationId?: string;
      employeeId?: string;
      taskId?: string;
      runId?: string;
    };
    if (
      !data.organisationId ||
      !data.employeeId ||
      !data.taskId ||
      !data.runId
    ) {
      throw new NonRetriableError("work/execute.run missing scoped ids");
    }

    const result = await step.run("execute-scoped-work", async () =>
      runWorkExecuteJob({
        organisationId: data.organisationId!,
        employeeId: data.employeeId!,
        taskId: data.taskId!,
        runId: data.runId!,
      }),
    );

    if (result.status === "denied") {
      throw new NonRetriableError(result.summary ?? "Cross-tenant or missing task");
    }
    if (result.status === "cancelled" || result.status === "paused") {
      return result;
    }
    if (result.status === "blocked" && /not connected|could not be validated|malformed/i.test(result.summary ?? "")) {
      throw new NonRetriableError(result.summary ?? "Permanent block");
    }

    return result;
  },
);
