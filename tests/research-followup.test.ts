import { describe, expect, it } from "vitest";
import { emptyDecision } from "@/platform/ai/schema";
import {
  coerceResearchFollowUpDecision,
  detectResearchFollowUp,
} from "@/platform/ai/research-followup";

describe("research follow-up coercion", () => {
  const research = {
    artifactId: "art-1",
    taskId: "task-1",
    rowCount: 10,
  };

  it("detects keep strongest, remove, and get-results phrasing", () => {
    expect(detectResearchFollowUp("Take the strongest 5.")).toEqual({
      kind: "keep_strongest",
      count: 5,
    });
    expect(detectResearchFollowUp("Remove number 4.")).toEqual({
      kind: "exclude_index",
      index: 4,
    });
    expect(detectResearchFollowUp("Why did you choose number 2?")).toEqual({
      kind: "get_results",
    });
    expect(detectResearchFollowUp("Find me another 5")).toBeNull();
  });

  it("rewrites create_work re-research into refine_research keep_strongest", () => {
    const coerced = coerceResearchFollowUpDecision(
      {
        ...emptyDecision,
        intent: "create_work",
        confidence: 0.7,
        response: "I will create a task",
        work: {
          title: "Refine Research Results",
          artifactKind: "list",
          plan: [
            {
              title: "Take the strongest 5 companies",
              detail: null,
              toolId: "web_research",
            },
          ],
        },
      },
      "Take the strongest 5.",
      research,
    );
    expect(coerced.intent).toBe("workspace_query");
    expect(coerced.work).toBeNull();
    expect(coerced.toolCalls[0]?.toolId).toBe("refine_research");
    expect(JSON.parse(coerced.toolCalls[0]?.argument ?? "{}")).toMatchObject({
      action: "keep_strongest",
      count: 5,
      artifactId: "art-1",
      taskId: "task-1",
    });
  });

  it("does not coerce when there is no stored list", () => {
    const decision = {
      ...emptyDecision,
      intent: "create_work" as const,
      confidence: 0.7,
      response: "I'll research",
      work: {
        title: "Research",
        artifactKind: "list" as const,
        plan: [{ title: "Research", detail: null, toolId: "web_research" as const }],
      },
    };
    expect(
      coerceResearchFollowUpDecision(decision, "Take the strongest 5.", null),
    ).toEqual(decision);
  });
});
