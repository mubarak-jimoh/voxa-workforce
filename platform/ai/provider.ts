import type { ModelAdapter } from "./adapter";
import { MODEL_NOT_CONFIGURED_MESSAGE } from "./adapter";
import { createHeuristicAdapter } from "./heuristic";
import { createOpenAIAdapter } from "./openai";

export type ModelProviderStatus = "unconfigured" | "ready" | "test";

export function hasModelApiKey(
  source: NodeJS.ProcessEnv = process.env,
): boolean {
  return Boolean(source.VOXA_MODEL_API_KEY || source.OPENAI_API_KEY);
}

export function resolveModelAdapterKind(
  source: NodeJS.ProcessEnv = process.env,
): ModelProviderStatus {
  const explicit = source.VOXA_MODEL_ADAPTER;
  if (explicit === "test" || explicit === "heuristic") {
    return "test";
  }
  if (explicit === "unconfigured") {
    return "unconfigured";
  }
  if (source.VITEST === "true" || source.NODE_ENV === "test") {
    if (explicit === "openai" && hasModelApiKey(source)) {
      return "ready";
    }
    return "test";
  }
  if (explicit === "openai" || hasModelApiKey(source)) {
    return hasModelApiKey(source) ? "ready" : "unconfigured";
  }
  return "unconfigured";
}

export function modelProviderStatus(
  source: NodeJS.ProcessEnv = process.env,
): Exclude<ModelProviderStatus, "test"> | "test" {
  const kind = resolveModelAdapterKind(source);
  if (kind === "ready") {
    return "ready";
  }
  if (kind === "test") {
    return "test";
  }
  return "unconfigured";
}

export function modelProviderNote(
  source: NodeJS.ProcessEnv = process.env,
): string {
  const kind = resolveModelAdapterKind(source);
  if (kind === "ready") {
    return "A model provider is configured.";
  }
  if (kind === "test") {
    return "Avery is using the explicit test adapter. This is not a production model.";
  }
  return MODEL_NOT_CONFIGURED_MESSAGE;
}

export function createConfiguredAdapter(
  source: NodeJS.ProcessEnv = process.env,
): ModelAdapter | null {
  const kind = resolveModelAdapterKind(source);
  if (kind === "ready") {
    return createOpenAIAdapter();
  }
  if (kind === "test") {
    return createHeuristicAdapter();
  }
  return null;
}
