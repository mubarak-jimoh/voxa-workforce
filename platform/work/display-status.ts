import type { EmployeeStatus } from "../employee/constants";
import type { DisplayStatus, TaskStatus } from "./constants";

export function displayStatusForEmployee(input: {
  availability: EmployeeStatus;
  taskStatuses: readonly TaskStatus[];
}): DisplayStatus {
  if (input.availability === "paused") {
    return "paused";
  }
  if (
    input.taskStatuses.some(
      (status) => status === "running" || status === "planning" || status === "queued",
    )
  ) {
    return "working";
  }
  if (input.taskStatuses.some((status) => status === "waiting_for_approval")) {
    return "waiting";
  }
  return "idle";
}

export function displayStatusLabel(status: DisplayStatus): string {
  if (status === "idle") {
    return "Ready";
  }
  if (status === "waiting") {
    return "Waiting for you";
  }
  if (status === "working") {
    return "Working";
  }
  return "Paused";
}

export function presenceLine(input: {
  status: DisplayStatus;
  employeeName: string;
  workingTitle?: string | null;
  waitingCount?: number;
}): string {
  if (input.status === "paused") {
    return `${input.employeeName} is paused`;
  }
  if (input.status === "working") {
    return input.workingTitle
      ? `${input.employeeName} is working on ${input.workingTitle}`
      : `${input.employeeName} is working`;
  }
  if (input.status === "waiting") {
    if (input.waitingCount && input.waitingCount > 1) {
      return `${input.employeeName} needs your approval on ${input.waitingCount} items`;
    }
    return `${input.employeeName} needs your approval`;
  }
  return "Ready for work";
}

export const OPEN_TASK_STATUSES: readonly TaskStatus[] = [
  "queued",
  "planning",
  "running",
  "waiting_for_approval",
  "paused",
];
