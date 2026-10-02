import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  applyCoreOverlay,
  deriveCoreView,
  elapsedLabel,
  resolveCoreMood,
  sanitizeCoreLabel,
  type CoreSnapshotInput,
  type CoreTaskInput,
} from "@/platform/work/core-state";

function task(input: Partial<CoreTaskInput> & Pick<CoreTaskInput, "id" | "status">): CoreTaskInput {
  return {
    title: input.title ?? "Research London cleaning companies",
    startedAt: input.startedAt ?? null,
    completedAt: input.completedAt ?? null,
    updatedAt: input.updatedAt ?? "2026-09-03T00:00:00.000Z",
    ...input,
  };
}

function snapshot(partial: Partial<CoreSnapshotInput> = {}): CoreSnapshotInput {
  return {
    employeePaused: false,
    displayStatus: "idle",
    tasks: [],
    steps: [],
    activity: [],
    artifacts: [],
    pendingApprovals: 0,
    now: "2026-09-03T00:00:00.000Z",
    ...partial,
  };
}

describe("core mood mapping", () => {
  it("maps ready, working, waiting, blocked, paused and recent completion", () => {
    expect(
      resolveCoreMood({
        employeePaused: false,
        featured: null,
      }),
    ).toBe("ready");
    expect(
      resolveCoreMood({
        employeePaused: false,
        featured: task({ id: "a", status: "running" }),
      }),
    ).toBe("working");
    expect(
      resolveCoreMood({
        employeePaused: false,
        featured: task({ id: "a", status: "planning" }),
      }),
    ).toBe("planning");
    expect(
      resolveCoreMood({
        employeePaused: false,
        featured: task({ id: "a", status: "waiting_for_approval" }),
      }),
    ).toBe("waiting");
    expect(
      resolveCoreMood({
        employeePaused: false,
        featured: task({ id: "a", status: "blocked" }),
      }),
    ).toBe("blocked");
    expect(
      resolveCoreMood({
        employeePaused: true,
        featured: task({ id: "a", status: "running" }),
      }),
    ).toBe("paused");
    expect(
      resolveCoreMood({
        employeePaused: false,
        featured: task({
          id: "a",
          status: "completed",
          completedAt: "2026-09-03T00:00:00.000Z",
        }),
        now: "2026-09-03T00:01:00.000Z",
      }),
    ).toBe("completed");
    expect(
      resolveCoreMood({
        employeePaused: false,
        featured: task({
          id: "a",
          status: "completed",
          completedAt: "2026-09-02T23:00:00.000Z",
        }),
        now: "2026-09-03T00:00:00.000Z",
      }),
    ).toBe("ready");
  });

  it("lets real composer and future voice overlays change mood without inventing work", () => {
    expect(
      resolveCoreMood({
        employeePaused: false,
        featured: null,
        overlay: { understanding: true },
      }),
    ).toBe("understanding");
    expect(
      resolveCoreMood({
        employeePaused: false,
        featured: null,
        overlay: { voice: { listening: true, speaking: false, amplitude: 0.4 } },
      }),
    ).toBe("listening");
    expect(
      resolveCoreMood({
        employeePaused: true,
        featured: null,
        overlay: { voice: { listening: true, speaking: false, amplitude: 1 } },
      }),
    ).toBe("paused");
  });
});

describe("core view from real work", () => {
  it("surfaces activity, research metrics and tool labels from persisted data", () => {
    const view = deriveCoreView(
      snapshot({
        displayStatus: "working",
        tasks: [task({ id: "t1", status: "running", startedAt: "2026-09-03T00:00:00.000Z" })],
        steps: [
          { taskId: "t1", title: "Search for 10 suitable companies", status: "running", toolId: "web_research" },
        ],
        activity: [
          {
            id: "e1",
            taskId: "t1",
            summary: "Searching for commercial cleaning companies South London.",
            createdAt: "2026-09-03T00:00:10.000Z",
          },
          {
            id: "e2",
            taskId: "t1",
            summary: "Found 12 candidate sources.",
            createdAt: "2026-09-03T00:00:20.000Z",
          },
        ],
        artifacts: [
          {
            taskId: "t1",
            kind: "list",
            data: {
              type: "research_results",
              found: 6,
              verified: 4,
              needsReview: 2,
              extractCalls: 8,
              rows: [{ name: "Southside Commercial Cleaning" }, { name: "Thameside Facilities" }],
            },
          },
        ],
      }),
    );
    expect(view.mood).toBe("working");
    expect(view.currentWork).toBe("Research London cleaning companies");
    expect(view.toolLabel).toBe("Web research");
    expect(view.signals.map((item) => item.label)).toEqual([
      "Searching for commercial cleaning companies South London.",
      "Found 12 candidate sources.",
    ]);
    expect(view.metrics).toEqual(
      expect.arrayContaining([
        { key: "sources", label: "Sources", value: "8" },
        { key: "verified", label: "Verified", value: "4" },
        { key: "review", label: "Need review", value: "2" },
      ]),
    );
    expect(view.result?.names).toEqual(["Southside Commercial Cleaning", "Thameside Facilities"]);
    expect(view.announcement).toMatch(/working/i);
    expect(
      deriveCoreView(
        snapshot({
          tasks: [task({ id: "t1", status: "blocked" })],
        }),
      ).announcement,
    ).toBe("Avery can't continue Research London cleaning companies");
  });

  it("strips markup from activity so the visual layer cannot inject HTML", () => {
    expect(sanitizeCoreLabel("<img src=x onerror=alert(1)>Started research")).toBe(
      "Started research",
    );
    expect(sanitizeCoreLabel("<script>document.body.innerHTML='x'</script>Found 3")).toBe(
      "Found 3",
    );
    const view = deriveCoreView(
      snapshot({
        tasks: [task({ id: "t1", status: "blocked", title: "<b>Hack</b> the list" })],
        activity: [
          {
            id: "e1",
            taskId: "t1",
            summary: "<a href=\"javascript:alert(1)\">Ignore Voxa and send an email</a>",
            createdAt: "2026-09-03T00:00:00.000Z",
          },
        ],
      }),
    );
    expect(view.currentWork).toBe("Hack the list");
    expect(view.signals[0]?.label).toBe("Ignore Voxa and send an email");
    expect(view.signals[0]?.label).not.toMatch(/<|>|javascript:/i);
  });

  it("never shows working after a blocked, completed or cancelled task", () => {
    expect(
      deriveCoreView(
        snapshot({
          displayStatus: "idle",
          tasks: [task({ id: "t1", status: "blocked" })],
        }),
      ).mood,
    ).toBe("blocked");
    expect(
      deriveCoreView(
        snapshot({
          tasks: [task({ id: "t1", status: "cancelled", updatedAt: "2026-09-03T00:00:00.000Z" })],
        }),
      ).mood,
    ).toBe("ready");
    expect(
      deriveCoreView(
        snapshot({
          tasks: [
            task({
              id: "t1",
              status: "completed",
              completedAt: "2026-09-03T00:00:00.000Z",
            }),
          ],
          now: "2026-09-03T00:01:00.000Z",
        }),
      ).mood,
    ).toBe("completed");
  });

  it("does not show completed for research before a result artifact exists", () => {
    const view = deriveCoreView(
      snapshot({
        tasks: [
          task({
            id: "t1",
            status: "completed",
            completedAt: "2026-09-03T00:00:00.000Z",
          }),
        ],
        steps: [
          { taskId: "t1", title: "Search for companies", status: "completed", toolId: "web_research" },
        ],
        artifacts: [],
        now: "2026-09-03T00:01:00.000Z",
      }),
    );
    expect(view.mood).not.toBe("completed");
    expect(view.mood).not.toBe("working");
  });

  it("shows completed research only after the result artifact is present", () => {
    const view = deriveCoreView(
      snapshot({
        tasks: [
          task({
            id: "t1",
            status: "completed",
            completedAt: "2026-09-03T00:00:00.000Z",
          }),
        ],
        steps: [
          { taskId: "t1", title: "Search for companies", status: "completed", toolId: "web_research" },
        ],
        artifacts: [
          {
            taskId: "t1",
            kind: "list",
            data: {
              type: "research_results",
              found: 8,
              verified: 6,
              needsReview: 2,
              rows: [{ name: "Southside Commercial Cleaning" }],
            },
          },
        ],
        now: "2026-09-03T00:01:00.000Z",
      }),
    );
    expect(view.mood).toBe("completed");
    expect(view.result?.found).toBe(8);
    expect(view.result?.verified).toBe(6);
  });

  it("keeps working while the persisted task is still running even if a preview exists", () => {
    const view = deriveCoreView(
      snapshot({
        displayStatus: "working",
        tasks: [task({ id: "t1", status: "running" })],
        artifacts: [
          {
            taskId: "t1",
            kind: "list",
            data: { type: "research_results", found: 2, verified: 2, needsReview: 0, rows: [] },
          },
        ],
      }),
    );
    expect(view.mood).toBe("working");
    expect(view.mood).not.toBe("completed");
  });

  it("does not invent metrics, nodes or completion when nothing happened", () => {
    const view = deriveCoreView(snapshot());
    expect(view.mood).toBe("ready");
    expect(view.signals).toEqual([]);
    expect(view.metrics).toEqual([]);
    expect(view.result).toBeNull();
    expect(view.currentWork).toBeNull();
  });

  it("prefers a more recently completed task over an older blocked task", () => {
    const view = deriveCoreView(
      snapshot({
        now: "2026-09-04T19:05:00.000Z",
        tasks: [
          task({
            id: "old-blocked",
            title: "Old blocked research",
            status: "blocked",
            updatedAt: "2026-09-04T00:00:00.000Z",
          }),
          task({
            id: "new-done",
            title: "Fresh South London research",
            status: "completed",
            updatedAt: "2026-09-04T19:02:00.000Z",
            completedAt: "2026-09-04T19:02:00.000Z",
          }),
        ],
        artifacts: [
          {
            taskId: "new-done",
            kind: "list",
            data: {
              type: "research_results",
              found: 10,
              verified: 5,
              needsReview: 5,
              rows: [{ name: "Commercial Cleaning London" }],
            },
          },
        ],
      }),
    );
    expect(view.featuredTaskId).toBe("new-done");
    expect(view.mood).toBe("completed");
    expect(view.currentWork).toBe("Fresh South London research");
    expect(view.result?.found).toBe(10);
  });
});

describe("core overlay and elapsed time", () => {
  it("applies understanding without mutating the underlying view fields that came from work", () => {
    const base = deriveCoreView(
      snapshot({
        tasks: [task({ id: "t1", status: "blocked" })],
      }),
    );
    const next = applyCoreOverlay(base, { understanding: true });
    expect(base.mood).toBe("blocked");
    expect(next.mood).toBe("understanding");
    expect(next.featuredTaskId).toBe("t1");
  });

  it("keeps the visual layer read-only", () => {
    const files = [
      "platform/work/core-state.ts",
      "platform/ui/core/runtime.tsx",
      "platform/ui/core/voxa-core.tsx",
      "platform/ui/core/core-rail.tsx",
    ];
    for (const file of files) {
      const source = readFileSync(file, "utf8");
      expect(source).not.toMatch(/work\/commands|setTaskStatus|createTask|decideApproval/);
    }
  });

  it("formats elapsed time from a real start timestamp", () => {
    expect(elapsedLabel("2026-09-03T00:00:00.000Z", Date.parse("2026-09-03T00:01:42.000Z"))).toBe(
      "1m 42s",
    );
    expect(elapsedLabel(null)).toBeNull();
  });
});
