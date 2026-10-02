import {
  interpretLeadHandler,
  interpretUnknownRole,
  leadHandlerSuggestedPrompts,
} from "./lead-handler/planner";
import { averySystemPrompt } from "./lead-handler/prompt";
import { getRoleLabel, getRoleSummary } from "./catalog";
import type { RolePlanner } from "@/platform/ai/types";

export function plannerForRole(roleType: string): RolePlanner {
  if (roleType === "lead_handler") {
    return interpretLeadHandler;
  }
  return interpretUnknownRole;
}

export function suggestedPromptsForRole(roleType: string) {
  if (roleType === "lead_handler") {
    return leadHandlerSuggestedPrompts;
  }
  return [] as const;
}

export function systemPromptForRole(input: {
  roleType: string;
  employeeName: string;
  organisationName: string;
}): string {
  return averySystemPrompt({
    employeeName: input.employeeName,
    roleLabel: getRoleLabel(input.roleType),
    roleSummary: getRoleSummary(input.roleType),
    organisationName: input.organisationName,
  });
}

export { getRoleLabel, getRoleSummary } from "./catalog";
