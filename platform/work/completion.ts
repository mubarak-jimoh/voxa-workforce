import type { WorkScope } from "./scope";
import { listArtifactsForTask } from "./queries";

export async function completionSummaryForTask(
  scope: WorkScope,
  taskId: string,
  fallback?: string,
): Promise<string> {
  const artifacts = await listArtifactsForTask(scope, taskId);
  const research = artifacts.find(
    (item) => item.kind === "list" && item.data?.type === "research_results",
  );
  if (research?.data) {
    const found = typeof research.data.found === "number" ? research.data.found : 0;
    const verified =
      typeof research.data.verified === "number" ? research.data.verified : 0;
    const needsReview =
      typeof research.data.needsReview === "number" ? research.data.needsReview : 0;
    return `Research complete. ${found} companies found, ${verified} verified, ${needsReview} need review.`;
  }
  return fallback ?? "That work is complete.";
}
