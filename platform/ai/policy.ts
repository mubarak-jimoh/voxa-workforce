import type { ToolId } from "../work/constants";
import { TOOL_IDS } from "../work/constants";
import type { AveryDecision } from "./schema";

const WORK_ASSIGNMENT =
  /\b(find|look up|search for|prospect|prepare a brief|create a (task|brief)|write (up |me )?(a )?brief|draft (emails?|outreach)|set up (the )?work|capture (this|a brief))\b/i;

const ADVICE_REQUEST =
  /^(help me (think|improve|work through|figure|brainstorm|refine)|what do you think|explain|how (should|would|do|can) (i|we)|talk me through|walk me through|give me (your )?(take|opinion))/i;

const TASKY_RESPONSE =
  /\b(creating a task|i('ll| will) (capture|create|set up) (a |this )?task|i('ve| have) (created|set up) (a )?task)\b/i;

function isToolId(value: string): value is ToolId {
  return (TOOL_IDS as readonly string[]).includes(value);
}

export function isWorkAssignment(instruction: string): boolean {
  const text = instruction.trim();
  if (WORK_ASSIGNMENT.test(text)) {
    return true;
  }
  if (/^(research|find)\b/i.test(text)) {
    return true;
  }
  return /\bresearch\s+\d+/i.test(text);
}

export function isAdviceRequest(instruction: string): boolean {
  return ADVICE_REQUEST.test(instruction.trim());
}

export function coercePlanToolId(
  title: string,
  detail: string | null | undefined,
  current: string,
): ToolId {
  const fallback: ToolId = isToolId(current) ? current : "record_brief";
  const heading = title.trim();

  if (/^(capture|record|note)\b/i.test(heading) || /\bbrief\b/i.test(heading) && /capture|record/i.test(heading)) {
    return "record_brief";
  }

  if (/\bsend\b/i.test(heading) && /\bemail\b/i.test(heading)) {
    return "send_email";
  }
  if (/\b(contact|decision.?maker|linkedin)\b/i.test(heading)) {
    return "find_contacts";
  }
  if (/\b(draft|outreach)\b/i.test(heading) && !/\bresearch\b/i.test(heading)) {
    return "draft_outreach";
  }
  if (/\b(research|search|find|competitor|lookup|prospect|compan)/i.test(heading)) {
    return "web_research";
  }

  if (fallback === "record_brief" && /\b(analy[sz]e|develop|usp|revised offer|unique selling)\b/i.test(`${heading} ${detail ?? ""}`)) {
    return "web_research";
  }

  return fallback;
}

export function isCapturableBriefStep(title: string): boolean {
  return /^(capture|record|note)\b/i.test(title.trim()) || /\bcaptured brief\b/i.test(title);
}

function rewriteTaskyResponse(response: string, instruction: string): string {
  if (!TASKY_RESPONSE.test(response)) {
    return response;
  }
  if (/\boffer\b/i.test(instruction)) {
    return "Let's tighten the offer. Who is it for, what outcome do you promise, and what proof do you have?";
  }
  return "I can think that through with you. What constraint matters most?";
}

export function normaliseAveryDecision(
  decision: AveryDecision,
  instruction: string,
): AveryDecision {
  const work =
    decision.intent === "create_work" && decision.work
      ? {
          ...decision.work,
          plan: decision.work.plan.map((step) => ({
            ...step,
            toolId: coercePlanToolId(step.title, step.detail, step.toolId),
          })),
        }
      : null;

  if (
    decision.intent === "create_work" &&
    isAdviceRequest(instruction) &&
    !isWorkAssignment(instruction)
  ) {
    return {
      ...decision,
      intent: "conversation",
      work: null,
      control: null,
      schedule: null,
      toolCalls: [],
      response: rewriteTaskyResponse(decision.response, instruction),
    };
  }

  return {
    ...decision,
    work,
    control: decision.intent === "control_work" ? decision.control : null,
    schedule: decision.intent === "schedule_work" ? decision.schedule : null,
  };
}
