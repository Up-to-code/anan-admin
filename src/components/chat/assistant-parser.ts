import type { StructuredAssistantPayload } from "./types";

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

function isStructuredPayload(value: unknown): value is StructuredAssistantPayload {
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

export function parseAssistantPayload(content: string): StructuredAssistantPayload | null {
  const trimmed = content.trim();
  if (!trimmed) return null;

  const direct = safeParseJson(trimmed);
  if (isStructuredPayload(direct)) return direct;

  const fenced = extractJsonFence(trimmed);
  if (fenced) {
    const parsedFence = safeParseJson(fenced);
    if (isStructuredPayload(parsedFence)) return parsedFence;
  }

  return null;
}
