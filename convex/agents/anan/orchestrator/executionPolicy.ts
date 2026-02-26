import { buildSpecialistTasks } from "./toolPlanner";
import { classifyRuntimeIntent } from "./intentClassifier";
import type { AgentRuntimeContext, ExecutionPlan } from "./types";

const DELEGATION_CONFIDENCE_THRESHOLD = 0.58;

export function createExecutionPlan(context: AgentRuntimeContext): ExecutionPlan {
  const classified = classifyRuntimeIntent(context);
  const forceDelegate =
    classified.intent === "property_search" ||
    classified.intent === "market_info" ||
    classified.intent === "loan" ||
    classified.intent === "objection" ||
    classified.intent === "property_details";
  const delegate =
    forceDelegate || classified.confidence >= DELEGATION_CONFIDENCE_THRESHOLD;

  return {
    intent: classified.intent,
    confidence: classified.confidence,
    delegate,
    tasks: delegate ? buildSpecialistTasks({ intent: classified.intent }) : [],
  };
}
