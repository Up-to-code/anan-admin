import type {
  PropertyFinding,
  SearchAgentResult,
  SerperResult,
  SerperImageResult,
} from "./types";

export type SearchIntent =
  | "property_search"
  | "market_info"
  | "loan"
  | "objection"
  | "property_details";
export type SearchScope = "saudi" | "uae" | "global";
export type SearchProfile = "balanced" | "deep" | "fast";

export type SearchStageName =
  | "intent_scope"
  | "query_plan"
  | "portal_retrieve"
  | "web_retrieve"
  | "source_select"
  | "detail_enrich"
  | "rank_merge"
  | "coverage_judge"
  | "second_pass"
  | "assemble";

export type SearchStageTrace = {
  stage: SearchStageName;
  startedAt: number;
  endedAt: number;
  status: "ok" | "error" | "skipped";
  meta?: Record<string, unknown>;
};

export type CoverageReport = {
  score: number;
  resultCount: number;
  sourceCount: number;
  imageCoverage: number;
  detailCoverage: number;
  noveltyScore: number;
  shouldRunSecondPass: boolean;
  reason: string;
};

export type SearchExecutionPlan = {
  intent: SearchIntent;
  scope: SearchScope;
  profile: SearchProfile;
  taskList: string[];
  searchTerms: string[];
  primaryQuery: string;
  queryVariants: string[];
  limit: number;
  offset: number;
  deadlineMs: number;
};

export type RetrievalSnapshot = {
  portalFindings: PropertyFinding[];
  portalSources: SerperResult[];
  webResult:
  | { ok: true; results: SerperResult[]; images: SerperImageResult[] }
  | { ok: false; error: string };
};

export type SearchOrchestratorInput = {
  query: string;
  userId: string;
  channel?: "whatsapp" | "app" | "web";
  limit?: number;
  refreshToken?: string;
  offset?: number;
  threadId?: string;
  excludedPropertyUrls?: string[];
};

export type OrchestratedSearchResult = SearchAgentResult & {
  orchestrationTrace: SearchStageTrace[];
  coverageReport?: CoverageReport;
};
