import type { WorkTask } from "../db/schema";
import { getTaskForScope } from "../work/queries";
import type { WorkScope } from "../work/scope";

const CONTROL_STATUSES = {
  pause: ["queued", "planning", "running"],
  resume: ["paused"],
  cancel: ["queued", "planning", "running", "paused", "waiting_for_approval", "blocked"],
} as const;

export type ControlAction = keyof typeof CONTROL_STATUSES;

export type ControlResolution =
  | { ok: true; task: WorkTask }
  | { ok: false; clarification: string };

function candidates(tasks: WorkTask[], action: ControlAction): WorkTask[] {
  const allowed: readonly string[] = CONTROL_STATUSES[action];
  return tasks.filter((task) => allowed.includes(task.status));
}

function matchHint(tasks: WorkTask[], hint: string): WorkTask[] {
  const needle = hint.trim().toLowerCase();
  if (!needle) {
    return [];
  }
  return tasks.filter(
    (task) =>
      task.title.toLowerCase().includes(needle) ||
      task.instruction.toLowerCase().includes(needle),
  );
}

export async function resolveControlTarget(input: {
  scope: WorkScope;
  tasks: WorkTask[];
  action: ControlAction;
  proposedId?: string | null;
  hint?: string | null;
  lastTaskId?: string | null;
}): Promise<ControlResolution> {
  const pool = candidates(input.tasks, input.action);

  if (input.proposedId) {
    const scoped = await getTaskForScope(input.scope, input.proposedId);
    if (scoped && pool.some((task) => task.id === scoped.id)) {
      return { ok: true, task: scoped };
    }
  }

  if (input.hint) {
    const hinted = matchHint(pool, input.hint);
    if (hinted.length === 1 && hinted[0]) {
      return { ok: true, task: hinted[0] };
    }
    if (hinted.length > 1) {
      return {
        ok: false,
        clarification: clarify(hinted),
      };
    }
  }

  if (input.lastTaskId) {
    const last = pool.find((task) => task.id === input.lastTaskId);
    if (last && pool.length === 1) {
      return { ok: true, task: last };
    }
    if (last && pool.length > 1) {
      // Prefer the referenced task when the user said "that".
      return { ok: true, task: last };
    }
  }

  if (pool.length === 1 && pool[0]) {
    return { ok: true, task: pool[0] };
  }

  if (pool.length === 0) {
    return {
      ok: false,
      clarification: "There's no matching open work to change.",
    };
  }

  return { ok: false, clarification: clarify(pool) };
}

function clarify(tasks: WorkTask[]): string {
  const titles = tasks.slice(0, 4).map((task) => task.title);
  if (titles.length === 2) {
    return `Which task — ${titles[0]} or ${titles[1]}?`;
  }
  return `Which task should I change — ${titles.join("; ")}?`;
}
