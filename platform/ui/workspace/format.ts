const TASK_LABELS: Record<string, string> = {
  queued: "Queued",
  planning: "Planning",
  running: "Working",
  waiting_for_approval: "Waiting for you",
  blocked: "Can't continue",
  completed: "Done",
  failed: "Failed",
  cancelled: "Cancelled",
  paused: "Paused",
};

const STEP_LABELS: Record<string, string> = {
  pending: "Waiting",
  running: "Working",
  completed: "Done",
  blocked: "Can't continue",
  skipped: "Skipped",
  failed: "Failed",
};

function londonParts(
  value: Date | string,
): Partial<Record<Intl.DateTimeFormatPartTypes, string>> {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return {};
  }
  return Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      day: "numeric",
      month: "short",
      hour: "numeric",
      minute: "numeric",
      hourCycle: "h23",
      timeZone: "Europe/London",
    })
      .formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );
}

export function formatWhen(value: Date | string | null | undefined): string {
  if (!value) {
    return "—";
  }
  const parts = londonParts(value);
  if (!parts.day || !parts.month || !parts.hour || !parts.minute) {
    return "—";
  }
  return `${parts.day} ${parts.month}, ${parts.hour.padStart(2, "0")}:${parts.minute.padStart(2, "0")}`;
}

export function formatClock(value: Date | string | null | undefined): string {
  if (!value) {
    return "";
  }
  const parts = londonParts(value);
  if (!parts.hour || !parts.minute) {
    return "";
  }
  return `${parts.hour.padStart(2, "0")}:${parts.minute.padStart(2, "0")}`;
}

export function taskStatusLabel(status: string): string {
  return TASK_LABELS[status] ?? status.replaceAll("_", " ");
}

export function stepStatusLabel(status: string): string {
  return STEP_LABELS[status] ?? status.replaceAll("_", " ");
}

export function formatTodaySummary(input: {
  completedToday: number;
  briefsToday: number;
  draftsToday: number;
  pendingApprovals: number;
}): string | null {
  const hasSignal =
    input.completedToday > 0 ||
    input.briefsToday > 0 ||
    input.draftsToday > 0 ||
    input.pendingApprovals > 0;
  if (!hasSignal) {
    return null;
  }
  const parts: string[] = [
    `completed ${input.completedToday} task${input.completedToday === 1 ? "" : "s"}`,
  ];
  if (input.briefsToday > 0) {
    parts.push(
      `captured ${input.briefsToday} brief${input.briefsToday === 1 ? "" : "s"}`,
    );
  }
  if (input.draftsToday > 0) {
    parts.push(
      `prepared ${input.draftsToday} draft${input.draftsToday === 1 ? "" : "s"}`,
    );
  }
  if (input.pendingApprovals > 0) {
    parts.push(
      `${input.pendingApprovals} waiting for approval`,
    );
  }
  const [first, ...rest] = parts;
  if (!first) {
    return null;
  }
  const body =
    rest.length === 0
      ? first
      : rest.length === 1
        ? `${first} and ${rest[0]}`
        : `${first}, ${rest.join(", ")}`;
  return `Today — ${body}.`;
}
