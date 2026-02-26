import { buildSearchExecutionPlan } from "./queryPlanner";
import { retrievePortalFindings, retrieveWebResults } from "./retriever";
import { selectCandidateSources } from "./sourceSelector";
import { enrichFindingsFromSources } from "./detailEnricher";
import { mergeAndRankFindings } from "./ranker";
import { evaluateCoverage } from "./coverageJudge";
import { buildFailureResult, buildSuccessResult } from "./resultAssembler";
import { normalizeUrlSet, runSecondPassIfNeeded, runStage } from "./orchestratorStages";
import type { OrchestratedSearchResult, SearchOrchestratorInput, SearchStageTrace } from "./orchestrationTypes";
import { type GenericActionCtx } from "convex/server";
import { type DataModel } from "../../../_generated/dataModel";

export async function runSearchOrchestrator(ctx: GenericActionCtx<DataModel>, params: SearchOrchestratorInput): Promise<OrchestratedSearchResult> {
  const startedAt = Date.now();
  const trace: SearchStageTrace[] = [];
  const plan = await runStage(trace, "query_plan", () =>
    buildSearchExecutionPlan({
      query: params.query,
      limit: params.limit ?? 5,
      refreshToken: params.refreshToken,
      offset: params.offset,
    }),
  );
  const excludedPropertyUrls = normalizeUrlSet(params.excludedPropertyUrls);

  try {
    const { portalFindings, portalSources } = await runStage(trace, "portal_retrieve", () =>
      retrievePortalFindings({ ctx, plan, excludedPropertyUrls }),
    );
    if (portalFindings.length >= plan.limit) {
      const coverageReport = evaluateCoverage({
        plan,
        findings: portalFindings,
        sources: portalSources,
        excludedPropertyUrls,
      });
      return buildSuccessResult({
        userId: params.userId,
        channel: params.channel,
        threadId: params.threadId,
        plan,
        sources: portalSources,
        findings: portalFindings.slice(0, plan.limit * 2),
        trace,
        coverageReport,
        startedAt,
      });
    }

    const webResult = await runStage(trace, "web_retrieve", () => retrieveWebResults({ plan }));
    if (!webResult.ok) {
      return buildFailureResult({
        userId: params.userId,
        channel: params.channel,
        threadId: params.threadId,
        plan,
        error: webResult.error ?? "web_retrieval_failed",
        trace,
        startedAt,
      });
    }

    const sources = await runStage(trace, "source_select", () =>
      selectCandidateSources({ portalSources, webResults: webResult.results, webImages: webResult.images }),
    );
    if (sources.length === 0) {
      return buildFailureResult({
        userId: params.userId,
        channel: params.channel,
        threadId: params.threadId,
        plan,
        error: "no_valid_sources",
        trace,
        startedAt,
      });
    }

    const imagePool = webResult.images.map((image) => image.imageUrl).filter((url): url is string => Boolean(url));
    const webFindings = await runStage(trace, "detail_enrich", () =>
      enrichFindingsFromSources({
        ctx,
        sources,
        imagePool,
        deadlineMs: plan.deadlineMs,
        limit: plan.limit,
        excludePropertyUrls: excludedPropertyUrls,
        detailEnrichCount: plan.profile === "deep" ? 5 : 3,
      }),
    );
    let findings = await runStage(trace, "rank_merge", () => mergeAndRankFindings(portalFindings, webFindings));
    let coverageReport = await runStage(trace, "coverage_judge", () =>
      evaluateCoverage({
        plan,
        findings,
        sources,
        excludedPropertyUrls,
      }),
    );
    ({ findings, coverage: coverageReport } = await runSecondPassIfNeeded({
      ctx,
      trace,
      plan,
      sources,
      findings,
      coverage: coverageReport,
      excludedPropertyUrls,
    }));
    return buildSuccessResult({
      userId: params.userId,
      channel: params.channel,
      threadId: params.threadId,
      plan,
      sources,
      findings,
      trace,
      coverageReport,
      startedAt,
    });
  } catch (error) {
    return buildFailureResult({
      userId: params.userId,
      channel: params.channel,
      threadId: params.threadId,
      plan,
      error: error instanceof Error ? error.message : String(error),
      trace,
      startedAt,
    });
  }
}
