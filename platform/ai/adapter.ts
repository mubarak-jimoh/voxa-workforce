import type { InterpreterResult } from "./types";

export type ChatRole = "system" | "user" | "assistant";

export type ChatMessage = {
  role: ChatRole;
  content: string;
};

export type ModelUsage = {
  inputTokens: number;
  outputTokens: number;
  model: string;
  provider: string;
};

export type ModelCompletion = {
  raw: unknown;
  usage: ModelUsage;
};

export type ModelRequest = {
  messages: ChatMessage[];
  jsonSchema: unknown;
  schemaName: string;
  timeoutMs?: number;
};

export interface ModelAdapter {
  readonly id: string;
  complete(request: ModelRequest): Promise<ModelCompletion>;
}

export function decisionToInterpreterResult(
  result: InterpreterResult,
): InterpreterResult {
  return result;
}

export const USER_FACING_PROVIDER_ERROR =
  "Avery couldn't respond just now. Try again.";

export const MODEL_NOT_CONFIGURED_MESSAGE =
  "I'm not connected to a language model yet. Add OPENAI_API_KEY on the server to enable Avery.";
