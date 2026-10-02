import type { ArtifactKind, ToolId } from "../work/constants";

export type PlanStepDraft = {
  title: string;
  detail?: string;
  toolId: ToolId;
};

export type InterpreterContext = {
  employeeName: string;
  roleLabel: string;
  paused: boolean;
  openTaskTitles: string[];
  pendingApprovalCount: number;
  completedTodayCount: number;
};

export type InterpreterResult =
  | {
      kind: "reply";
      body: string;
    }
  | {
      kind: "work";
      title: string;
      acknowledgement: string;
      plan: PlanStepDraft[];
      artifactKind: ArtifactKind;
    }
  | {
      kind: "control";
      action: "pause" | "resume" | "cancel";
      reply: string;
      taskId?: string;
    }
  | {
      kind: "schedule";
      title: string;
      instruction: string;
      cadence: string;
      reply: string;
    };

export type RolePlanner = (
  instruction: string,
  context: InterpreterContext,
) => InterpreterResult;
