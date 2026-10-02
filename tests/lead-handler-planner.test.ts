import { describe, expect, it } from "vitest";
import { interpretLeadHandler } from "@/employees/lead-handler/planner";
import type { InterpreterContext } from "@/platform/ai/types";

function ctx(overrides?: Partial<InterpreterContext>): InterpreterContext {
  return {
    employeeName: "Avery",
    roleLabel: "lead_handler",
    paused: false,
    openTaskTitles: [],
    pendingApprovalCount: 0,
    completedTodayCount: 0,
    ...overrides,
  };
}

describe("Lead Handler interpreter", () => {
  it("turns research into planned work without claiming results", () => {
    const result = interpretLeadHandler(
      "Find 30 commercial cleaning companies in London",
      ctx(),
    );
    expect(result.kind).toBe("work");
    if (result.kind !== "work") {
      return;
    }
    expect(result.acknowledgement).toMatch(/I'll research 30 companies/i);
    expect(result.acknowledgement).not.toMatch(/delighted|🚀|Absolutely/i);
    expect(result.plan.some((step) => step.toolId === "web_research")).toBe(true);
    expect(result.plan.some((step) => step.toolId === "record_brief")).toBe(true);
  });

  it("answers status from real context", () => {
    const idle = interpretLeadHandler("What are you currently working on?", ctx());
    expect(idle).toEqual({
      kind: "reply",
      body: "I'm ready. Tell me what you need and I'll turn it into work.",
    });

    const busy = interpretLeadHandler(
      "What are you currently working on?",
      ctx({ openTaskTitles: ["Research London cleaning companies"] }),
    );
    expect(busy.kind).toBe("reply");
    if (busy.kind === "reply") {
      expect(busy.body).toContain("Research London cleaning companies");
    }
  });

  it("summarises today from counts, not invented activity", () => {
    const result = interpretLeadHandler(
      "Summarise what you've done today",
      ctx({ completedTodayCount: 2, pendingApprovalCount: 1 }),
    );
    expect(result.kind).toBe("reply");
    if (result.kind === "reply") {
      expect(result.body).toContain("2 tasks");
      expect(result.body).toContain("1 waiting");
    }
  });

  it("saves recurring research as a schedule, not live execution", () => {
    const result = interpretLeadHandler(
      "Every Monday find 20 new prospects",
      ctx(),
    );
    expect(result.kind).toBe("schedule");
    if (result.kind === "schedule") {
      expect(result.cadence).toBe("Every Monday");
      expect(result.reply).toMatch(/no live background scheduler/i);
    }
  });

  it("routes send requests through approval, not silent send", () => {
    const result = interpretLeadHandler("Send them after I approve them.", ctx());
    expect(result.kind).toBe("work");
    if (result.kind === "work") {
      expect(result.plan.some((step) => step.toolId === "send_email")).toBe(true);
    }
  });

  it("treats pause, resume and cancel as controls", () => {
    expect(interpretLeadHandler("Stop the lead research task.", ctx()).kind).toBe(
      "control",
    );
    expect(interpretLeadHandler("Continue where you left off.", ctx()).kind).toBe(
      "control",
    );
    expect(interpretLeadHandler("Cancel that.", ctx()).kind).toBe("control");
  });
});
