import { SEARCH_CIRCUIT_BREAKER_MS } from "../../_lib/constants";
import { buildSearchTerms, buildTaskList } from "./serper";
import { detectSearchIntent, detectSearchScope } from "./intentScope";
import type { SearchExecutionPlan, SearchProfile } from "./orchestrationTypes";

function getSearchProfile(): SearchProfile {
  const raw = (process.env.SEARCH_ORCH_PROFILE ?? "balanced").trim().toLowerCase();
  if (raw === "deep" || raw === "fast") return raw;
  return "balanced";
}

function buildQueryVariants(query: string, offset: number): string[] {
  const q = query.trim();
  if (offset === 0) {
    return Array.from(
      new Set([
        q,
        `${q} apartments villas`,
        `${q} عقارات شقق`,
        `${q} price location bedrooms`,
      ]),
    )
      .filter(Boolean)
      .slice(0, 4);
  }

  // Offset-aware variants to force diversity in subsequent turns
  const variants = [
    `${q} other listings`,
    `${q} bayut wasalt aqar`,
    `${q} propertyfinder expatriates`,
    `${q} additional affordable units`,
    `خيارات أخرى ${q}`,
    `عروض جديدة ${q}`,
  ];
  return Array.from(new Set(variants)).slice(0, 4);
}

export function buildSearchExecutionPlan(params: {
  query: string;
  limit: number;
  refreshToken?: string;
  offset?: number;
}): SearchExecutionPlan {
  const offset = Math.max(0, params.offset ?? 0);
  const taskListBase = buildTaskList(params.query);
  const taskList =
    offset > 0
      ? [...taskListBase, `Refresh mode enabled (offset=${offset})`]
      : taskListBase;
  return {
    intent: detectSearchIntent(params.query),
    scope: detectSearchScope(params.query),
    profile: getSearchProfile(),
    taskList,
    searchTerms: buildSearchTerms(params.query, params.refreshToken, offset),
    primaryQuery: params.query,
    queryVariants: buildQueryVariants(params.query, offset),
    limit: Math.max(1, params.limit),
    offset,
    deadlineMs: Date.now() + SEARCH_CIRCUIT_BREAKER_MS,
  };
}
