import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { interpretWithAvery } from "@/platform/ai/brain";
import { createHeuristicAdapter } from "@/platform/ai/heuristic";
import { capabilityStatus } from "@/platform/ai/capabilities";
import { executeInternalTool } from "@/platform/ai/tools";
import { averySystemPrompt } from "@/employees/lead-handler/prompt";
import { usageEvent } from "@/platform/db/schema";
import { createFixtureProvider, FIXTURE_SOUTH_LONDON } from "@/platform/research/fixture";
import { createConfiguredResearchProvider } from "@/platform/research/factory";
import { isWebResearchAvailable } from "@/platform/research/provider";
import { researchInputSchema } from "@/platform/research/schema";
import { createTavilyProvider } from "@/platform/research/tavily";
import { webResearchTool } from "@/platform/research/tool";
import { isDirectoryHost } from "@/platform/research/quality";
import { applyInstruction, executeExistingTask } from "@/platform/work/submit";
import { setTaskStatus } from "@/platform/work/commands";
import { deriveCoreView } from "@/platform/work/core-state";
import {
  getArtifactForScope,
  getOrCreateConversation,
  getTaskForScope,
  listActivity,
  listApprovals,
  listArtifactsForTask,
  listMessages,
  listStepsForTask,
  listTasks,
} from "@/platform/work/queries";
import { createTestDatabase, createTestWorkspace, workScopeFor } from "./helpers";

function prompt(name = "Avery", org = "Northridge") {
  return averySystemPrompt({
    employeeName: name,
    roleLabel: "Lead Handler",
    roleSummary: "Handles prospect research, qualification and outreach preparation.",
    organisationName: org,
  });
}

async function interpret(
  dbWorkspace: Awaited<ReturnType<typeof createTestWorkspace>> & {
    db: Awaited<ReturnType<typeof createTestDatabase>>["db"];
  },
  instruction: string,
) {
  return interpretWithAvery({
    scope: workScopeFor(dbWorkspace.db, dbWorkspace),
    instruction,
    organisationName: dbWorkspace.organisation.name,
    employeeName: dbWorkspace.employee.name,
    roleLabel: "Lead Handler",
    paused: false,
    systemPrompt: prompt(dbWorkspace.employee.name, dbWorkspace.organisation.name),
    adapter: createHeuristicAdapter(),
  });
}

const RESEARCH = "Find me 10 commercial cleaning companies in South London.";

describe("web research capability", () => {
  it("stays disconnected in the default test environment", () => {
    expect(isWebResearchAvailable()).toBe(false);
    expect(capabilityStatus("web_research")).toBe("not_connected");
    expect(capabilityStatus("find_contacts")).toBe("not_connected");
    expect(capabilityStatus("send_email")).toBe("not_connected");
    expect(createConfiguredResearchProvider()).toBeNull();
    expect(webResearchTool.availability()).toBe("not_connected");
  });

  it("becomes available only when a provider is configured", () => {
    expect(
      isWebResearchAvailable({ ...process.env, VOXA_RESEARCH_ADAPTER: "test" }),
    ).toBe(true);
    expect(
      createConfiguredResearchProvider({ ...process.env, VOXA_RESEARCH_ADAPTER: "test" })?.id,
    ).toBe("fixture");
  });

  it("validates research tool input", () => {
    expect(researchInputSchema.safeParse({ query: "" }).success).toBe(false);
    expect(researchInputSchema.safeParse({ query: "a", limit: 99 }).success).toBe(false);
    expect(researchInputSchema.safeParse({ query: "commercial cleaning" }).success).toBe(true);
    expect(
      researchInputSchema.safeParse({
        query: "commercial cleaning",
        location: "South London",
        limit: 10,
      }).success,
    ).toBe(true);
  });

  it("routes a research request to the web tool", async () => {
    const { db } = await createTestDatabase();
    const workspace = await createTestWorkspace(db);
    const result = await interpret({ ...workspace, db }, RESEARCH);
    expect(result.kind).toBe("work");
    if (result.kind === "work") {
      expect(result.plan.some((step) => step.toolId === "web_research")).toBe(true);
      expect(result.acknowledgement).not.toMatch(/I found 10/i);
    }
  });
});

describe("research pipeline", () => {
  it("creates a grounded artifact and does not invent missing rows", async () => {
    const { db } = await createTestDatabase();
    const workspace = await createTestWorkspace(db);
    const scope = workScopeFor(db, workspace);
    const result = await interpret({ ...workspace, db }, RESEARCH);
    const applied = await applyInstruction({
      scope,
      userId: workspace.owner.id,
      employeeName: workspace.employee.name,
      instruction: RESEARCH,
      result,
      paused: false,
      researchProvider: createFixtureProvider(),
    });

    const task = await getTaskForScope(scope, applied.taskId ?? "");
    expect(task?.status).toBe("completed");
    expect(task?.status).not.toBe("blocked");

    const artifacts = await listArtifactsForTask(scope, task?.id ?? "");
    const list = artifacts.find((item) => item.kind === "list");
    expect(list?.data?.type).toBe("research_results");
    const rows = Array.isArray(list?.data?.rows) ? list.data.rows : [];
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.length).toBeLessThan(10);
    expect(rows.length).toBe(list?.data?.found);
    for (const row of rows) {
      expect(row).toMatchObject({
        name: expect.any(String),
        website: expect.stringMatching(/^https:\/\//),
        whyMatch: expect.any(String),
        verification: expect.stringMatching(/verified|needs_review/),
      });
      expect(row.sources.length).toBeGreaterThan(0);
      expect(row.sources[0].url).toMatch(/^https:\/\//);
    }
    expect(rows.some((row) => /southside|thameside|brixton/i.test(String(row.name)))).toBe(true);
    expect(rows.every((row) => !/yell|plant hire/i.test(String(row.name)))).toBe(true);
    expect(new Set(rows.map((row) => new URL(String(row.website)).hostname)).size).toBe(
      rows.length,
    );

    const activity = await listActivity(scope, task?.id);
    expect(activity.some((item) => /Started company research/i.test(item.summary))).toBe(true);
    expect(activity.some((item) => /Searching for/i.test(item.summary))).toBe(true);
    expect(activity.some((item) => /Prepared \d+ results/i.test(item.summary))).toBe(true);
    expect(JSON.stringify(activity)).not.toMatch(/percent|80%|pages visited/i);

    const conversation = await getOrCreateConversation(scope);
    const messages = await listMessages(scope, conversation.id);
    expect(messages.some((item) => /I found \d+ companies/i.test(item.body))).toBe(true);

    const usage = await db.select().from(usageEvent).where(eq(usageEvent.employeeId, workspace.employee.id));
    expect(usage.some((item) => item.operation === "research_search")).toBe(true);
    expect(usage.some((item) => item.operation === "research_extract")).toBe(true);
  });

  it("drops directory hosts", () => {
    expect(isDirectoryHost("https://www.yell.com/ucs/UcsSearchAction.do")).toBe(true);
    expect(isDirectoryHost("https://southside-cleaning.example/commercial")).toBe(false);
  });

  it("stays honest when there are zero results", async () => {
    const { db } = await createTestDatabase();
    const workspace = await createTestWorkspace(db);
    const scope = workScopeFor(db, workspace);
    const result = await interpret({ ...workspace, db }, RESEARCH);
    const applied = await applyInstruction({
      scope,
      userId: workspace.owner.id,
      employeeName: workspace.employee.name,
      instruction: RESEARCH,
      result,
      paused: false,
      researchProvider: createFixtureProvider({ hits: [] }),
    });
    const task = await getTaskForScope(scope, applied.taskId ?? "");
    expect(task?.status).toBe("completed");
    const artifacts = await listArtifactsForTask(scope, task?.id ?? "");
    const list = artifacts.find((item) => item.kind === "list");
    expect(list?.data?.found).toBe(0);
    expect(list?.data?.rows).toEqual([]);
    const conversation = await getOrCreateConversation(scope);
    const messages = await listMessages(scope, conversation.id);
    expect(messages.some((item) => /couldn't verify any companies/i.test(item.body))).toBe(true);
    expect(messages.some((item) => /I found 10/i.test(item.body))).toBe(false);
  });

  it("blocks honestly on provider failure", async () => {
    const { db } = await createTestDatabase();
    const workspace = await createTestWorkspace(db);
    const scope = workScopeFor(db, workspace);
    const result = await interpret({ ...workspace, db }, RESEARCH);
    const applied = await applyInstruction({
      scope,
      userId: workspace.owner.id,
      employeeName: workspace.employee.name,
      instruction: RESEARCH,
      result,
      paused: false,
      researchProvider: createFixtureProvider({ fail: "unavailable" }),
    });
    const task = await getTaskForScope(scope, applied.taskId ?? "");
    expect(task?.status).toBe("blocked");
    expect(task?.blockedReason).toMatch(/unavailable/i);
    const artifacts = await listArtifactsForTask(scope, task?.id ?? "");
    expect(artifacts.some((item) => item.kind === "list")).toBe(false);
  });

  it("blocks honestly on provider timeout", async () => {
    const { db } = await createTestDatabase();
    const workspace = await createTestWorkspace(db);
    const scope = workScopeFor(db, workspace);
    const result = await interpret({ ...workspace, db }, RESEARCH);
    const applied = await applyInstruction({
      scope,
      userId: workspace.owner.id,
      employeeName: workspace.employee.name,
      instruction: RESEARCH,
      result,
      paused: false,
      researchProvider: createFixtureProvider({ fail: "timeout" }),
    });
    const task = await getTaskForScope(scope, applied.taskId ?? "");
    expect(task?.status).toBe("blocked");
    expect(task?.blockedReason).toMatch(/timed out/i);
  });

  it("blocks honestly on malformed provider output", async () => {
    const { db } = await createTestDatabase();
    const workspace = await createTestWorkspace(db);
    const scope = workScopeFor(db, workspace);
    const result = await interpret({ ...workspace, db }, RESEARCH);
    const applied = await applyInstruction({
      scope,
      userId: workspace.owner.id,
      employeeName: workspace.employee.name,
      instruction: RESEARCH,
      result,
      paused: false,
      researchProvider: createFixtureProvider({ fail: "malformed" }),
    });
    const task = await getTaskForScope(scope, applied.taskId ?? "");
    expect(task?.status).toBe("blocked");
    expect(task?.blockedReason).toMatch(/malformed/i);
  });

  it("does not complete a cancelled research run", async () => {
    const { db } = await createTestDatabase();
    const workspace = await createTestWorkspace(db);
    const scope = workScopeFor(db, workspace);
    const result = await interpret({ ...workspace, db }, RESEARCH);
    const applied = await applyInstruction({
      scope,
      userId: workspace.owner.id,
      employeeName: workspace.employee.name,
      instruction: RESEARCH,
      result,
      paused: false,
      researchProvider: createFixtureProvider({
        onSearch: async () => {
          const open = (await listTasks(scope)).find((item) => item.status === "running");
          if (open) {
            await setTaskStatus(scope, open.id, "cancelled");
          }
        },
      }),
    });
    const task = await getTaskForScope(scope, applied.taskId ?? "");
    expect(task?.status).toBe("cancelled");
    const artifacts = await listArtifactsForTask(scope, task?.id ?? "");
    expect(artifacts.some((item) => item.kind === "list")).toBe(false);
  });

  it("does not let webpage injection send email or change authority", async () => {
    const { db } = await createTestDatabase();
    const workspace = await createTestWorkspace(db);
    const scope = workScopeFor(db, workspace);
    const result = await interpret({ ...workspace, db }, RESEARCH);
    await applyInstruction({
      scope,
      userId: workspace.owner.id,
      employeeName: workspace.employee.name,
      instruction: RESEARCH,
      result,
      paused: false,
      researchProvider: createFixtureProvider(),
    });
    const approvals = await listApprovals(scope);
    expect(approvals.filter((item) => item.actionKind === "send_email")).toHaveLength(0);
    const send = await executeInternalTool(scope, "send_email", "{}");
    expect(send.ok).toBe(false);
    const follow = await interpret({ ...workspace, db }, "Which three look strongest?");
    expect(follow.kind).toBe("reply");
    if (follow.kind === "reply") {
      expect(follow.body).not.toMatch(/sending now|email sent|i('ve| have) sent/i);
    }
    expect(await executeInternalTool(scope, "send_email", "{}")).toMatchObject({ ok: false });
  });

  it("answers follow-ups from the persisted artifact", async () => {
    const { db } = await createTestDatabase();
    const workspace = await createTestWorkspace(db);
    const scope = workScopeFor(db, workspace);
    const result = await interpret({ ...workspace, db }, RESEARCH);
    const applied = await applyInstruction({
      scope,
      userId: workspace.owner.id,
      employeeName: workspace.employee.name,
      instruction: RESEARCH,
      result,
      paused: false,
      researchProvider: createFixtureProvider(),
    });
    const first = await getArtifactForScope(
      scope,
      (await listArtifactsForTask(scope, applied.taskId ?? "")).find((item) => item.kind === "list")
        ?.id ?? "",
    );
    expect(first).toBeTruthy();

    const strongest = await interpret({ ...workspace, db }, "Which three look strongest?");
    expect(strongest.kind).toBe("reply");
    if (strongest.kind === "reply") {
      expect(strongest.body).toMatch(/Southside|Thameside|Brixton/i);
    }

    const why = await interpret({ ...workspace, db }, "Why number 2?");
    expect(why.kind).toBe("reply");
    if (why.kind === "reply") {
      expect(why.body).toMatch(/Thameside|Southside|Brixton|because/i);
    }

    const filtered = await interpret({ ...workspace, db }, "Only show me the ones in Croydon.");
    await applyInstruction({
      scope,
      userId: workspace.owner.id,
      employeeName: workspace.employee.name,
      instruction: "Only show me the ones in Croydon.",
      result: filtered,
      paused: false,
    });
    const refined = await executeInternalTool(
      scope,
      "get_research_results",
      JSON.stringify({}),
    );
    expect(refined.ok).toBe(true);
    const rows = (refined.data as { rows: { location?: string; name: string }[] }).rows;
    expect(rows.every((row) => /croydon|south london/i.test(`${row.location ?? ""} ${row.name}`))).toBe(
      true,
    );

    const another = await interpret(
      { ...workspace, db },
      "Find me another 5 that aren't already on the list.",
    );
    expect(another.kind).toBe("work");
    const second = await applyInstruction({
      scope,
      userId: workspace.owner.id,
      employeeName: workspace.employee.name,
      instruction: "Find me another 5 that aren't already on the list.",
      result: another,
      paused: false,
      researchProvider: createFixtureProvider(),
    });
    const secondArtifacts = await listArtifactsForTask(scope, second.taskId ?? "");
    const secondList = secondArtifacts.find((item) => item.kind === "list");
    expect(secondList?.data?.found).toBe(0);
  });

  it("keeps strongest rows as a persisted revision", async () => {
    const { db } = await createTestDatabase();
    const workspace = await createTestWorkspace(db);
    const scope = workScopeFor(db, workspace);
    const result = await interpret({ ...workspace, db }, RESEARCH);
    const applied = await applyInstruction({
      scope,
      userId: workspace.owner.id,
      employeeName: workspace.employee.name,
      instruction: RESEARCH,
      result,
      paused: false,
      researchProvider: createFixtureProvider(),
    });
    const original = (await listArtifactsForTask(scope, applied.taskId ?? "")).find(
      (item) => item.kind === "list",
    );
    expect(original?.data?.revision).toBe(1);

    const take = await interpret({ ...workspace, db }, "Take the strongest 5.");
    await applyInstruction({
      scope,
      userId: workspace.owner.id,
      employeeName: workspace.employee.name,
      instruction: "Take the strongest 5.",
      result: take,
      paused: false,
    });
    const latest = await executeInternalTool(scope, "get_research_results", "{}");
    expect(latest.ok).toBe(true);
    const data = latest.data as {
      found: number;
      artifactId: string;
      rows: { name: string }[];
    };
    expect(data.found).toBeGreaterThan(0);
    expect(data.found).toBeLessThanOrEqual(5);
    const refined = await getArtifactForScope(scope, data.artifactId);
    expect(refined?.data?.parentArtifactId).toBe(original?.id);
    expect(refined?.data?.revision).toBe(2);
    expect(await getArtifactForScope(scope, original?.id ?? "")).toBeTruthy();
  });

  it("removes a numbered row without rewriting the original artifact", async () => {
    const { db } = await createTestDatabase();
    const workspace = await createTestWorkspace(db);
    const scope = workScopeFor(db, workspace);
    const result = await interpret({ ...workspace, db }, RESEARCH);
    const applied = await applyInstruction({
      scope,
      userId: workspace.owner.id,
      employeeName: workspace.employee.name,
      instruction: RESEARCH,
      result,
      paused: false,
      researchProvider: createFixtureProvider(),
    });
    const original = (await listArtifactsForTask(scope, applied.taskId ?? "")).find(
      (item) => item.kind === "list",
    );
    const before = Array.isArray(original?.data?.rows) ? original.data.rows : [];
    expect(before.length).toBeGreaterThan(1);
    const removedName = String((before[1] as { name?: string }).name ?? "");

    const remove = await interpret({ ...workspace, db }, "Remove number 2.");
    await applyInstruction({
      scope,
      userId: workspace.owner.id,
      employeeName: workspace.employee.name,
      instruction: "Remove number 2.",
      result: remove,
      paused: false,
    });
    const latest = await executeInternalTool(scope, "get_research_results", "{}");
    const rows = (latest.data as { rows: { name: string }[] }).rows;
    expect(rows.some((row) => row.name === removedName)).toBe(false);
    const kept = await getArtifactForScope(scope, original?.id ?? "");
    expect(Array.isArray(kept?.data?.rows) ? kept.data.rows.length : 0).toBe(before.length);
  });

  it("answers what was found earlier from the persisted list", async () => {
    const { db } = await createTestDatabase();
    const workspace = await createTestWorkspace(db);
    const scope = workScopeFor(db, workspace);
    const result = await interpret({ ...workspace, db }, RESEARCH);
    await applyInstruction({
      scope,
      userId: workspace.owner.id,
      employeeName: workspace.employee.name,
      instruction: RESEARCH,
      result,
      paused: false,
      researchProvider: createFixtureProvider(),
    });
    const earlier = await interpret({ ...workspace, db }, "What did you find earlier?");
    expect(earlier.kind).toBe("reply");
    if (earlier.kind === "reply") {
      expect(earlier.body).toMatch(/Southside|Thameside|Brixton/i);
      expect(earlier.body).not.toMatch(/I can help think that through/i);
    }
  });

  it("does not repeat companies already stored when asking for another set", async () => {
    const { db } = await createTestDatabase();
    const workspace = await createTestWorkspace(db);
    const scope = workScopeFor(db, workspace);
    const first = await interpret({ ...workspace, db }, RESEARCH);
    await applyInstruction({
      scope,
      userId: workspace.owner.id,
      employeeName: workspace.employee.name,
      instruction: RESEARCH,
      result: first,
      paused: false,
      researchProvider: createFixtureProvider(),
    });
    const extra = [
      ...FIXTURE_SOUTH_LONDON,
      {
        title: "Dulwich Commercial Clean — offices in South London",
        url: "https://dulwich-clean.example/",
        snippet:
          "Dulwich Commercial Clean provides contracted office cleaning across Dulwich and South London.",
      },
    ];
    const another = await interpret(
      { ...workspace, db },
      "Find me another 5, but don't repeat any companies you've already found.",
    );
    expect(another.kind).toBe("work");
    const second = await applyInstruction({
      scope,
      userId: workspace.owner.id,
      employeeName: workspace.employee.name,
      instruction: "Find me another 5, but don't repeat any companies you've already found.",
      result: another,
      paused: false,
      researchProvider: createFixtureProvider({
        hits: extra,
        pages: {
          "https://dulwich-clean.example/": {
            url: "https://dulwich-clean.example/",
            title: "Dulwich Commercial Clean",
            text: "Dulwich Commercial Clean. Commercial office cleaning in Dulwich, South London.",
          },
        },
      }),
    });
    const secondList = (await listArtifactsForTask(scope, second.taskId ?? "")).find(
      (item) => item.kind === "list",
    );
    const names = (Array.isArray(secondList?.data?.rows) ? secondList.data.rows : []).map(
      (row) => String((row as { name?: string }).name ?? ""),
    );
    expect(names.some((name) => /dulwich/i.test(name))).toBe(true);
    expect(names.some((name) => /southside|thameside|brixton/i.test(name))).toBe(false);
  });

  it("saves partial results when verification stops early", async () => {
    const { db } = await createTestDatabase();
    const workspace = await createTestWorkspace(db);
    const scope = workScopeFor(db, workspace);
    const result = await interpret({ ...workspace, db }, RESEARCH);
    const applied = await applyInstruction({
      scope,
      userId: workspace.owner.id,
      employeeName: workspace.employee.name,
      instruction: RESEARCH,
      result,
      paused: false,
      researchProvider: createFixtureProvider({ failExtract: "timeout" }),
    });
    const task = await getTaskForScope(scope, applied.taskId ?? "");
    expect(task?.status).toBe("completed");
    const list = (await listArtifactsForTask(scope, task?.id ?? "")).find(
      (item) => item.kind === "list",
    );
    expect(Number(list?.data?.found ?? 0)).toBeGreaterThan(0);
    const conversation = await getOrCreateConversation(scope);
    const messages = await listMessages(scope, conversation.id);
    expect(messages.some((item) => /stopped responding|are saved|is saved/i.test(item.body))).toBe(
      true,
    );
    expect(
      deriveCoreView({
        employeePaused: false,
        displayStatus: "idle",
        tasks: [task!],
        steps: await listStepsForTask(scope, task!.id),
        activity: await listActivity(scope, task!.id),
        artifacts: await listArtifactsForTask(scope, task!.id),
        pendingApprovals: 0,
      }).mood,
    ).not.toBe("working");
  });

  it("keeps earlier search hits when a later search times out", async () => {
    const { db } = await createTestDatabase();
    const workspace = await createTestWorkspace(db);
    const scope = workScopeFor(db, workspace);
    const result = await interpret({ ...workspace, db }, RESEARCH);
    const applied = await applyInstruction({
      scope,
      userId: workspace.owner.id,
      employeeName: workspace.employee.name,
      instruction: RESEARCH,
      result,
      paused: false,
      researchProvider: createFixtureProvider({ failAfterSearches: 1 }),
    });
    const task = await getTaskForScope(scope, applied.taskId ?? "");
    expect(task?.status).toBe("completed");
    const list = (await listArtifactsForTask(scope, task?.id ?? "")).find(
      (item) => item.kind === "list",
    );
    expect(Number(list?.data?.found ?? 0)).toBeGreaterThan(0);
  });

  it("seeds work without executing so Core can show real queued work", async () => {
    const { db } = await createTestDatabase();
    const workspace = await createTestWorkspace(db);
    const scope = workScopeFor(db, workspace);
    const result = await interpret({ ...workspace, db }, RESEARCH);
    const applied = await applyInstruction({
      scope,
      userId: workspace.owner.id,
      employeeName: workspace.employee.name,
      instruction: RESEARCH,
      result,
      paused: false,
      execute: false,
      researchProvider: createFixtureProvider(),
    });
    const seeded = await getTaskForScope(scope, applied.taskId ?? "");
    expect(seeded?.status).toBe("queued");
    expect(await listArtifactsForTask(scope, seeded?.id ?? "")).toHaveLength(0);
    const seededView = deriveCoreView({
      employeePaused: false,
      displayStatus: "working",
      tasks: [seeded!],
      steps: await listStepsForTask(scope, seeded!.id),
      activity: await listActivity(scope, seeded!.id),
      artifacts: [],
      pendingApprovals: 0,
    });
    expect(seededView.mood).toBe("working");
    expect(seededView.mood).not.toBe("completed");

    await executeExistingTask(scope, seeded!.id, createFixtureProvider());
    const finished = await getTaskForScope(scope, seeded!.id);
    expect(finished?.status).toBe("completed");
    const artifacts = await listArtifactsForTask(scope, seeded!.id);
    expect(artifacts.some((item) => item.data?.type === "research_results")).toBe(true);
    const doneView = deriveCoreView({
      employeePaused: false,
      displayStatus: "idle",
      tasks: [finished!],
      steps: await listStepsForTask(scope, finished!.id),
      activity: await listActivity(scope, finished!.id),
      artifacts,
      pendingApprovals: 0,
      now: new Date(),
    });
    expect(doneView.mood).toBe("completed");
  });

  it("denies cross-tenant artifact access", async () => {
    const { db } = await createTestDatabase();
    const orgA = await createTestWorkspace(db, { email: "a@example.com" });
    const orgB = await createTestWorkspace(db, { email: "b@example.com" });
    const scopeA = workScopeFor(db, orgA);
    const scopeB = workScopeFor(db, orgB);
    const result = await interpret({ ...orgA, db }, RESEARCH);
    const applied = await applyInstruction({
      scope: scopeA,
      userId: orgA.owner.id,
      employeeName: orgA.employee.name,
      instruction: RESEARCH,
      result,
      paused: false,
      researchProvider: createFixtureProvider(),
    });
    const artifact = (await listArtifactsForTask(scopeA, applied.taskId ?? "")).find(
      (item) => item.kind === "list",
    );
    expect(await getArtifactForScope(scopeB, artifact?.id ?? "missing")).toBeNull();
    const leaked = await executeInternalTool(
      scopeB,
      "get_research_results",
      JSON.stringify({ artifactId: artifact?.id }),
    );
    expect(leaked.data).toEqual({ error: "not found" });
  });
});

describe("Tavily adapter", () => {
  it("maps search hits and extract pages without a live key", async () => {
    const provider = createTavilyProvider({
      apiKey: "tvly-test",
      fetchImpl: async (url) => {
        const path = String(url);
        if (path.endsWith("/search")) {
          return new Response(
            JSON.stringify({
              results: [
                {
                  title: "Example Cleaners",
                  url: "https://example-cleaners.test/",
                  content: "Commercial cleaning in South London.",
                },
              ],
            }),
            { status: 200 },
          );
        }
        return new Response(
          JSON.stringify({
            results: [
              {
                url: "https://example-cleaners.test/",
                title: "Example Cleaners",
                raw_content: "We clean offices in Croydon.",
              },
            ],
          }),
          { status: 200 },
        );
      },
    });
    const hits = await provider.search("commercial cleaning South London", 5);
    expect(hits).toEqual([
      {
        title: "Example Cleaners",
        url: "https://example-cleaners.test/",
        snippet: "Commercial cleaning in South London.",
      },
    ]);
    const pages = await provider.extract(["https://example-cleaners.test/"]);
    expect(pages[0]?.text).toMatch(/Croydon/);
  });

  it("maps HTTP 429 to a rate limit error", async () => {
    const provider = createTavilyProvider({
      apiKey: "tvly-test",
      fetchImpl: async () => new Response("slow down", { status: 429 }),
    });
    await expect(provider.search("cleaning", 3)).rejects.toMatchObject({ code: "rate_limit" });
  });

  it("does not treat fixture listings as live search HTML", () => {
    expect(FIXTURE_SOUTH_LONDON.some((item) => item.url.includes("google.com/search"))).toBe(
      false,
    );
  });
});
