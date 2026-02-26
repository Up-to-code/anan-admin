import type { ExecutionPlan, SpecialistTask } from "./types";

function makeTask(
  id: string,
  specialist: SpecialistTask["specialist"],
  reason: string,
  parallelSafe: boolean,
): SpecialistTask {
  return { id, specialist, reason, parallelSafe };
}

export function buildSpecialistTasks(plan: Pick<ExecutionPlan, "intent">): SpecialistTask[] {
  if (
    plan.intent === "property_search" ||
    plan.intent === "objection"
  ) {
    return [
      makeTask("plan", "search_planner", "Build query variants and limits", true),
      makeTask("retrieve", "search_retrieval", "Fetch listings and candidates", false),
      makeTask("browse", "browse_extraction", "Enrich top properties and galleries", false),
      makeTask("judge", "search_judgement", "Check coverage and trigger second pass if needed", true),
      makeTask("memory", "memory", "Store user preferences and search context", true),
      makeTask("format", "formatter", "Build channel-safe response", true),
    ];
  }
  if (plan.intent === "property_details") {
    return [
      makeTask("memory", "memory", "Retrieve last viewed properties", true),
      makeTask("details", "search_retrieval", "Fetch full property specifications", false),
      makeTask("format", "formatter", "Build detailed specification list", true),
    ];
  }
  if (plan.intent === "market_info" || plan.intent === "loan") {
    return [
      makeTask("retrieve", "search_retrieval", "Fetch live market/finance sources", false),
      makeTask("judge", "search_judgement", "Score freshness and source confidence", true),
      makeTask("format", "formatter", "Build concise action-first response", true),
    ];
  }
  return [
    makeTask("memory", "memory", "Load memory context for disambiguation", true),
    makeTask("format", "formatter", "Guide user to next real-estate action", true),
  ];
}
