export type SearchHit = {
  title: string;
  url: string;
  snippet: string;
};

export type ExtractedPage = {
  url: string;
  title: string | null;
  text: string;
};

export type ResearchProviderErrorCode =
  | "unavailable"
  | "timeout"
  | "rate_limit"
  | "malformed"
  | "unconfigured";

export class ResearchProviderError extends Error {
  readonly code: ResearchProviderErrorCode;

  constructor(code: ResearchProviderErrorCode, message: string) {
    super(message);
    this.name = "ResearchProviderError";
    this.code = code;
  }
}

export interface ResearchProvider {
  readonly id: string;
  search(query: string, limit: number): Promise<SearchHit[]>;
  extract(urls: string[]): Promise<ExtractedPage[]>;
}

export function hasResearchApiKey(
  source: NodeJS.ProcessEnv = process.env,
): boolean {
  return Boolean(source.VOXA_RESEARCH_API_KEY || source.TAVILY_API_KEY);
}

export function resolveResearchKind(
  source: NodeJS.ProcessEnv = process.env,
): "ready" | "test" | "unconfigured" {
  const explicit = source.VOXA_RESEARCH_ADAPTER;
  if (explicit === "test" || explicit === "fixture") {
    return "test";
  }
  if (explicit === "unconfigured") {
    return "unconfigured";
  }
  if (hasResearchApiKey(source)) {
    return "ready";
  }
  return "unconfigured";
}

export function isWebResearchAvailable(
  source: NodeJS.ProcessEnv = process.env,
): boolean {
  return resolveResearchKind(source) !== "unconfigured";
}
