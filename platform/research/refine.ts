import { createArtifact } from "../work/commands";
import { getArtifactForScope, listArtifactsSince } from "../work/queries";
import type { WorkScope } from "../work/scope";
import {
  researchArtifactDataSchema,
  refineResearchSchema,
  type ProspectRow,
  type ResearchArtifactData,
} from "./schema";

function isResearchResultsArtifact(item: {
  kind: string;
  data: unknown;
}): boolean {
  return (
    item.kind === "list" &&
    Boolean(item.data) &&
    (item.data as { type?: string }).type === "research_results"
  );
}

function researchRowCount(data: unknown): number {
  const parsed = researchArtifactDataSchema.safeParse(data);
  return parsed.success ? parsed.data.rows.length : 0;
}

export async function latestResearchArtifact(scope: WorkScope, artifactId?: string) {
  if (artifactId) {
    const exact = await getArtifactForScope(scope, artifactId);
    if (exact && isResearchResultsArtifact(exact)) {
      return exact;
    }
    return null;
  }
  const artifacts = await listArtifactsSince(scope, new Date(0));
  const research = artifacts.filter(isResearchResultsArtifact);
  // Prefer a non-empty list so a failed re-research (0 rows) cannot hide prior results.
  return (
    research.find((item) => researchRowCount(item.data) > 0) ?? research[0] ?? null
  );
}

export async function refineResearchResults(
  scope: WorkScope,
  taskId: string,
  raw: unknown,
): Promise<{ ok: true; data: ResearchArtifactData; summary: string } | { ok: false; reason: string }> {
  const parsed = refineResearchSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, reason: "That result change could not be validated." };
  }
  const source = await latestResearchArtifact(scope, parsed.data.artifactId);
  if (!source?.data) {
    return { ok: false, reason: "There is no research list to change." };
  }
  const current = researchArtifactDataSchema.safeParse(source.data);
  if (!current.success) {
    return { ok: false, reason: "The stored research list is unreadable." };
  }
  let rows: ProspectRow[] = [...current.data.rows];
  if (parsed.data.action === "exclude_index" && parsed.data.index) {
    rows = rows.filter((_, index) => index + 1 !== parsed.data.index);
  } else if (parsed.data.action === "keep_indexes" && parsed.data.indexes) {
    const keep = new Set(parsed.data.indexes);
    rows = rows.filter((_, index) => keep.has(index + 1));
  } else if (parsed.data.action === "keep_strongest") {
    const count = parsed.data.count ?? 3;
    const selected = new Set(strongestRows(current.data, count).map((row) => row.id));
    rows = current.data.rows.filter((row) => selected.has(row.id));
  } else if (parsed.data.action === "keep_location" && parsed.data.location) {
    const needle = parsed.data.location.toLowerCase();
    rows = rows.filter((row) =>
      `${row.location ?? ""} ${row.whyMatch} ${row.description ?? ""}`.toLowerCase().includes(needle),
    );
  } else {
    return { ok: false, reason: "Say which rows or location to keep." };
  }

  const data: ResearchArtifactData = {
    ...current.data,
    found: rows.length,
    verified: rows.filter((row) => row.verification === "verified").length,
    needsReview: rows.filter((row) => row.verification === "needs_review").length,
    parentArtifactId: source.id,
    revision: current.data.revision + 1,
    rows,
  };
  const checked = researchArtifactDataSchema.safeParse(data);
  if (!checked.success) {
    return { ok: false, reason: "Refined results failed validation." };
  }
  await createArtifact(scope, {
    taskId,
    kind: "list",
    title: "Research results",
    body: `${rows.length} companies · ${data.verified} verified · ${data.needsReview} need review`,
    data: checked.data,
  });
  return {
    ok: true,
    data: checked.data,
    summary: `Updated the list to ${rows.length} ${rows.length === 1 ? "company" : "companies"}. The earlier results are still kept.`,
  };
}

export function strongestRows(data: ResearchArtifactData, count = 3): ProspectRow[] {
  return [...data.rows]
    .sort((left, right) => {
      if (left.verification !== right.verification) {
        return left.verification === "verified" ? -1 : 1;
      }
      return right.sources.length - left.sources.length;
    })
    .slice(0, count);
}
