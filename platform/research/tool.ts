import { capabilityStatus } from "../ai/capabilities";
import type { WorkScope } from "../work/scope";
import { runResearchPipeline, type ResearchRunResult } from "./pipeline";
import type { ResearchProvider } from "./provider";
import {
  researchArtifactDataSchema,
  researchInputSchema,
  type ResearchInput,
} from "./schema";

export const webResearchTool = {
  id: "web_research" as const,
  description: "Research companies and facts on the public web and persist grounded results.",
  inputSchema: researchInputSchema,
  outputSchema: researchArtifactDataSchema,
  risk: "low" as const,
  approval: "none" as const,
  availability(): "available" | "not_connected" {
    return capabilityStatus("web_research");
  },
  async execute(input: {
    scope: WorkScope;
    taskId: string;
    runId: string;
    stepId: string;
    instruction: string;
    provider: ResearchProvider;
    requested?: Partial<ResearchInput>;
  }): Promise<ResearchRunResult> {
    const requested = input.requested
      ? researchInputSchema.partial().safeParse(input.requested)
      : null;
    if (requested && !requested.success) {
      return {
        ok: false,
        code: "blocked",
        reason: "The research request could not be validated.",
      };
    }
    return runResearchPipeline({
      scope: input.scope,
      taskId: input.taskId,
      runId: input.runId,
      stepId: input.stepId,
      instruction: input.instruction,
      provider: input.provider,
      requested: requested?.success ? requested.data : undefined,
    });
  },
};
