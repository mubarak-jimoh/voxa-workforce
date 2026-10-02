import { persistUsage } from "../ai/usage";
import { createArtifact, recordActivity, setStepStatus } from "../work/commands";
import { isPastDue } from "../work/deadline";
import { getTaskForScope, listArtifactsSince } from "../work/queries";
import type { WorkScope } from "../work/scope";
import { newId } from "../work/scope";
import type { ExtractedPage, ResearchProvider } from "./provider";
import { ResearchProviderError } from "./provider";
import {
  companyNameFromTitle,
  formulateQueries,
  hostnameOf,
  isDirectoryHost,
  isPublicHttpUrl,
  locationMatches,
  parseBrief,
  relevanceMatches,
  websiteOrigin,
  wrapUntrusted,
} from "./quality";
import {
  researchArtifactDataSchema,
  researchInputSchema,
  type ProspectRow,
  type ResearchArtifactData,
  type ResearchInput,
} from "./schema";
import { RESEARCH_LIMITS } from "./schema";

export type ResearchRunResult =
  | { ok: true; artifactId: string; data: ResearchArtifactData; summary: string }
  | { ok: false; code: "cancelled" | "blocked"; reason: string };

function uniqueHost(url: string, seen: Set<string>): boolean {
  const host = hostnameOf(url);
  if (!host || seen.has(host)) {
    return false;
  }
  seen.add(host);
  return true;
}

function buildWhy(input: {
  name: string;
  locationHit: "yes" | "maybe" | "no";
  location: string | null;
  relevant: boolean;
}): string {
  const bits: string[] = [];
  if (input.relevant) {
    bits.push("Source describes commercial cleaning");
  }
  if (input.locationHit === "yes" && input.location) {
    bits.push(`location matches ${input.location}`);
  } else if (input.locationHit === "maybe" && input.location) {
    bits.push(`location is only loosely tied to ${input.location}`);
  }
  return bits.join("; ") || `${input.name} appeared in search results for the brief.`;
}

async function stillRunnable(scope: WorkScope, taskId: string): Promise<boolean> {
  const task = await getTaskForScope(scope, taskId);
  return Boolean(task && !["cancelled", "paused"].includes(task.status));
}

async function taskDueAt(scope: WorkScope, taskId: string): Promise<Date | null> {
  const task = await getTaskForScope(scope, taskId);
  return task?.dueAt ?? null;
}

export async function runResearchPipeline(input: {
  scope: WorkScope;
  taskId: string;
  runId: string;
  stepId: string;
  instruction: string;
  provider: ResearchProvider;
  requested?: Partial<ResearchInput>;
}): Promise<ResearchRunResult> {
  const brief = parseBrief(input.instruction);
  const parsed = researchInputSchema.safeParse({
    query: input.requested?.query || brief.query,
    objective: input.requested?.objective || input.instruction.slice(0, 500),
    location: input.requested?.location || brief.location || undefined,
    limit: input.requested?.limit ?? brief.limit,
    excludeHosts: input.requested?.excludeHosts,
  });
  if (!parsed.success) {
    return { ok: false, code: "blocked", reason: "The research brief could not be validated." };
  }
  const request = parsed.data;
  const limit = request.limit ?? brief.limit;
  const location = request.location ?? brief.location;
  const existing = await listArtifactsSince(input.scope, new Date(0));
  const priorHosts = new Set(
    existing.flatMap((item) => {
      const rows = item.data && Array.isArray(item.data.rows) ? item.data.rows : [];
      return rows
        .map((row) =>
          row && typeof row === "object" && "website" in row
            ? hostnameOf(String((row as { website?: string }).website ?? ""))
            : null,
        )
        .filter((host): host is string => Boolean(host));
    }),
  );
  for (const host of request.excludeHosts ?? []) {
    priorHosts.add(host.toLowerCase());
  }

  const queries = formulateQueries({
    query: request.query,
    location,
    terms: brief.terms,
  });

  await recordActivity(input.scope, {
    taskId: input.taskId,
    runId: input.runId,
    stepId: input.stepId,
    kind: "progress",
    summary: `Started company research${location ? ` in ${location}` : ""}.`,
  });

  const hits = [];
  let searchCalls = 0;
  try {
    for (const query of queries) {
      if (!(await stillRunnable(input.scope, input.taskId))) {
        return { ok: false, code: "cancelled", reason: "Research was cancelled." };
      }
      await recordActivity(input.scope, {
        taskId: input.taskId,
        runId: input.runId,
        stepId: input.stepId,
        kind: "progress",
        summary: `Searching for ${query}.`,
      });
      const batch = await input.provider.search(query, 10);
      searchCalls += 1;
      hits.push(...batch);
      await persistUsage(input.scope, {
        usage: {
          provider: input.provider.id,
          model: `${input.provider.id}-search`,
          inputTokens: 0,
          outputTokens: 0,
        },
        operation: "research_search",
        estimatedCostUsd: "0.008",
      });
      if (searchCalls >= RESEARCH_LIMITS.maxSearches) {
        break;
      }
    }
  } catch (error) {
    const reason =
      error instanceof ResearchProviderError
        ? error.message
        : "I couldn't complete the research because the web service is unavailable.";
    if (hits.length === 0) {
      return { ok: false, code: "blocked", reason };
    }
    await recordActivity(input.scope, {
      taskId: input.taskId,
      runId: input.runId,
      stepId: input.stepId,
      kind: "progress",
      summary: "Search stopped early. I'll keep the sources already found.",
    });
  }

  const seen = new Set<string>();
  const candidates = hits.filter((hit) => {
    if (!isPublicHttpUrl(hit.url) || isDirectoryHost(hit.url)) {
      return false;
    }
    const host = hostnameOf(hit.url);
    if (!host || priorHosts.has(host)) {
      return false;
    }
    return uniqueHost(hit.url, seen);
  });

  await recordActivity(input.scope, {
    taskId: input.taskId,
    runId: input.runId,
    stepId: input.stepId,
    kind: "progress",
    summary: `Found ${candidates.length} candidate source${candidates.length === 1 ? "" : "s"}.`,
  });

  if (!(await stillRunnable(input.scope, input.taskId))) {
    return { ok: false, code: "cancelled", reason: "Research was cancelled." };
  }

  const extractUrls = candidates.slice(0, Math.min(RESEARCH_LIMITS.maxExtracts, Math.max(limit + 2, 6))).map((item) => item.url);
  let pages: ExtractedPage[] = [];
  try {
    if (extractUrls.length > 0) {
      await recordActivity(input.scope, {
        taskId: input.taskId,
        runId: input.runId,
        stepId: input.stepId,
        kind: "progress",
        summary: "Verifying candidate businesses.",
      });
      pages = await input.provider.extract(extractUrls);
      await persistUsage(input.scope, {
        usage: {
          provider: input.provider.id,
          model: `${input.provider.id}-extract`,
          inputTokens: 0,
          outputTokens: 0,
        },
        operation: "research_extract",
        estimatedCostUsd: (extractUrls.length * 0.005).toFixed(3),
      });
    }
  } catch (error) {
    if (candidates.length === 0) {
      const reason =
        error instanceof ResearchProviderError
          ? error.message
          : "I couldn't complete the research because the web service is unavailable.";
      return { ok: false, code: "blocked", reason };
    }
    pages = [];
    await recordActivity(input.scope, {
      taskId: input.taskId,
      runId: input.runId,
      stepId: input.stepId,
      kind: "progress",
      summary: "Verification stopped early. I'll keep only what I could already check.",
    });
  }

  const pageByUrl = new Map(pages.map((page) => [page.url, page]));
  const rows: ProspectRow[] = [];
  const nowIso = new Date().toISOString();
  const dueAt = await taskDueAt(input.scope, input.taskId);
  let stoppedForDeadline = false;

  for (const hit of candidates) {
    if (rows.length >= limit) {
      break;
    }
    if (isPastDue(dueAt)) {
      stoppedForDeadline = true;
      break;
    }
    if (!(await stillRunnable(input.scope, input.taskId))) {
      return { ok: false, code: "cancelled", reason: "Research was cancelled." };
    }
    const page = pageByUrl.get(hit.url);
    const evidence = `${hit.title} ${hit.snippet} ${page?.text ?? ""}`;
    void wrapUntrusted(page?.text ?? hit.snippet);
    const relevant = relevanceMatches(evidence, brief.terms.length > 0 ? brief.terms : ["clean"]);
    if (!relevant) {
      continue;
    }
    const locationHit = locationMatches(evidence, location);
    if (locationHit === "no") {
      continue;
    }
    const website = websiteOrigin(hit.url);
    if (!website) {
      continue;
    }
    const name = companyNameFromTitle(page?.title || hit.title);
    const verified = relevant && locationHit === "yes" && Boolean(page?.text);
    rows.push({
      id: newId(),
      name,
      website,
      location: locationHit === "yes" ? location : null,
      description: (page?.text || hit.snippet).slice(0, 220) || null,
      whyMatch: buildWhy({ name, locationHit, location, relevant }),
      verification: verified ? "verified" : "needs_review",
      sources: [
        {
          url: hit.url,
          title: hit.title.slice(0, 240),
        },
      ],
      researchedAt: nowIso,
    });
  }

  const data: ResearchArtifactData = {
    type: "research_results",
    objective: request.objective ?? request.query,
    location,
    requested: limit,
    found: rows.length,
    verified: rows.filter((row) => row.verification === "verified").length,
    needsReview: rows.filter((row) => row.verification === "needs_review").length,
    parentArtifactId: null,
    revision: 1,
    researchedAt: nowIso,
    searchCalls,
    extractCalls: extractUrls.length,
    provider: input.provider.id,
    rows,
  };
  const checked = researchArtifactDataSchema.safeParse(data);
  if (!checked.success) {
    return { ok: false, code: "blocked", reason: "Research results failed validation." };
  }

  if (!(await stillRunnable(input.scope, input.taskId))) {
    return { ok: false, code: "cancelled", reason: "Research was cancelled." };
  }

  const artifact = await createArtifact(input.scope, {
    taskId: input.taskId,
    kind: "list",
    title: "Research results",
    body:
      rows.length === 0
        ? "No companies I could verify from public sources."
        : `${rows.length} companies · ${data.verified} verified · ${data.needsReview} need review`,
    data: checked.data,
  });

  const interrupted = extractUrls.length > 0 && pages.length === 0 && rows.length > 0;
  const remaining = Math.max(0, limit - rows.length);
  const summary =
    rows.length === 0
      ? "I couldn't verify any companies from public sources, so I stopped rather than inventing a list."
      : stoppedForDeadline
        ? `I found ${rows.length} verified companies before the deadline. I couldn't verify the remaining ${remaining}.`
        : interrupted
        ? `I couldn't finish the research because the research service stopped responding. The ${rows.length} ${rows.length === 1 ? "result" : "results"} I verified before that point ${rows.length === 1 ? "is" : "are"} saved.`
        : rows.length < limit
          ? `I found ${rows.length} companies I could verify. I stopped at ${rows.length} rather than filling the list with weak results.`
          : `I found ${rows.length} companies matching the brief. ${data.verified} ${data.verified === 1 ? "is" : "are"} well verified; ${data.needsReview} need review.`;

  if (stoppedForDeadline) {
    await recordActivity(input.scope, {
      taskId: input.taskId,
      runId: input.runId,
      stepId: input.stepId,
      kind: "progress",
      summary: `Stopped at the deadline with ${rows.length} of ${limit} requested.`,
    });
  }

  await recordActivity(input.scope, {
    taskId: input.taskId,
    runId: input.runId,
    stepId: input.stepId,
    kind: "progress",
    summary: rows.length === 0 ? "Prepared 0 results." : `Prepared ${rows.length} results.`,
  });
  await setStepStatus(input.scope, input.stepId, "completed");

  return { ok: true, artifactId: artifact.id, data: checked.data, summary };
}
