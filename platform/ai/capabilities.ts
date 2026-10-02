import { isWebResearchAvailable } from "../research/provider";

export type CapabilityStatus = "available" | "not_connected";
export type CapabilityRisk = "none" | "low" | "high";
export type ApprovalPolicy = "none" | "required";

export type Capability = {
  id: string;
  description: string;
  status: CapabilityStatus;
  risk: CapabilityRisk;
  approval: ApprovalPolicy;
  kind: "internal" | "execution";
};

export const CAPABILITIES: readonly Capability[] = [
  {
    id: "conversation",
    description: "Talk, answer questions and think through work with the user.",
    status: "available",
    risk: "none",
    approval: "none",
    kind: "internal",
  },
  {
    id: "workspace_query",
    description: "Read this organisation's employee status, tasks, activity, approvals and schedules.",
    status: "available",
    risk: "none",
    approval: "none",
    kind: "internal",
  },
  {
    id: "create_work",
    description: "Turn an assignment into a persisted task with a plan.",
    status: "available",
    risk: "low",
    approval: "none",
    kind: "internal",
  },
  {
    id: "control_work",
    description: "Pause, resume or cancel an existing task.",
    status: "available",
    risk: "low",
    approval: "none",
    kind: "internal",
  },
  {
    id: "record_brief",
    description: "Capture a brief or note as an artifact.",
    status: "available",
    risk: "none",
    approval: "none",
    kind: "execution",
  },
  {
    id: "web_research",
    description: "Look up companies and facts on the public web.",
    status: "not_connected",
    risk: "low",
    approval: "none",
    kind: "execution",
  },
  {
    id: "find_contacts",
    description: "Find decision-makers and contact details.",
    status: "not_connected",
    risk: "low",
    approval: "none",
    kind: "execution",
  },
  {
    id: "draft_outreach",
    description: "Draft outreach from a real prospect list.",
    status: "not_connected",
    risk: "low",
    approval: "none",
    kind: "execution",
  },
  {
    id: "send_email",
    description: "Send email. Always requires user approval and a mail connection.",
    status: "not_connected",
    risk: "high",
    approval: "required",
    kind: "execution",
  },
  {
    id: "live_scheduler",
    description: "Run saved schedules automatically in the background.",
    status: "not_connected",
    risk: "low",
    approval: "none",
    kind: "internal",
  },
  {
    id: "attachments",
    description: "Accept file attachments in the composer.",
    status: "not_connected",
    risk: "low",
    approval: "none",
    kind: "internal",
  },
  {
    id: "voice",
    description: "Voice input in the composer.",
    status: "not_connected",
    risk: "none",
    approval: "none",
    kind: "internal",
  },
] as const;

export function capabilityById(id: string): Capability | undefined {
  return CAPABILITIES.find((item) => item.id === id);
}

export function capabilityStatus(id: string): CapabilityStatus {
  if (id === "web_research") {
    return isWebResearchAvailable() ? "available" : "not_connected";
  }
  return capabilityById(id)?.status ?? "not_connected";
}

export function isCapabilityAvailable(id: string): boolean {
  return capabilityStatus(id) === "available";
}

export function capabilitiesForPrompt(): string {
  return CAPABILITIES.map(
    (item) =>
      `- ${item.id}: ${capabilityStatus(item.id) === "available" ? "AVAILABLE" : "NOT CONNECTED"} — ${item.description}`,
  ).join("\n");
}
