import type { DisplayStatus, TaskStatus } from "./constants";

export const CORE_MOODS = [
  "ready",
  "listening",
  "understanding",
  "speaking",
  "planning",
  "working",
  "waiting",
  "completed",
  "blocked",
  "paused",
] as const;

export type CoreMood = (typeof CORE_MOODS)[number];

export type CoreSignal = {
  id: string;
  label: string;
  at: string;
};

export type CoreMetric = {
  key: string;
  label: string;
  value: string;
};

export type CoreResultPreview = {
  found: number;
  verified: number;
  needsReview: number;
  names: string[];
};

export type CoreView = {
  mood: CoreMood;
  announcement: string;
  currentWork: string | null;
  currentStep: string | null;
  toolLabel: string | null;
  metrics: CoreMetric[];
  signals: CoreSignal[];
  result: CoreResultPreview | null;
  startedAt: string | null;
  featuredTaskId: string | null;
};

export type CoreVoiceDrive = {
  listening: boolean;
  speaking: boolean;
  amplitude: number;
};

export type CoreRuntimeOverlay = {
  understanding: boolean;
  voice: CoreVoiceDrive;
};

export const IDLE_VOICE_DRIVE: CoreVoiceDrive = {
  listening: false,
  speaking: false,
  amplitude: 0,
};

export const COMPLETED_SETTLE_MS = 3 * 60 * 1000;

const TOOL_LABELS: Record<string, string> = {
  record_brief: "Capture",
  web_research: "Web research",
  find_contacts: "Contact discovery",
  draft_outreach: "Drafting",
  send_email: "Email",
};

export type CoreTaskInput = {
  id: string;
  title: string;
  status: TaskStatus;
  startedAt: Date | string | null;
  completedAt: Date | string | null;
  updatedAt: Date | string;
};

export type CoreStepInput = {
  taskId: string;
  title: string;
  status: string;
  toolId: string | null;
};

export type CoreActivityInput = {
  id: string;
  taskId: string | null;
  summary: string;
  createdAt: Date | string;
};

export type CoreArtifactInput = {
  taskId: string;
  kind: string;
  data: Record<string, unknown> | null;
};

export type CoreSnapshotInput = {
  employeePaused: boolean;
  displayStatus: DisplayStatus;
  tasks: CoreTaskInput[];
  steps: CoreStepInput[];
  activity: CoreActivityInput[];
  artifacts: CoreArtifactInput[];
  pendingApprovals: number;
  now?: Date | string | number;
  overlay?: Partial<CoreRuntimeOverlay>;
};

export function sanitizeCoreLabel(value: string, max = 96): string {
  const stripped = value
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]*>/g, "")
    .replace(/javascript:/gi, "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (stripped.length <= max) {
    return stripped;
  }
  return `${stripped.slice(0, max - 1).trim()}…`;
}

export function coreMoodLabel(mood: CoreMood): string {
  if (mood === "ready") {
    return "Ready";
  }
  if (mood === "listening") {
    return "Listening";
  }
  if (mood === "understanding") {
    return "Understanding";
  }
  if (mood === "speaking") {
    return "Speaking";
  }
  if (mood === "planning") {
    return "Planning";
  }
  if (mood === "working") {
    return "Working";
  }
  if (mood === "waiting") {
    return "Waiting for you";
  }
  if (mood === "completed") {
    return "Done";
  }
  if (mood === "blocked") {
    return "Can't continue";
  }
  return "Paused";
}

export function toolLabelFor(toolId: string | null | undefined): string | null {
  if (!toolId) {
    return null;
  }
  return TOOL_LABELS[toolId] ?? sanitizeCoreLabel(toolId.replaceAll("_", " "), 32);
}

function asTime(value: Date | string | null | undefined): number {
  if (!value) {
    return 0;
  }
  const time = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isNaN(time) ? 0 : time;
}

function mostRecentlyUpdated(tasks: CoreTaskInput[]): CoreTaskInput | null {
  return (
    [...tasks].sort((left, right) => asTime(right.updatedAt) - asTime(left.updatedAt))[0] ??
    null
  );
}

function pickFeaturedTask(tasks: CoreTaskInput[]): CoreTaskInput | null {
  const active =
    tasks.find((task) => task.status === "planning") ??
    tasks.find((task) => task.status === "running") ??
    tasks.find((task) => task.status === "queued") ??
    tasks.find((task) => task.status === "waiting_for_approval") ??
    tasks.find((task) => task.status === "paused");
  if (active) {
    return active;
  }

  // Prefer the newest settled outcome. An old blocked task must not outrank a
  // more recently completed (or failed) piece of work.
  const settled = tasks.filter((task) =>
    ["blocked", "failed", "completed"].includes(task.status),
  );
  return mostRecentlyUpdated(settled) ?? mostRecentlyUpdated(tasks);
}

export function resolveCoreMood(input: {
  employeePaused: boolean;
  featured: CoreTaskInput | null;
  overlay?: Partial<CoreRuntimeOverlay>;
  now?: Date | string | number;
}): CoreMood {
  if (input.employeePaused) {
    return "paused";
  }
  const voice = input.overlay?.voice;
  if (voice?.listening) {
    return "listening";
  }
  if (voice?.speaking) {
    return "speaking";
  }
  if (input.overlay?.understanding) {
    return "understanding";
  }
  const status = input.featured?.status;
  if (status === "planning") {
    return "planning";
  }
  if (status === "running" || status === "queued") {
    return "working";
  }
  if (status === "waiting_for_approval") {
    return "waiting";
  }
  if (status === "paused") {
    return "paused";
  }
  if (status === "blocked" || status === "failed") {
    return "blocked";
  }
  if (status === "completed") {
    const now = input.now === undefined ? Date.now() : new Date(input.now).getTime();
    const completedAt = asTime(input.featured?.completedAt ?? input.featured?.updatedAt);
    if (completedAt && now - completedAt <= COMPLETED_SETTLE_MS) {
      return "completed";
    }
  }
  return "ready";
}

function researchFromArtifact(data: Record<string, unknown> | null): CoreResultPreview | null {
  if (!data || data.type !== "research_results") {
    return null;
  }
  const rows = Array.isArray(data.rows) ? data.rows : [];
  const found = typeof data.found === "number" ? data.found : rows.length;
  const verified = typeof data.verified === "number" ? data.verified : 0;
  const needsReview = typeof data.needsReview === "number" ? data.needsReview : 0;
  const names = rows
    .map((row) =>
      row && typeof row === "object" && "name" in row
        ? sanitizeCoreLabel(String((row as { name?: string }).name ?? ""), 48)
        : "",
    )
    .filter(Boolean)
    .slice(0, 6);
  return { found, verified, needsReview, names };
}

function sourcesFrom(input: {
  artifact: Record<string, unknown> | null;
  activity: CoreActivityInput[];
}): number | null {
  const extractCalls =
    input.artifact && typeof input.artifact.extractCalls === "number"
      ? input.artifact.extractCalls
      : null;
  const searchCalls =
    input.artifact && typeof input.artifact.searchCalls === "number"
      ? input.artifact.searchCalls
      : null;
  if (typeof extractCalls === "number" && extractCalls > 0) {
    return extractCalls;
  }
  for (const item of input.activity) {
    const match = item.summary.match(/\bFound (\d+) candidate/i);
    if (match?.[1]) {
      return Number.parseInt(match[1], 10);
    }
  }
  return searchCalls && searchCalls > 0 ? searchCalls : null;
}

function announcementFor(input: {
  mood: CoreMood;
  work: string | null;
  step: string | null;
}): string {
  if (input.mood === "ready") {
    return "Avery is ready for work";
  }
  if (input.mood === "blocked") {
    return input.work
      ? `Avery can't continue ${input.work}${input.step ? `. ${input.step}` : ""}`
      : "Avery can't continue";
  }
  const label = coreMoodLabel(input.mood);
  if (input.work && input.step) {
    return `Avery is ${label.toLowerCase()}. ${input.work}. ${input.step}.`;
  }
  if (input.work) {
    return `Avery is ${label.toLowerCase()} on ${input.work}`;
  }
  return `Avery is ${label.toLowerCase()}`;
}

export function deriveCoreView(input: CoreSnapshotInput): CoreView {
  const featured = pickFeaturedTask(input.tasks);
  const steps = featured
    ? input.steps.filter((step) => step.taskId === featured.id)
    : [];
  const artifact =
    featured
      ? input.artifacts.find(
          (item) => item.taskId === featured.id && item.data?.type === "research_results",
        ) ?? input.artifacts.find((item) => item.taskId === featured.id)
      : null;
  const researchArtifact =
    featured &&
    input.artifacts.find(
      (item) => item.taskId === featured.id && item.data?.type === "research_results",
    );
  const result = researchFromArtifact(artifact?.data ?? null);
  let mood = resolveCoreMood({
    employeePaused: input.employeePaused,
    featured,
    overlay: input.overlay,
    now: input.now,
  });
  if (
    mood === "working" &&
    featured &&
    ["blocked", "failed", "completed", "cancelled"].includes(featured.status)
  ) {
    mood =
      featured.status === "completed"
        ? "completed"
        : featured.status === "cancelled"
          ? "ready"
          : "blocked";
  }
  if (
    mood === "completed" &&
    steps.some((step) => step.toolId === "web_research") &&
    !researchArtifact
  ) {
    mood = "ready";
  }
  if (mood === "completed" && featured?.status !== "completed") {
    mood = "ready";
  }
  const currentStep =
    steps.find((step) => step.status === "running") ??
    steps.find((step) => step.status === "blocked") ??
    steps.find((step) => step.status === "pending") ??
    null;
  const relatedActivity = (
    featured
      ? input.activity.filter((item) => item.taskId === featured.id)
      : input.activity
  ).slice(0, 8);
  const sources = sourcesFrom({
    artifact: artifact?.data ?? null,
    activity: relatedActivity,
  });
  const metrics: CoreMetric[] = [];
  if (sources !== null) {
    metrics.push({ key: "sources", label: "Sources", value: String(sources) });
  }
  if (result) {
    metrics.push({ key: "verified", label: "Verified", value: String(result.verified) });
    if (result.needsReview > 0) {
      metrics.push({
        key: "review",
        label: "Need review",
        value: String(result.needsReview),
      });
    }
  }
  if (input.pendingApprovals > 0) {
    metrics.push({
      key: "waiting",
      label: "Waiting",
      value: String(input.pendingApprovals),
    });
  }
  const tool = toolLabelFor(currentStep?.toolId);
  const work =
    featured && ["planning", "running", "queued", "waiting_for_approval", "blocked", "failed", "paused", "completed"].includes(featured.status)
      ? sanitizeCoreLabel(featured.title, 72)
      : mood === "understanding"
        ? "Reading your instruction"
        : null;
  const stepTitle = currentStep ? sanitizeCoreLabel(currentStep.title, 72) : null;

  return {
    mood,
    announcement: announcementFor({ mood, work, step: stepTitle }),
    currentWork: work,
    currentStep: stepTitle,
    toolLabel: tool,
    metrics,
    signals: relatedActivity
      .map((item) => ({
        id: item.id,
        label: sanitizeCoreLabel(item.summary),
        at: item.createdAt instanceof Date ? item.createdAt.toISOString() : String(item.createdAt),
      }))
      .filter((item, index, list) => index === 0 || item.label !== list[index - 1]?.label),
    result: result && result.found > 0 ? result : null,
    startedAt: featured?.startedAt
      ? featured.startedAt instanceof Date
        ? featured.startedAt.toISOString()
        : String(featured.startedAt)
      : null,
    featuredTaskId: featured?.id ?? null,
  };
}

export function applyCoreOverlay(view: CoreView, overlay: Partial<CoreRuntimeOverlay>): CoreView {
  if (view.mood === "paused") {
    return view;
  }
  if (overlay.voice?.listening) {
    return {
      ...view,
      mood: "listening",
      announcement: "Avery is listening",
    };
  }
  if (overlay.voice?.speaking) {
    return {
      ...view,
      mood: "speaking",
      announcement: "Avery is speaking",
    };
  }
  if (overlay.understanding) {
    return {
      ...view,
      mood: "understanding",
      currentWork: "Reading your instruction",
      announcement: "Avery is understanding your instruction",
    };
  }
  return view;
}

export function elapsedLabel(startedAt: string | null, now = Date.now()): string | null {
  if (!startedAt) {
    return null;
  }
  const start = new Date(startedAt).getTime();
  if (Number.isNaN(start) || now < start) {
    return null;
  }
  const seconds = Math.floor((now - start) / 1000);
  if (seconds < 60) {
    return `${seconds}s`;
  }
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return rest === 0 ? `${minutes}m` : `${minutes}m ${rest}s`;
}
