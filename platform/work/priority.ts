import type { TaskPriority } from "./constants";

export function parsePriority(text: string): TaskPriority {
  const trimmed = text.replace(/\s+/g, " ").trim();
  if (
    /\b(urgent|asap|immediately|right away|do this first|highest priority)\b/i.test(
      trimmed,
    )
  ) {
    return "urgent";
  }
  if (/\b(high priority|priority|important|as soon as you can)\b/i.test(trimmed)) {
    return "high";
  }
  return "normal";
}

export function priorityRank(priority: TaskPriority): number {
  if (priority === "urgent") {
    return 0;
  }
  if (priority === "high") {
    return 1;
  }
  return 2;
}
