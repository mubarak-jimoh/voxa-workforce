import { describe, expect, it } from "vitest";
import { displayStatusForEmployee, displayStatusLabel, presenceLine } from "@/platform/work/display-status";

describe("employee display status", () => {
  it("prefers paused availability over task state", () => {
    expect(
      displayStatusForEmployee({
        availability: "paused",
        taskStatuses: ["running"],
      }),
    ).toBe("paused");
  });

  it("shows working, waiting, then idle", () => {
    expect(
      displayStatusForEmployee({
        availability: "idle",
        taskStatuses: ["planning"],
      }),
    ).toBe("working");
    expect(
      displayStatusForEmployee({
        availability: "idle",
        taskStatuses: ["queued"],
      }),
    ).toBe("working");
    expect(
      displayStatusForEmployee({
        availability: "idle",
        taskStatuses: ["waiting_for_approval"],
      }),
    ).toBe("waiting");
    expect(
      displayStatusForEmployee({
        availability: "idle",
        taskStatuses: ["blocked", "completed"],
      }),
    ).toBe("idle");
  });

  it("uses product language for people, not database terms", () => {
    expect(displayStatusLabel("idle")).toBe("Ready");
    expect(displayStatusLabel("waiting")).toBe("Waiting for you");
    expect(
      presenceLine({
        status: "working",
        employeeName: "Avery",
        workingTitle: "Research London cleaning companies",
      }),
    ).toBe("Avery is working on Research London cleaning companies");
    expect(
      presenceLine({
        status: "waiting",
        employeeName: "Avery",
      }),
    ).toBe("Avery needs your approval");
    expect(
      presenceLine({
        status: "idle",
        employeeName: "Avery",
      }),
    ).toBe("Ready for work");
    expect(
      presenceLine({
        status: "paused",
        employeeName: "Avery",
      }),
    ).toBe("Avery is paused");
  });
});
