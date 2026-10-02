import type { Artifact } from "@/platform/db/schema";

export type ResearchRowPreview = {
  name: string;
  location: string | null;
  website: string | null;
  whyMatch: string | null;
  verification: "verified" | "needs_review" | null;
  source: string | null;
};

export function researchRowsFromArtifact(artifact?: Artifact | null): {
  found: number;
  verified: number | undefined;
  needsReview: number | undefined;
  rows: ResearchRowPreview[];
} | null {
  const data = artifact?.data;
  if (!data || data.type !== "research_results") {
    return null;
  }
  const raw = Array.isArray(data.rows) ? data.rows : [];
  const rows = raw.map(toPreview).filter((row): row is ResearchRowPreview => Boolean(row));
  return {
    found: typeof data.found === "number" ? data.found : rows.length,
    verified: typeof data.verified === "number" ? data.verified : undefined,
    needsReview: typeof data.needsReview === "number" ? data.needsReview : undefined,
    rows,
  };
}

export function ResearchResultPreview({
  artifact,
  emptyLabel,
  limit = 3,
}: {
  artifact?: Artifact;
  emptyLabel: string;
  limit?: number;
}) {
  const research = researchRowsFromArtifact(artifact);
  if (!research || research.rows.length === 0) {
    return (
      <div className="mt-5 border-t border-line pt-4">
        <p className="text-[0.68rem] tracking-[0.16em] text-ink-soft uppercase">
          Results
        </p>
        <p className="mt-2 text-sm leading-relaxed text-ink-soft">{emptyLabel}</p>
      </div>
    );
  }

  return (
    <div className="mt-5 border-t border-line pt-4">
      <p className="text-[0.68rem] tracking-[0.16em] text-ink-soft uppercase">
        Results
      </p>
      <p className="mt-2 text-sm text-ink">
        {research.found} {research.found === 1 ? "company" : "companies"}
        {research.verified !== undefined ? ` · ${research.verified} verified` : ""}
        {research.needsReview ? ` · ${research.needsReview} need review` : ""}
      </p>
      <ul className="mt-3 flex flex-col gap-3">
        {research.rows.slice(0, limit).map((row) => (
          <li key={`${row.name}-${row.website ?? ""}`} className="text-sm">
            <p className="text-ink">
              {row.name}
              {row.location ? (
                <span className="text-ink-soft">{` · ${row.location}`}</span>
              ) : null}
            </p>
            {row.whyMatch ? (
              <p className="mt-1 text-ink-soft">{clip(row.whyMatch, 110)}</p>
            ) : null}
            <p className="mt-1 text-[0.78rem] text-ink-soft">
              {verificationLabel(row.verification)}
              {row.website ? ` · ${displayHost(row.website)}` : ""}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ResearchResultList({ artifact }: { artifact: Artifact }) {
  const research = researchRowsFromArtifact(artifact);
  if (!research || research.rows.length === 0) {
    return artifact.body ? (
      <p className="mt-3 max-w-xl text-sm leading-relaxed text-ink-soft">
        {artifact.body}
      </p>
    ) : null;
  }

  return (
    <div className="mt-4">
      <p className="text-sm text-ink">
        {research.found} {research.found === 1 ? "company" : "companies"}
        {research.verified !== undefined ? ` · ${research.verified} verified` : ""}
        {research.needsReview ? ` · ${research.needsReview} need review` : ""}
      </p>
      <ol className="mt-4 divide-y divide-line border-y border-line">
        {research.rows.map((row, index) => (
          <li key={`${row.website ?? row.name}-${index}`} className="py-4">
            <p className="text-sm text-ink">
              {index + 1}. {row.name}
            </p>
            <dl className="mt-2 grid gap-1 text-sm text-ink-soft sm:grid-cols-[7.5rem_minmax(0,1fr)]">
              {row.location ? (
                <>
                  <dt>Location</dt>
                  <dd className="text-ink">{row.location}</dd>
                </>
              ) : null}
              {row.website ? (
                <>
                  <dt>Website</dt>
                  <dd>
                    <a
                      href={row.website}
                      className="text-accent break-all hover:text-accent-hover"
                      rel="noreferrer"
                    >
                      {displayHost(row.website)}
                    </a>
                  </dd>
                </>
              ) : null}
              {row.whyMatch ? (
                <>
                  <dt>Why it matches</dt>
                  <dd className="text-ink">{row.whyMatch}</dd>
                </>
              ) : null}
              <dt>Verification</dt>
              <dd className="text-ink">{verificationLabel(row.verification)}</dd>
              {row.source ? (
                <>
                  <dt>Source</dt>
                  <dd>
                    <a
                      href={row.source}
                      className="text-accent break-all hover:text-accent-hover"
                      rel="noreferrer"
                    >
                      {displayHost(row.source)}
                    </a>
                  </dd>
                </>
              ) : null}
            </dl>
          </li>
        ))}
      </ol>
    </div>
  );
}

function toPreview(value: unknown): ResearchRowPreview | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  const row = value as Record<string, unknown>;
  const name = String(row.name ?? row.title ?? "").trim();
  if (!name) {
    return null;
  }
  const sources = Array.isArray(row.sources) ? row.sources : [];
  const first = sources[0];
  const sourceUrl =
    first && typeof first === "object" && first !== null && "url" in first
      ? String((first as { url?: string }).url ?? "")
      : "";
  const verification =
    row.verification === "verified" || row.verification === "needs_review"
      ? row.verification
      : null;
  return {
    name,
    location: row.location ? String(row.location) : null,
    website: row.website ? String(row.website) : null,
    whyMatch: row.whyMatch ? String(row.whyMatch) : null,
    verification,
    source: sourceUrl || null,
  };
}

function verificationLabel(value: ResearchRowPreview["verification"]): string {
  if (value === "verified") {
    return "Verified";
  }
  if (value === "needs_review") {
    return "Needs review";
  }
  return "Unverified";
}

function displayHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url.replace(/^https?:\/\//, "").replace(/\/$/, "");
  }
}

function clip(value: string, max: number): string {
  const trimmed = value.trim();
  if (trimmed.length <= max) {
    return trimmed;
  }
  return `${trimmed.slice(0, max - 1).trim()}…`;
}
