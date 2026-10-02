import { z } from "zod";
import { ARTIFACT_KINDS, TOOL_IDS } from "../work/constants";

export const AVERY_INTENTS = [
  "conversation",
  "answer",
  "workspace_query",
  "create_work",
  "control_work",
  "schedule_work",
  "clarify",
] as const;
export type AveryIntent = (typeof AVERY_INTENTS)[number];

export const INTERNAL_TOOL_IDS = [
  "get_employee_status",
  "get_today_summary",
  "list_tasks",
  "get_task",
  "list_approvals",
  "list_activity",
  "list_schedules",
  "list_artifacts",
  "get_research_results",
  "refine_research",
  "get_work_queue",
] as const;
export type InternalToolId = (typeof INTERNAL_TOOL_IDS)[number];

const planStepSchema = z.object({
  title: z.string().trim().min(1).max(160),
  detail: z.string().max(2000).nullable(),
  toolId: z.enum(TOOL_IDS),
});

export const averyDecisionSchema = z.object({
  intent: z.enum(AVERY_INTENTS),
  response: z.string().trim().min(1).max(8000),
  confidence: z.number().min(0).max(1),
  toolCalls: z
    .array(
      z.object({
        toolId: z.string().min(1).max(64),
        argument: z.string().max(4000),
      }),
    )
    .max(4),
  work: z
    .object({
      title: z.string().trim().min(1).max(120),
      artifactKind: z.enum(ARTIFACT_KINDS),
      plan: z.array(planStepSchema).min(1).max(8),
    })
    .nullable(),
  control: z
    .object({
      action: z.enum(["pause", "resume", "cancel"]),
      taskId: z.string().max(64).nullable(),
      taskHint: z.string().max(200).nullable(),
    })
    .nullable(),
  schedule: z
    .object({
      title: z.string().trim().min(1).max(120),
      instruction: z.string().trim().min(1).max(2000),
      cadence: z.string().trim().min(1).max(80),
    })
    .nullable(),
  references: z
    .object({
      taskIds: z.array(z.string().max(64)).max(8),
      artifactIds: z.array(z.string().max(64)).max(8),
      approvalIds: z.array(z.string().max(64)).max(8),
    })
    .nullable(),
});

export type AveryDecision = z.infer<typeof averyDecisionSchema>;

export const emptyDecision = {
  toolCalls: [] as AveryDecision["toolCalls"],
  work: null,
  control: null,
  schedule: null,
  references: null,
  confidence: 0.5,
};

/** OpenAI strict JSON schema — all fields required, additionalProperties false. */
export const AVERY_DECISION_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "intent",
    "response",
    "confidence",
    "toolCalls",
    "work",
    "control",
    "schedule",
    "references",
  ],
  properties: {
    intent: { type: "string", enum: [...AVERY_INTENTS] },
    response: { type: "string" },
    confidence: { type: "number" },
    toolCalls: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["toolId", "argument"],
        properties: {
          toolId: { type: "string" },
          argument: { type: "string" },
        },
      },
    },
    work: {
      anyOf: [
        { type: "null" },
        {
          type: "object",
          additionalProperties: false,
          required: ["title", "artifactKind", "plan"],
          properties: {
            title: { type: "string" },
            artifactKind: { type: "string", enum: [...ARTIFACT_KINDS] },
            plan: {
              type: "array",
              items: {
                type: "object",
                additionalProperties: false,
                required: ["title", "detail", "toolId"],
                properties: {
                  title: { type: "string" },
                  detail: { type: "string" },
                  toolId: { type: "string", enum: [...TOOL_IDS] },
                },
              },
            },
          },
        },
      ],
    },
    control: {
      anyOf: [
        { type: "null" },
        {
          type: "object",
          additionalProperties: false,
          required: ["action", "taskId", "taskHint"],
          properties: {
            action: { type: "string", enum: ["pause", "resume", "cancel"] },
            taskId: { anyOf: [{ type: "string" }, { type: "null" }] },
            taskHint: { anyOf: [{ type: "string" }, { type: "null" }] },
          },
        },
      ],
    },
    schedule: {
      anyOf: [
        { type: "null" },
        {
          type: "object",
          additionalProperties: false,
          required: ["title", "instruction", "cadence"],
          properties: {
            title: { type: "string" },
            instruction: { type: "string" },
            cadence: { type: "string" },
          },
        },
      ],
    },
    references: {
      anyOf: [
        { type: "null" },
        {
          type: "object",
          additionalProperties: false,
          required: ["taskIds", "artifactIds", "approvalIds"],
          properties: {
            taskIds: { type: "array", items: { type: "string" } },
            artifactIds: { type: "array", items: { type: "string" } },
            approvalIds: { type: "array", items: { type: "string" } },
          },
        },
      ],
    },
  },
} as const;
