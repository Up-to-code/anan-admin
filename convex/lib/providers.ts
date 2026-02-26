import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { createOpenAI } from "@ai-sdk/openai";
import type { EmbeddingModelV2 } from "@ai-sdk/provider";
import type { LanguageModelV2 } from "@ai-sdk/provider";
import { getAgentLLMConfig } from "../agents/config";

const OPENROUTER_EMBEDDING_MODEL = "openai/text-embedding-3-small";

/**
 * Returns the chat model for agents based on LLM_MODE (and related env).
 * - local: LLM Studio / OpenAI-compatible at LLM_BASE_URL (e.g. http://127.0.0.1:1234/v1)
 * - openrouter: OpenRouter API (OPENROUTER_API_KEY, OPENROUTER_MODEL)
 * - server: custom production server at LLM_BASE_URL
 * See convex/agents/config.ts and .env.example.
 */
export function getChatModel(modelOverride?: string): LanguageModelV2 {
  const config = getAgentLLMConfig();
  const selectedModel = modelOverride?.trim() || config.model;

  if (config.mode === "openrouter") {
    const openrouter = createOpenRouter({ apiKey: config.apiKey });
    return openrouter.chat(selectedModel);
  }

  if (config.mode === "local" || config.mode === "server") {
    const openai = createOpenAI({
      baseURL: config.baseURL,
      apiKey: config.apiKey?.trim() || "dummy",
    });
    return openai.chat(selectedModel);
  }

  throw new Error(`Unsupported LLM mode: ${(config as { mode: string }).mode}`);
}

/**
 * Returns the embedding model for agents. Uses OpenRouter when LLM_MODE=openrouter
 * (single API key for chat + embeddings); otherwise OpenAI-compatible at baseURL.
 */
export function getEmbeddingModel(): EmbeddingModelV2<string> {
  const config = getAgentLLMConfig();

  if (config.mode === "openrouter") {
    const openrouter = createOpenRouter({ apiKey: config.apiKey });
    const model =
      process.env.OPENROUTER_EMBEDDING_MODEL ?? OPENROUTER_EMBEDDING_MODEL;
    return openrouter.textEmbeddingModel(model as `${string}/${string}`);
  }

  // local/server: use OpenAI for embeddings (most custom servers don't support embeddings)
  const openai = createOpenAI({
    apiKey: process.env.OPENAI_API_KEY?.trim() || "dummy",
  });
  return openai.embedding("text-embedding-3-small");
}
