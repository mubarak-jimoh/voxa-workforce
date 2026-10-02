import type { InterpreterContext, RolePlanner } from "@/platform/ai/types";

const CONTROL_PAUSE = /\b(pause|stop|hold)\b/i;
const CONTROL_RESUME = /\b(resume|continue|unpause)\b/i;
const CONTROL_CANCEL = /\b(cancel|abandon|drop that)\b/i;
const TODAY = /\b(today|what did you do|summarise|summarize|report)\b/i;
const STATUS = /\b(what are you (doing|working on)|currently working|status)\b/i;
const SCHEDULE = /\b(every|each|weekly|daily|monday|tuesday|wednesday|thursday|friday|schedule)\b/i;
const RESEARCH =
  /\b(find|research|prospect|compan(y|ies)|contact|outreach|draft|competitor|analyse|analyze)\b/i;
const SEND = /\b(send|email them|after i approve)\b/i;

function countFrom(text: string): number | undefined {
  const match = text.match(/\b(\d{1,3})\b/);
  if (!match) {
    return undefined;
  }
  return Number.parseInt(match[1] ?? "", 10);
}

export const interpretLeadHandler: RolePlanner = (instruction, context) => {
  const text = instruction.trim();
  if (!text) {
    return {
      kind: "reply",
      body: "Tell me what you need researched, drafted or scheduled.",
    };
  }

  if (STATUS.test(text)) {
    return {
      kind: "reply",
      body: statusReply(context),
    };
  }

  if (TODAY.test(text) && !RESEARCH.test(text)) {
    return {
      kind: "reply",
      body: todayReply(context),
    };
  }

  if (CONTROL_CANCEL.test(text)) {
    return {
      kind: "control",
      action: "cancel",
      reply: "I'll cancel the current piece of work if one is open.",
    };
  }
  if (CONTROL_PAUSE.test(text) && !SCHEDULE.test(text)) {
    return {
      kind: "control",
      action: "pause",
      reply: "I'll pause the current work.",
    };
  }
  if (CONTROL_RESUME.test(text)) {
    return {
      kind: "control",
      action: "resume",
      reply: "I'll resume paused work if it exists.",
    };
  }

  if (SCHEDULE.test(text) && RESEARCH.test(text)) {
    const cadence = cadenceFrom(text);
    return {
      kind: "schedule",
      title: titleFrom(text, "Recurring research"),
      instruction: text,
      cadence,
      reply: `I've saved that as a schedule (${cadence}). It will not run by itself yet — there is no live background scheduler.`,
    };
  }

  if (SEND.test(text) && !RESEARCH.test(text)) {
    return {
      kind: "work",
      title: "Prepare outbound send",
      acknowledgement:
        "I'll check whether there is anything real to send. I will not send email without a connection and your approval.",
      plan: [
        {
          title: "Note existing drafts",
          detail: "Only real artifacts can be proposed for send.",
          toolId: "record_brief",
        },
        {
          title: "Request approval to send",
          detail: "External sends always require approval.",
          toolId: "send_email",
        },
      ],
      artifactKind: "draft",
    };
  }

  if (RESEARCH.test(text)) {
    const count = countFrom(text);
    const title = titleFrom(text, "Research");
    return {
      kind: "work",
      title,
      acknowledgement: acknowledgementForResearch(count),
      plan: [
        {
          title: "Capture the brief",
          detail: text,
          toolId: "record_brief",
        },
        {
          title: count
            ? `Search for ${count} suitable companies`
            : "Search for suitable companies",
          toolId: "web_research",
        },
        {
          title: "Verify relevance",
          toolId: "web_research",
        },
        {
          title: "Find decision-makers and contacts",
          toolId: "find_contacts",
        },
        {
          title: "Produce the list",
          toolId: "record_brief",
        },
      ],
      artifactKind: "list",
    };
  }

  return {
    kind: "work",
    title: titleFrom(text, "Requested work"),
    acknowledgement:
      "I'll capture this as work. If a tool is missing, I'll say so rather than inventing a result.",
    plan: [
      {
        title: "Capture the brief",
        detail: text,
        toolId: "record_brief",
      },
    ],
    artifactKind: "note",
  };
};

function titleFrom(text: string, fallback: string): string {
  const compact = text.replace(/\s+/g, " ").trim();
  if (compact.length <= 72) {
    return compact.replace(/[.?]$/, "") || fallback;
  }
  return `${compact.slice(0, 69).trim()}…`;
}

function cadenceFrom(text: string): string {
  if (/monday/i.test(text)) {
    return "Every Monday";
  }
  if (/daily|every day/i.test(text)) {
    return "Daily";
  }
  if (/week/i.test(text)) {
    return "Weekly";
  }
  return "Recurring";
}

function acknowledgementForResearch(count?: number): string {
  if (count) {
    return `I'll research ${count} companies, verify each one and return a qualified list. I'll flag anything I cannot actually look up.`;
  }
  return "I'll research suitable companies, verify each one and return a qualified list. I'll flag anything I cannot actually look up.";
}

function statusReply(context: InterpreterContext): string {
  if (context.paused) {
    return `${context.employeeName} is paused and will not take new work.`;
  }
  if (context.openTaskTitles.length > 0) {
    return `I'm currently on: ${context.openTaskTitles.slice(0, 3).join("; ")}.`;
  }
  if (context.pendingApprovalCount > 0) {
    return `Nothing is running. ${context.pendingApprovalCount} item${context.pendingApprovalCount === 1 ? "" : "s"} waiting for approval.`;
  }
  return "I'm ready. Tell me what you need and I'll turn it into work.";
}

function todayReply(context: InterpreterContext): string {
  return `Today I've completed ${context.completedTodayCount} task${context.completedTodayCount === 1 ? "" : "s"}. ${context.pendingApprovalCount} waiting for approval.`;
}

export const leadHandlerSuggestedPrompts = [
  {
    label: "Find potential customers",
    instruction: "Find 30 commercial cleaning companies in London",
  },
  {
    label: "Research a company",
    instruction: "Research a specific company and find the best contact",
  },
  {
    label: "Prepare outreach",
    instruction: "Draft outreach for the last research brief",
  },
  {
    label: "Analyse competitors",
    instruction: "Analyse competitors in our market and summarise what you find",
  },
  {
    label: "Plan recurring work",
    instruction: "Every Monday find 20 new prospects",
  },
] as const;

export const interpretUnknownRole: RolePlanner = (instruction) => ({
  kind: "work",
  title: instruction.slice(0, 72) || "Requested work",
  acknowledgement:
    "I'll capture this as work. Missing tools will be recorded honestly.",
  plan: [
    {
      title: "Capture the brief",
      detail: instruction,
      toolId: "record_brief",
    },
  ],
  artifactKind: "note",
});
