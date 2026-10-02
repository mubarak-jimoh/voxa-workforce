import { emptyDecision, type AveryDecision } from "./schema";

export type ResearchFollowUpTarget = {
  artifactId: string;
  taskId: string;
  rowCount: number;
};

export type ResearchFollowUp =
  | { kind: "keep_strongest"; count: number }
  | { kind: "exclude_index"; index: number }
  | { kind: "get_results" };

export function detectResearchFollowUp(instruction: string): ResearchFollowUp | null {
  const text = instruction.trim();
  const takeStrongest = text.match(
    /\b(?:take|keep)\b.{0,40}\b(?:the )?(?:strongest|top)(?: (\d+))?\b/i,
  );
  if (takeStrongest) {
    const count = Number.parseInt(takeStrongest[1] ?? "", 10);
    return { kind: "keep_strongest", count: Number.isFinite(count) && count > 0 ? count : 5 };
  }

  const remove = text.match(/\b(?:remove|drop|delete)\b.{0,20}\b(?:number |#)?(\d+)\b/i);
  if (remove) {
    const index = Number.parseInt(remove[1] ?? "", 10);
    if (Number.isFinite(index) && index > 0) {
      return { kind: "exclude_index", index };
    }
  }

  if (
    /\bwhat did you find\b/i.test(text) ||
    /\bwhat did you find earlier\b/i.test(text) ||
    /\bwhy (?:did you choose )?(?:number |#)?\d+\b/i.test(text)
  ) {
    return { kind: "get_results" };
  }

  return null;
}

/**
 * Live models sometimes create_work + web_research for list edits.
 * Coerce those into refine_research / get_research_results against persisted rows.
 */
export function coerceResearchFollowUpDecision(
  decision: AveryDecision,
  instruction: string,
  research: ResearchFollowUpTarget | null,
): AveryDecision {
  if (!research || research.rowCount < 1) {
    return decision;
  }
  const followUp = detectResearchFollowUp(instruction);
  if (!followUp) {
    return decision;
  }

  if (followUp.kind === "keep_strongest") {
    return {
      ...emptyDecision,
      intent: "workspace_query",
      confidence: Math.max(decision.confidence, 0.9),
      toolCalls: [
        {
          toolId: "refine_research",
          argument: JSON.stringify({
            action: "keep_strongest",
            count: followUp.count,
            artifactId: research.artifactId,
            taskId: research.taskId,
          }),
        },
      ],
      references: {
        taskIds: [research.taskId],
        artifactIds: [research.artifactId],
        approvalIds: [],
      },
      response: `I'll keep the strongest ${followUp.count} from the stored list.`,
    };
  }

  if (followUp.kind === "exclude_index") {
    return {
      ...emptyDecision,
      intent: "workspace_query",
      confidence: Math.max(decision.confidence, 0.9),
      toolCalls: [
        {
          toolId: "refine_research",
          argument: JSON.stringify({
            action: "exclude_index",
            index: followUp.index,
            artifactId: research.artifactId,
            taskId: research.taskId,
          }),
        },
      ],
      references: {
        taskIds: [research.taskId],
        artifactIds: [research.artifactId],
        approvalIds: [],
      },
      response: `I'll remove number ${followUp.index} from the stored list.`,
    };
  }

  return {
    ...emptyDecision,
    intent: "workspace_query",
    confidence: Math.max(decision.confidence, 0.85),
    toolCalls: [
      {
        toolId: "get_research_results",
        argument: JSON.stringify({ artifactId: research.artifactId }),
      },
    ],
    references: {
      taskIds: [research.taskId],
      artifactIds: [research.artifactId],
      approvalIds: [],
    },
    response: decision.response || "I'll answer from the stored research list.",
  };
}
