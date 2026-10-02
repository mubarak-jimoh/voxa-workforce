import { usageEvent } from "../db/schema";
import type { WorkScope } from "../work/scope";
import { newId, now } from "../work/scope";
import type { ModelUsage } from "./adapter";

export type UsageEvent = {
  organisationId: string;
  employeeId: string;
  kind: "interpret" | "model" | "tool";
  toolId?: string;
  tokens?: number;
  provider?: string;
  model?: string;
  inputTokens?: number;
  outputTokens?: number;
  operation?: string;
};

function estimatedCostUsd(usage: Pick<ModelUsage, "inputTokens" | "outputTokens" | "model">): string | null {
  if (!usage.model.includes("gpt-4o-mini") && !usage.model.includes("heuristic")) {
    if (usage.inputTokens === 0 && usage.outputTokens === 0) {
      return null;
    }
  }
  const input = (usage.inputTokens / 1_000_000) * 0.15;
  const output = (usage.outputTokens / 1_000_000) * 0.6;
  const total = input + output;
  if (total <= 0) {
    return "0";
  }
  return total.toFixed(8);
}

export async function persistUsage(
  scope: WorkScope,
  input: {
    usage: ModelUsage;
    operation: string;
    estimatedCostUsd?: string | null;
  },
): Promise<void> {
  try {
    await scope.db.insert(usageEvent).values({
      id: newId(),
      organisationId: scope.organisationId,
      employeeId: scope.employeeId,
      provider: input.usage.provider,
      model: input.usage.model,
      operation: input.operation,
      inputTokens: input.usage.inputTokens,
      outputTokens: input.usage.outputTokens,
      estimatedCostUsd: input.estimatedCostUsd ?? estimatedCostUsd(input.usage),
      createdAt: now(),
    });
  } catch (error) {
    console.error("usage_persist_failed", error);
  }
}

/** @deprecated Use persistUsage. Kept so existing callers compile during the adapter landing. */
export function recordUsage(event: UsageEvent): void {
  void event;
}
