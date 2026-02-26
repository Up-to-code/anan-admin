/**
 * Search agent types. Re-exports from results for backward compatibility.
 * @deprecated Prefer importing from ../results
 */
export type {
  SerperResult,
  SerperImageResult,
  PropertyCardCandidate,
  PropertyFinding,
  SourceRun,
  KnowledgePayload,
  UserResult,
  StagehandState,
  SearchAgentResult,
  GenericPortalConfig,
} from "../results/search";

export type {
  SearchIntent,
  SearchScope,
  SearchProfile,
  SearchExecutionPlan,
  SearchStageTrace,
  CoverageReport,
  OrchestratedSearchResult,
} from "./orchestrationTypes";
