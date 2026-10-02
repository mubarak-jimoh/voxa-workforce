import { AppError } from "../errors";
import {
  USER_FACING_PROVIDER_ERROR,
  type ModelAdapter,
  type ModelCompletion,
  type ModelRequest,
} from "./adapter";

export class ProviderError extends AppError {
  readonly causeCode: string;

  constructor(causeCode: string, message = USER_FACING_PROVIDER_ERROR) {
    super("provider", message, 503);
    this.name = "ProviderError";
    this.causeCode = causeCode;
  }
}

export function classifyProviderFailure(error: unknown): ProviderError {
  if (error instanceof ProviderError) {
    return error;
  }
  if (error instanceof Error) {
    const name = error.name.toLowerCase();
    const text = error.message.toLowerCase();
    if (name.includes("abort") || text.includes("timeout") || text.includes("aborted")) {
      return new ProviderError("timeout");
    }
    if (text.includes("429") || text.includes("rate limit")) {
      return new ProviderError("rate_limit");
    }
    if (text.includes("context") && text.includes("length")) {
      return new ProviderError("context_length");
    }
  }
  return new ProviderError("unavailable");
}

export function createOpenAIAdapter(input?: {
  apiKey?: string;
  model?: string;
  fetchImpl?: typeof fetch;
}): ModelAdapter {
  const apiKey =
    input?.apiKey ?? process.env.VOXA_MODEL_API_KEY ?? process.env.OPENAI_API_KEY ?? "";
  const model = input?.model ?? process.env.VOXA_MODEL ?? "gpt-4o-mini";
  const fetchImpl = input?.fetchImpl ?? fetch;

  return {
    id: "openai",
    async complete(request: ModelRequest): Promise<ModelCompletion> {
      if (!apiKey) {
        throw new ProviderError("unconfigured", USER_FACING_PROVIDER_ERROR);
      }
      const timeoutMs = request.timeoutMs ?? 30_000;
      let response: Response;
      try {
        response = await fetchImpl("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model,
            temperature: 0.3,
            messages: request.messages.map((message) => ({
              role: message.role,
              content: message.content,
            })),
            response_format: {
              type: "json_schema",
              json_schema: {
                name: request.schemaName,
                strict: true,
                schema: request.jsonSchema,
              },
            },
          }),
          signal: AbortSignal.timeout(timeoutMs),
        });
      } catch (error) {
        throw classifyProviderFailure(error);
      }

      if (!response.ok) {
        if (response.status === 429) {
          throw new ProviderError("rate_limit");
        }
        throw new ProviderError("unavailable");
      }

      const payload = (await response.json()) as {
        choices?: { message?: { content?: string } }[];
        usage?: { prompt_tokens?: number; completion_tokens?: number };
        model?: string;
      };
      const content = payload.choices?.[0]?.message?.content;
      if (!content) {
        throw new ProviderError("invalid_output");
      }
      let parsed: unknown;
      try {
        parsed = JSON.parse(content);
      } catch {
        throw new ProviderError("invalid_output");
      }
      return {
        raw: parsed,
        usage: {
          provider: "openai",
          model: payload.model ?? model,
          inputTokens: payload.usage?.prompt_tokens ?? 0,
          outputTokens: payload.usage?.completion_tokens ?? 0,
        },
      };
    },
  };
}
