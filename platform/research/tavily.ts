import {
  ResearchProviderError,
  type ExtractedPage,
  type ResearchProvider,
  type SearchHit,
} from "./provider";
import { RESEARCH_LIMITS } from "./schema";

type TavilySearchResponse = {
  results?: Array<{
    title?: string;
    url?: string;
    content?: string;
  }>;
};

type TavilyExtractResponse = {
  results?: Array<{
    url?: string;
    raw_content?: string;
    title?: string;
  }>;
};

export function createTavilyProvider(input?: {
  apiKey?: string;
  fetchImpl?: typeof fetch;
}): ResearchProvider {
  const apiKey =
    input?.apiKey ??
    process.env.VOXA_RESEARCH_API_KEY ??
    process.env.TAVILY_API_KEY ??
    "";
  const fetchImpl = input?.fetchImpl ?? fetch;

  async function request<T>(path: string, body: Record<string, unknown>): Promise<T> {
    if (!apiKey) {
      throw new ResearchProviderError("unconfigured", "Research is not connected.");
    }
    let response: Response;
    try {
      response = await fetchImpl(`https://api.tavily.com${path}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(20_000),
      });
    } catch (error) {
      if (error instanceof Error && /timeout|abort/i.test(error.message + error.name)) {
        throw new ResearchProviderError("timeout", "The research service timed out.");
      }
      throw new ResearchProviderError("unavailable", "The research service is unavailable.");
    }
    if (response.status === 429) {
      throw new ResearchProviderError("rate_limit", "The research service is rate-limited.");
    }
    if (!response.ok) {
      throw new ResearchProviderError("unavailable", "The research service is unavailable.");
    }
    try {
      return (await response.json()) as T;
    } catch {
      throw new ResearchProviderError("malformed", "The research service returned an unreadable response.");
    }
  }

  return {
    id: "tavily",
    async search(query: string, limit: number): Promise<SearchHit[]> {
      const payload = await request<TavilySearchResponse>("/search", {
        query,
        search_depth: "basic",
        max_results: Math.min(Math.max(limit, 5), 10),
        include_answer: false,
        include_raw_content: false,
      });
      if (!Array.isArray(payload.results)) {
        throw new ResearchProviderError("malformed", "Search results were malformed.");
      }
      return payload.results
        .map((item) => ({
          title: (item.title ?? "").trim(),
          url: (item.url ?? "").trim(),
          snippet: (item.content ?? "").trim().slice(0, 600),
        }))
        .filter((item) => item.title && /^https:\/\//i.test(item.url));
    },
    async extract(urls: string[]): Promise<ExtractedPage[]> {
      if (urls.length === 0) {
        return [];
      }
      const payload = await request<TavilyExtractResponse>("/extract", {
        urls: urls.slice(0, RESEARCH_LIMITS.maxExtracts),
        extract_depth: "basic",
      });
      const rows = Array.isArray(payload.results) ? payload.results : [];
      return rows
        .map((item) => ({
          url: (item.url ?? "").trim(),
          title: item.title?.trim() || null,
          text: (item.raw_content ?? "").replace(/\s+/g, " ").trim().slice(0, RESEARCH_LIMITS.extractChars),
        }))
        .filter((item) => /^https:\/\//i.test(item.url));
    },
  };
}
