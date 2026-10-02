import { describe, expect, it } from "vitest";
import { formatClock, stepStatusLabel, taskStatusLabel } from "@/platform/ui/workspace/format";
import { isNavActive } from "@/platform/ui/workspace/nav-link";

describe("product status language", () => {
  it("does not expose database enums", () => {
    expect(taskStatusLabel("waiting_for_approval")).toBe("Waiting for you");
    expect(taskStatusLabel("blocked")).toBe("Can't continue");
    expect(taskStatusLabel("completed")).toBe("Done");
    expect(stepStatusLabel("running")).toBe("Working");
    expect(stepStatusLabel("pending")).toBe("Waiting");
  });

  it("formats clocks on a fixed timezone without relying on the host locale", () => {
    expect(formatClock("2026-09-02T15:42:00.000Z")).toBe("16:42");
  });
});

describe("workspace navigation", () => {
  it("treats nested task routes as the Tasks item", () => {
    expect(
      isNavActive("/employee/tasks/abc", {
        href: "/employee/tasks",
        match: "tasks",
      }),
    ).toBe(true);
    expect(
      isNavActive("/employee", {
        href: "/employee/tasks",
        match: "tasks",
      }),
    ).toBe(false);
  });
});
