import type { AssistantPayload } from "./types";

function safeParseJson(input: string): unknown | null {
  try {
    return JSON.parse(input);
  } catch {
    return null;
  }
}

function extractJsonFence(input: string): string | null {
  const match = input.match(/```json\s*([\s\S]*?)\s*```/i);
  return match?.[1]?.trim() ?? null;
}

function isAssistantPayload(value: unknown): value is AssistantPayload {
  if (!value || typeof value !== "object") return false;
  const item = value as { type?: string };
  if (!item.type || typeof item.type !== "string") return false;
  return [
    "text",
    "summary_block",
    "recommendation_property",
    "recommendation_bank",
    "recommendation_developer",
    "action_state",
  ].includes(item.type);
}

export function parseAssistantPayload(content: string): AssistantPayload | null {
  const trimmed = content.trim();
  if (!trimmed) return null;

  const direct = safeParseJson(trimmed);
  if (isAssistantPayload(direct)) return direct;

  const fenced = extractJsonFence(trimmed);
  if (fenced) {
    const parsedFence = safeParseJson(fenced);
    if (isAssistantPayload(parsedFence)) return parsedFence;
  }
  return null;
}
