import { createFixtureProvider } from "./fixture";
import { resolveResearchKind, type ResearchProvider } from "./provider";
import { createTavilyProvider } from "./tavily";

export function createConfiguredResearchProvider(
  source: NodeJS.ProcessEnv = process.env,
): ResearchProvider | null {
  const kind = resolveResearchKind(source);
  if (kind === "test") {
    return createFixtureProvider();
  }
  if (kind === "ready") {
    return createTavilyProvider();
  }
  return null;
}
