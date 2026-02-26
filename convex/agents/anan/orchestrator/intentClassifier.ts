import { detectSearchIntent } from "../search/intentScope";
import type { AgentRuntimeContext, ExecutionPlan } from "./types";

function estimateConfidence(message: string): number {
  const trimmed = message.trim();
  if (trimmed.length <= 2) return 0.35;
  if (/\d/.test(trimmed) || /(?:in|في|للبيع|for sale)/i.test(trimmed)) return 0.82;
  if (trimmed.length >= 20) return 0.72;
  return 0.6;
}

export function classifyRuntimeIntent(
  context: AgentRuntimeContext,
): Pick<ExecutionPlan, "intent" | "confidence"> {
  const intent = detectSearchIntent(context.message);
  const mappedIntent =
    intent === "property_search" ||
      intent === "market_info" ||
      intent === "loan" ||
      intent === "objection" ||
      intent === "property_details"
      ? intent
      : "general";
  return {
    intent: mappedIntent,
    confidence: estimateConfidence(context.message),
  };
}
