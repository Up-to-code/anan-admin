import { buildKnowledgePayload, buildUserResults } from "./pipeline";
import type { CoverageReport, SearchExecutionPlan, SearchStageTrace } from "./orchestrationTypes";
import type { OrchestratedSearchResult } from "./orchestrationTypes";
import type { PropertyFinding, SerperResult } from "./types";

export function buildSuccessResult(params: {
  userId: string;
  channel?: "whatsapp" | "app" | "web";
  threadId?: string;
  plan: SearchExecutionPlan;
  sources: SerperResult[];
  findings: PropertyFinding[];
  trace: SearchStageTrace[];
  coverageReport: CoverageReport;
  startedAt: number;
}): OrchestratedSearchResult {
  return {
    success: true,
    knowledgePayload: buildKnowledgePayload(
      params.userId,
      params.plan.primaryQuery,
      params.channel,
      params.sources,
      params.findings,
      params.plan.taskList,
      params.plan.searchTerms,
      undefined,
      params.threadId,
    ),
    userResults: buildUserResults(params.findings, params.channel, params.plan.limit),
    durationMs: Date.now() - params.startedAt,
    orchestrationTrace: params.trace,
    coverageReport: params.coverageReport,
  };
}

export function buildFailureResult(params: {
  userId: string;
  channel?: "whatsapp" | "app" | "web";
  threadId?: string;
  plan: SearchExecutionPlan;
  error: string;
  trace: SearchStageTrace[];
  startedAt: number;
}): OrchestratedSearchResult {
  return {
    success: false,
    knowledgePayload: buildKnowledgePayload(
      params.userId,
      params.plan.primaryQuery,
      params.channel,
      [],
      [],
      params.plan.taskList,
      params.plan.searchTerms,
      params.error,
      params.threadId,
    ),
    userResults: [],
    error: params.error,
    durationMs: Date.now() - params.startedAt,
    orchestrationTrace: params.trace,
  };
}
