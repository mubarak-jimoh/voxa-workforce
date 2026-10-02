import type { ModelAdapter, ModelCompletion, ModelRequest } from "./adapter";
import { emptyDecision, type AveryDecision } from "./schema";
import { ARTIFACT_KINDS, TOOL_IDS } from "../work/constants";
import { parsePriority } from "../work/priority";
import { isWebResearchAvailable } from "../research/provider";
import { parseDeadline } from "../work/deadline";

type OpenTask = { id: string; title: string; status: string };
type ResearchRow = {
  n?: number;
  name?: string;
  location?: string | null;
  whyMatch?: string;
  verification?: string;
  sources?: { url: string; title: string }[];
};

function parseWorkspace(messages: ModelRequest["messages"]): {
  openTasks: OpenTask[];
  pendingApprovals: number;
  activity: string[];
  paused: boolean;
  employeeName: string;
  researchRows: ResearchRow[];
  researchArtifactId: string | null;
  lastTaskId: string | null;
} {
  const stateMessage = messages.find((item) =>
    item.content.includes("<workspace_state>"),
  );
  if (!stateMessage) {
    return {
      openTasks: [],
      pendingApprovals: 0,
      activity: [],
      paused: false,
      employeeName: "Avery",
      researchRows: [],
      researchArtifactId: null,
      lastTaskId: null,
    };
  }
  const match = stateMessage.content.match(/<workspace_state>([\s\S]*?)<\/workspace_state>/);
  if (!match?.[1]) {
    return {
      openTasks: [],
      pendingApprovals: 0,
      activity: [],
      paused: false,
      employeeName: "Avery",
      researchRows: [],
      researchArtifactId: null,
      lastTaskId: null,
    };
  }
  try {
    const parsed = JSON.parse(match[1]) as {
      employee?: { name?: string; paused?: boolean };
      openTasks?: OpenTask[];
      pendingApprovals?: { title: string }[];
      recentActivity?: string[];
      artifacts?: Array<{
        id: string;
        kind?: string;
        taskId?: string | null;
        rows?: ResearchRow[];
      }>;
    };
    const research = parsed.artifacts?.find((item) => item.rows && item.rows.length > 0);
    return {
      openTasks: parsed.openTasks ?? [],
      pendingApprovals: parsed.pendingApprovals?.length ?? 0,
      activity: parsed.recentActivity ?? [],
      paused: Boolean(parsed.employee?.paused),
      employeeName: parsed.employee?.name ?? "Avery",
      researchRows: research?.rows ?? [],
      researchArtifactId: research?.id ?? null,
      lastTaskId: research?.taskId ?? parsed.openTasks?.[0]?.id ?? null,
    };
  } catch {
    return {
      openTasks: [],
      pendingApprovals: 0,
      activity: [],
      paused: false,
      employeeName: "Avery",
      researchRows: [],
      researchArtifactId: null,
      lastTaskId: null,
    };
  }
}

function currentInstruction(messages: ModelRequest["messages"]): string {
  const users = messages.filter((item) => item.role === "user");
  const last = users[users.length - 1]?.content ?? "";
  const original = last.match(/^Original user message:\n([\s\S]+?)\n\nUsing only the workspace data/i);
  if (original?.[1]) {
    return original[1].trim();
  }
  return last;
}

function historyUserText(messages: ModelRequest["messages"]): string {
  return messages
    .filter((item) => item.role === "user")
    .slice(0, -1)
    .map((item) => item.content)
    .join(" ");
}

function toolData(messages: ModelRequest["messages"]): string {
  return messages
    .filter((item) => item.content.includes("<untrusted_tool_data"))
    .map((item) => item.content)
    .join("\n");
}

const GREETING =
  /^(morning|hi|hello|hey|good (morning|afternoon|evening))([,.!\s]+[A-Za-z]+)?[.!?]?$/i;
const QUESTION_START = /^(what|why|how|who|when|where|which|explain|help me|can you explain)\b/i;
const STATUS =
  /\b(what are you (doing|working on)|currently working|what can you help|what do you do)\b/i;
const TODAY = /\b(today|what did you (do|get done)|summarise|summarize|what happened)\b/i;
const APPROVALS = /\b(approval|waiting on me|need from me)\b/i;
const CONTROL_PAUSE = /\b(pause|stop|hold)\b/i;
const CONTROL_RESUME = /\b(resume|continue|unpause)\b/i;
const CONTROL_CANCEL = /\b(cancel|abandon|drop that)\b/i;
const SCHEDULE =
  /\b(every|each|weekly|daily|monday|tuesday|wednesday|thursday|friday|tomorrow at|weekday)\b/i;
const RESEARCH =
  /\b(find|research|prospect|compan(y|ies)|contact|outreach|draft|competitor|analyse|analyze)\b/i;
const SEND = /\b(send|email them|after i approve)\b/i;
const FOLLOW_UP = /^(actually|only ones|what about|make that|focus on|instead)\b/i;
const WORK_ASSIGN =
  /\b(prepare|create|write|build|put together|set up|capture|brief)\b/i;

function cadenceFrom(text: string): string {
  if (/weekday/i.test(text)) {
    return "Every weekday morning";
  }
  if (/tomorrow/i.test(text) && /\b\d{1,2}/.test(text)) {
    return "Tomorrow at the requested time";
  }
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

function titleFrom(text: string, fallback: string): string {
  const compact = text.replace(/\s+/g, " ").trim();
  if (compact.length <= 72) {
    return compact.replace(/[.?]$/, "") || fallback;
  }
  return `${compact.slice(0, 69).trim()}…`;
}

function countFrom(text: string): number | undefined {
  const match = text.match(/\b(\d{1,3})\b/);
  if (!match) {
    return undefined;
  }
  return Number.parseInt(match[1] ?? "", 10);
}

function researchPlan(text: string): AveryDecision["work"] {
  const count = countFrom(text);
  return {
    title: titleFrom(text, "Research"),
    artifactKind: "list",
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
        detail: text,
        toolId: "web_research",
      },
      {
        title: "Verify relevance",
        detail: "",
        toolId: "web_research",
      },
      {
        title: "Find decision-makers and contacts",
        detail: "",
        toolId: "find_contacts",
      },
      {
        title: "Produce the list",
        detail: "",
        toolId: "record_brief",
      },
    ],
  };
}

function sendPlan(): AveryDecision["work"] {
  return {
    title: "Prepare outbound send",
    artifactKind: "draft",
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
  };
}

function briefPlan(text: string): AveryDecision["work"] {
  return {
    title: titleFrom(text, "Requested work"),
    artifactKind: ARTIFACT_KINDS.includes("brief" as never) ? "brief" : "note",
    plan: [
      {
        title: "Capture the brief",
        detail: text,
        toolId: TOOL_IDS[0],
      },
    ],
  };
}

function decide(request: ModelRequest): AveryDecision {
  const text = currentInstruction(request.messages).trim();
  const prior = historyUserText(request.messages);
  const tools = toolData(request.messages);
  const workspace = parseWorkspace(request.messages);

  if (tools) {
    return groundFromTools(text, tools, workspace);
  }

  if (workspace.researchRows.length > 0 && /another \d|another five|not already|aren't already/i.test(text)) {
    return {
      ...emptyDecision,
      intent: "create_work",
      confidence: 0.85,
      work: researchPlan(text),
      response: isWebResearchAvailable()
        ? "I'll research another set and skip companies already on the list."
        : "I can set that up, but web research isn't connected yet.",
    };
  }

  if (!text) {
    return {
      ...emptyDecision,
      intent: "conversation",
      confidence: 1,
      response: "Tell me what you need.",
    };
  }

  if (GREETING.test(text)) {
    const hello = /good afternoon/i.test(text)
      ? "Afternoon"
      : /good evening/i.test(text)
        ? "Evening"
        : /morning/i.test(text)
          ? "Morning"
          : "Hello";
    return {
      ...emptyDecision,
      intent: "conversation",
      confidence: 0.9,
      response: `${hello}. What are we working on?`,
    };
  }

  if (STATUS.test(text) && /help|do you do/i.test(text)) {
    return {
      ...emptyDecision,
      intent: "answer",
      confidence: 0.9,
      response:
        isWebResearchAvailable()
          ? "I handle prospect research, qualification and outreach preparation. I can talk through an offer, capture briefs, and turn assignments into work. Web research is connected. Contact finding and email sending aren't — I won't invent those results."
          : "I handle prospect research, qualification and outreach preparation. I can talk through an offer, capture briefs, and turn assignments into work. Web research, contact finding and email sending aren't connected yet — I won't invent those results.",
    };
  }

  if (APPROVALS.test(text) && !RESEARCH.test(text)) {
    return {
      ...emptyDecision,
      intent: "workspace_query",
      confidence: 0.9,
      toolCalls: [{ toolId: "list_approvals", argument: "{}" }],
      response:
        workspace.pendingApprovals > 0
          ? `${workspace.pendingApprovals} item${workspace.pendingApprovals === 1 ? "" : "s"} waiting for your approval.`
          : "Nothing is waiting for your approval.",
    };
  }

  if (TODAY.test(text) && !RESEARCH.test(text)) {
    const activityLine = workspace.activity[0]
      ? ` Most recently: ${workspace.activity[0]}`
      : "";
    return {
      ...emptyDecision,
      intent: "workspace_query",
      confidence: 0.9,
      toolCalls: [
        { toolId: "get_today_summary", argument: "{}" },
        { toolId: "list_activity", argument: "{}" },
      ],
      response: `I'll answer from the work log.${activityLine}`,
    };
  }

  if (STATUS.test(text) || /working on\b/i.test(text) || /\bwhat are you doing\b/i.test(text)) {
    const titles = workspace.openTasks.map((task) => task.title);
    const after = /\bafter that\b|next|queued|up next/i.test(text);
    return {
      ...emptyDecision,
      intent: "workspace_query",
      confidence: 0.9,
      toolCalls: [
        { toolId: "get_employee_status", argument: "{}" },
        { toolId: "get_work_queue", argument: "{}" },
      ],
      response:
        titles.length > 0
          ? after && titles.length > 1
            ? `I'm on ${titles[0]}. After that: ${titles.slice(1, 3).join("; ")}.`
            : `I'm currently on: ${titles.slice(0, 3).join("; ")}.`
          : workspace.paused
            ? `${workspace.employeeName} is paused and will not take new work.`
            : "Nothing is running. I'm ready when you are.",
    };
  }

  if (/\b(what's due|what is due|due today|finished|have you finished|did you finish)\b/i.test(text)) {
    return {
      ...emptyDecision,
      intent: "workspace_query",
      confidence: 0.9,
      toolCalls: [
        { toolId: "get_work_queue", argument: "{}" },
        { toolId: "get_today_summary", argument: "{}" },
      ],
      response: "I'll answer from the work queue and today's log.",
    };
  }

  if (/\bwaiting on me|need from me|what are you waiting\b/i.test(text)) {
    return {
      ...emptyDecision,
      intent: "workspace_query",
      confidence: 0.9,
      toolCalls: [{ toolId: "list_approvals", argument: "{}" }],
      response:
        workspace.pendingApprovals > 0
          ? `${workspace.pendingApprovals} item${workspace.pendingApprovals === 1 ? "" : "s"} waiting for your approval.`
          : "Nothing is waiting for your approval.",
    };
  }

  if (CONTROL_CANCEL.test(text) || CONTROL_PAUSE.test(text) || CONTROL_RESUME.test(text)) {
    const action = CONTROL_CANCEL.test(text)
      ? "cancel"
      : CONTROL_RESUME.test(text)
        ? "resume"
        : "pause";
    const controlPool =
      action === "resume"
        ? workspace.openTasks.filter((task) => task.status === "paused")
        : workspace.openTasks;
    if (
      controlPool.length > 1 &&
      /^(pause|stop|cancel|resume)( that| this| it)?[.!?]?$/i.test(text)
    ) {
      const titles = controlPool.map((task) => task.title);
      return {
        ...emptyDecision,
        intent: "clarify",
        confidence: 0.7,
        response:
          titles.length === 2
            ? `Which task — ${titles[0]} or ${titles[1]}?`
            : `Which task should I change — ${titles.join("; ")}?`,
      };
    }
    const hint =
      text
        .replace(/\b(pause|stop|hold|resume|continue|unpause|cancel|abandon|drop that|the|that|this|work|task)\b/gi, " ")
        .replace(/\s+/g, " ")
        .trim() || null;
    return {
      ...emptyDecision,
      intent: "control_work",
      confidence: 0.8,
      control: {
        action,
        taskId: null,
        taskHint: hint,
      },
      response:
        action === "cancel"
          ? "I'll cancel that work."
          : action === "resume"
            ? "I'll resume it."
            : "I'll pause that work.",
    };
  }

  if (SCHEDULE.test(text) && (RESEARCH.test(text) || WORK_ASSIGN.test(text) || /do this|run this|do it/i.test(text))) {
    const cadence = cadenceFrom(text);
    return {
      ...emptyDecision,
      intent: "schedule_work",
      confidence: 0.85,
      schedule: {
        title: titleFrom(text, "Recurring work"),
        instruction: text,
        cadence,
      },
      response: `I've saved that as a schedule (${cadence}). It will not run by itself yet — there is no live background scheduler.`,
    };
  }

  if (FOLLOW_UP.test(text) && RESEARCH.test(prior)) {
    const combined = `${prior}. ${text}`.slice(0, 500);
    return {
      ...emptyDecision,
      intent: "create_work",
      confidence: 0.8,
      work: researchPlan(combined),
      response:
        "I'll update the brief. Web research isn't connected yet, so I won't invent a list.",
    };
  }

  if (SEND.test(text) && !RESEARCH.test(text)) {
    return {
      ...emptyDecision,
      intent: "create_work",
      confidence: 0.85,
      work: sendPlan(),
      response:
        "I'll check whether there is anything real to send. I will not send email without a connection and your approval.",
    };
  }

  if (
    workspace.researchRows.length > 0 &&
    /\b(what did you find|found earlier|earlier research|those (companies|results|prospects))\b/i.test(
      text,
    )
  ) {
    const named = workspace.researchRows
      .slice(0, 8)
      .map((row, index) => `${row.n ?? index + 1}. ${row.name}`)
      .join(" ");
    return {
      ...emptyDecision,
      intent: "workspace_query",
      confidence: 0.9,
      toolCalls: [
        {
          toolId: "get_research_results",
          argument: JSON.stringify({ artifactId: workspace.researchArtifactId }),
        },
      ],
      references: {
        taskIds: workspace.lastTaskId ? [workspace.lastTaskId] : [],
        artifactIds: workspace.researchArtifactId ? [workspace.researchArtifactId] : [],
        approvalIds: [],
      },
      response: named
        ? `From the stored research: ${named}`
        : "I'll answer from the stored research list.",
    };
  }

  const takeStrongest = text.match(
    /\b(?:take|keep)\b.{0,40}\b(?:the )?(?:strongest|top)(?: (\d+))?\b/i,
  );
  if (workspace.researchRows.length > 0 && takeStrongest) {
    const count = Number.parseInt(takeStrongest[1] ?? "", 10) || countFrom(text) || 5;
    return {
      ...emptyDecision,
      intent: "workspace_query",
      confidence: 0.9,
      toolCalls: [
        {
          toolId: "refine_research",
          argument: JSON.stringify({
            action: "keep_strongest",
            count,
            artifactId: workspace.researchArtifactId,
            taskId: workspace.lastTaskId,
          }),
        },
      ],
      references: {
        taskIds: workspace.lastTaskId ? [workspace.lastTaskId] : [],
        artifactIds: workspace.researchArtifactId ? [workspace.researchArtifactId] : [],
        approvalIds: [],
      },
      response: `I'll keep the strongest ${count} from the stored list.`,
    };
  }

  const whyNumber = text.match(/\bwhy (?:did you choose )?(?:number |#)?(\d+)\b/i);
  if (workspace.researchRows.length > 0 && whyNumber) {
    const index = Number.parseInt(whyNumber[1] ?? "", 10);
    const row =
      workspace.researchRows.find((item) => item.n === index) ??
      workspace.researchRows[index - 1];
    return {
      ...emptyDecision,
      intent: "workspace_query",
      confidence: 0.9,
      toolCalls: [
        {
          toolId: "get_research_results",
          argument: JSON.stringify({ artifactId: workspace.researchArtifactId }),
        },
      ],
      references: {
        taskIds: workspace.lastTaskId ? [workspace.lastTaskId] : [],
        artifactIds: workspace.researchArtifactId ? [workspace.researchArtifactId] : [],
        approvalIds: [],
      },
      response: row
        ? `${row.name} is on the stored list because ${row.whyMatch}${row.sources?.[0] ? ` Source: ${row.sources[0].url}` : ""}`
        : "That number is not on the stored research list.",
    };
  }

  if (workspace.researchRows.length > 0 && /which \d|why those|look strongest/i.test(text)) {
    const top = workspace.researchRows
      .filter((row) => row.verification === "verified" || !row.verification)
      .slice(0, 3);
    const named = (top.length > 0 ? top : workspace.researchRows.slice(0, 3))
      .map((row, index) => `${row.n ?? index + 1}. ${row.name}${row.whyMatch ? ` — ${row.whyMatch}` : ""}`)
      .join(" ");
    return {
      ...emptyDecision,
      intent: "workspace_query",
      confidence: 0.9,
      toolCalls: [
        {
          toolId: "get_research_results",
          argument: JSON.stringify({ artifactId: workspace.researchArtifactId }),
        },
      ],
      references: {
        taskIds: workspace.lastTaskId ? [workspace.lastTaskId] : [],
        artifactIds: workspace.researchArtifactId ? [workspace.researchArtifactId] : [],
        approvalIds: [],
      },
      response: named
        ? `These look strongest from the persisted list: ${named}`
        : "I'll answer from the research list.",
    };
  }

  if (workspace.researchRows.length > 0 && /\b(source|sources|where did you|what did you use)\b/i.test(text)) {
    const sources = workspace.researchRows
      .flatMap((row) => row.sources ?? [])
      .slice(0, 6)
      .map((item) => item.url)
      .join(" ");
    return {
      ...emptyDecision,
      intent: "workspace_query",
      confidence: 0.9,
      toolCalls: [
        {
          toolId: "get_research_results",
          argument: JSON.stringify({ artifactId: workspace.researchArtifactId }),
        },
      ],
      references: {
        taskIds: workspace.lastTaskId ? [workspace.lastTaskId] : [],
        artifactIds: workspace.researchArtifactId ? [workspace.researchArtifactId] : [],
        approvalIds: [],
      },
      response: sources
        ? `I used these sources from the stored research: ${sources}`
        : "I'll list the sources on the stored research artifact.",
    };
  }

  if (workspace.researchRows.length > 0 && /\bremove number (\d+)\b/i.test(text)) {
    const index = Number.parseInt(text.match(/\bremove number (\d+)\b/i)?.[1] ?? "", 10);
    return {
      ...emptyDecision,
      intent: "workspace_query",
      confidence: 0.85,
      toolCalls: [
        {
          toolId: "refine_research",
          argument: JSON.stringify({
            action: "exclude_index",
            index,
            artifactId: workspace.researchArtifactId,
            taskId: workspace.lastTaskId,
          }),
        },
      ],
      references: {
        taskIds: workspace.lastTaskId ? [workspace.lastTaskId] : [],
        artifactIds: workspace.researchArtifactId ? [workspace.researchArtifactId] : [],
        approvalIds: [],
      },
      response: `I'll remove number ${index} from the list and keep the earlier results.`,
    };
  }

  if (workspace.researchRows.length > 0 && /\bonly (keep|show|ones).+\b/i.test(text)) {
    const location = text.match(/\bin ([A-Za-z ]+?)\.?$/i)?.[1] ?? text.match(/ones in ([A-Za-z ]+)/i)?.[1];
    return {
      ...emptyDecision,
      intent: "workspace_query",
      confidence: 0.85,
      toolCalls: [
        {
          toolId: "refine_research",
          argument: JSON.stringify({
            action: "keep_location",
            location: location?.trim(),
            artifactId: workspace.researchArtifactId,
            taskId: workspace.lastTaskId,
          }),
        },
      ],
      references: {
        taskIds: workspace.lastTaskId ? [workspace.lastTaskId] : [],
        artifactIds: workspace.researchArtifactId ? [workspace.researchArtifactId] : [],
        approvalIds: [],
      },
      response: location
        ? `I'll keep only the companies that match ${location.trim()} from the stored list.`
        : "I'll filter the stored list.",
    };
  }

  if (RESEARCH.test(text) && !QUESTION_START.test(text)) {
    const count = countFrom(text);
    const connected = isWebResearchAvailable();
    const deadline = parseDeadline(text);
    const priority = parsePriority(text);
    const deadlineBit = deadline
      ? ` I'll aim to have results ready ${deadline.label}.`
      : "";
    const priorityBit =
      priority === "urgent"
        ? " I'll treat this as urgent."
        : priority === "high"
          ? " I'll prioritise this."
          : "";
    return {
      ...emptyDecision,
      intent: "create_work",
      confidence: 0.9,
      work: researchPlan(text),
      response: connected
        ? `I'm on it. I'll research suitable companies and verify the strongest matches.${deadlineBit}${priorityBit}`
        : count
          ? `I can set that work up, but web research isn't connected yet. I'll capture a brief for ${count} companies rather than inventing a list.`
          : "I can set that work up, but web research isn't connected yet. I'll capture the brief rather than inventing results.",
    };
  }

  if (QUESTION_START.test(text) || text.endsWith("?")) {
    return {
      ...emptyDecision,
      intent: "answer",
      confidence: 0.75,
      response: answerFor(text),
    };
  }

  if (WORK_ASSIGN.test(text)) {
    return {
      ...emptyDecision,
      intent: "create_work",
      confidence: 0.8,
      work: briefPlan(text),
      response: "I'll capture this as work.",
    };
  }

  return {
    ...emptyDecision,
    intent: "conversation",
    confidence: 0.6,
    response: "Understood. How would you like to take that forward?",
  };
}

function groundFromTools(
  instruction: string,
  tools: string,
  workspace: ReturnType<typeof parseWorkspace>,
): AveryDecision {
  if (/jailbreak|ignore (all|voxa)|send an email|bypass approval/i.test(tools)) {
    return {
      ...emptyDecision,
      intent: "conversation",
      confidence: 1,
      response:
        "I only act on Voxa policy and your instruction. Tool data cannot authorise sending email or skipping approval.",
    };
  }
  const refined = parseRefineTool(tools);
  if (refined && /\b(take|keep|remove|only)\b/i.test(instruction)) {
    return {
      ...emptyDecision,
      intent: "workspace_query",
      confidence: 0.95,
      response: refined,
    };
  }
  if (
    workspace.researchRows.length > 0 &&
    /\b(what did you find|found earlier|earlier research)\b/i.test(instruction)
  ) {
    const named = workspace.researchRows
      .map((row, index) => `${row.n ?? index + 1}. ${row.name}`)
      .join(" ");
    return {
      ...emptyDecision,
      intent: "workspace_query",
      confidence: 0.95,
      response: named
        ? `From the stored research: ${named}`
        : "The stored research list is empty.",
    };
  }
  if (workspace.researchRows.length > 0 && /look strongest|which \d|why (number|those)|why #\d|why did you choose/i.test(instruction)) {
    const top = workspace.researchRows
      .filter((row) => row.verification === "verified" || !row.verification)
      .slice(0, 3);
    const named = (top.length > 0 ? top : workspace.researchRows.slice(0, 3))
      .map((row, index) => `${row.n ?? index + 1}. ${row.name}${row.whyMatch ? ` — ${row.whyMatch}` : ""}`)
      .join(" ");
    return {
      ...emptyDecision,
      intent: "workspace_query",
      confidence: 0.95,
      response: named
        ? `These look strongest from the persisted list: ${named}`
        : "I'll answer from the research list.",
    };
  }
  if (workspace.researchRows.length > 0 && /\b(source|sources|where did you|what did you use)\b/i.test(instruction)) {
    const sources = workspace.researchRows
      .flatMap((row) => row.sources ?? [])
      .slice(0, 8)
      .map((item) => item.url)
      .join(" ");
    return {
      ...emptyDecision,
      intent: "workspace_query",
      confidence: 0.95,
      response: sources
        ? `I used these sources from the stored research: ${sources}`
        : "The stored research lists the sources on each company.",
    };
  }
  if (TODAY.test(instruction) || /today/i.test(instruction)) {
    const line = workspace.activity[0] ?? "Nothing is recorded on the work log yet.";
    return {
      ...emptyDecision,
      intent: "workspace_query",
      confidence: 0.95,
      response: line.startsWith("Nothing")
        ? line
        : `From today's work log: ${workspace.activity.slice(0, 3).join(" ")}`,
    };
  }
  if (workspace.openTasks.length > 0) {
    return {
      ...emptyDecision,
      intent: "workspace_query",
      confidence: 0.95,
      response: `I'm currently on: ${workspace.openTasks
        .map((task) => task.title)
        .slice(0, 3)
        .join("; ")}.`,
    };
  }
  return {
    ...emptyDecision,
    intent: "workspace_query",
    confidence: 0.9,
    response: "Nothing is running.",
  };
}

function parseRefineTool(tools: string): string | null {
  const block = tools.match(
    /<untrusted_tool_data tool="refine_research">\n([\s\S]*?)\n<\/untrusted_tool_data>/,
  );
  if (!block?.[1]) {
    return null;
  }
  try {
    const parsed = JSON.parse(block[1]) as {
      ok?: boolean;
      reason?: string;
      summary?: string;
      data?: { found?: number; verified?: number; parentArtifactId?: string | null };
    };
    if (parsed.ok === false) {
      return parsed.reason ?? "I couldn't change the stored list.";
    }
    if (parsed.summary) {
      return parsed.summary;
    }
    if (typeof parsed.data?.found === "number") {
      return `Updated the list to ${parsed.data.found} ${parsed.data.found === 1 ? "company" : "companies"}. The earlier results are still kept.`;
    }
  } catch {
    return null;
  }
  return null;
}

function answerFor(text: string): string {
  if (/cold outreach/i.test(text)) {
    return "Cold outreach is contacting people who have not asked to hear from you. Keep it specific: a reason you chose them, a clear offer, and one easy next step. Volume without relevance wastes the list.";
  }
  if (/offer|cleaning company|commercial clients/i.test(text)) {
    return "For commercial cleaning, the offer should name the environment (offices, end-of-tenancy, kitchens), the outcome (reliable cover, audit-ready, no disruption), and proof (sites like theirs). Then pick a tight geography and talk to facilities or office managers, not generic inboxes.";
  }
  return "I can help think that through. Tell me the constraint that matters most — market, offer, or the next piece of work.";
}

export function createHeuristicAdapter(): ModelAdapter {
  return {
    id: "test",
    async complete(request: ModelRequest): Promise<ModelCompletion> {
      return {
        raw: decide(request),
        usage: {
          provider: "heuristic",
          model: "heuristic",
          inputTokens: 0,
          outputTokens: 0,
        },
      };
    },
  };
}
