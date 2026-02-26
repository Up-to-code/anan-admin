import { runSerperSearch } from "./serper";
import { selectCandidateSources } from "./sourceSelector";
import { enrichFindingsFromSources } from "./detailEnricher";
import { mergeAndRankFindings } from "./ranker";
import { evaluateCoverage } from "./coverageJudge";
import type { CoverageReport, SearchExecutionPlan, SearchStageTrace } from "./orchestrationTypes";
import type { PropertyFinding, SerperResult } from "./types";
import { type GenericActionCtx } from "convex/server";
import { type DataModel } from "../../../_generated/dataModel";

export function normalizeUrlSet(urls: string[] | undefined): Set<string> {
  return new Set(
    (urls ?? [])
      .map((url) => url.trim().replace(/\/+$/, "").toLowerCase())
      .filter(Boolean),
  );
}

export async function runStage<T>(
  trace: SearchStageTrace[],
  stage: SearchStageTrace["stage"],
  run: () => Promise<T> | T,
): Promise<T> {
  const startedAt = Date.now();
  try {
    const result = await run();
    trace.push({ stage, startedAt, endedAt: Date.now(), status: "ok" });
    return result;
  } catch (error) {
    trace.push({
      stage,
      startedAt,
      endedAt: Date.now(),
      status: "error",
      meta: { error: error instanceof Error ? error.message : String(error) },
    });
    throw error;
  }
}

export async function runSecondPassIfNeeded(params: {
  ctx: GenericActionCtx<DataModel>;
  trace: SearchStageTrace[];
  plan: SearchExecutionPlan;
  sources: SerperResult[];
  findings: PropertyFinding[];
  coverage: CoverageReport;
  excludedPropertyUrls: Set<string>;
}): Promise<{ findings: PropertyFinding[]; coverage: CoverageReport }> {
  if (!params.coverage.shouldRunSecondPass || Date.now() >= params.plan.deadlineMs) {
    return { findings: params.findings, coverage: params.coverage };
  }
  const secondResult = await runStage(params.trace, "second_pass", () =>
    runSerperSearch(params.plan.primaryQuery, params.plan.limit * 2, 10),
  );
  if (!secondResult.ok || secondResult.results.length === 0) {
    return { findings: params.findings, coverage: params.coverage };
  }
  const existingSources = new Set(params.sources.map((source) => source.externalUrl));
  const additionalSources = selectCandidateSources({
    portalSources: [],
    webResults: secondResult.results,
    webImages: secondResult.images,
  })
    .filter((source) => !existingSources.has(source.externalUrl))
    .slice(0, 2);
  if (additionalSources.length === 0) {
    return { findings: params.findings, coverage: params.coverage };
  }
  const secondPool = secondResult.images
    .map((image) => image.imageUrl)
    .filter((url): url is string => Boolean(url));
  const secondFindings = await enrichFindingsFromSources({
    ctx: params.ctx,
    sources: additionalSources,
    imagePool: secondPool,
    deadlineMs: params.plan.deadlineMs,
    limit: Math.max(params.plan.limit, 6),
    excludePropertyUrls: params.excludedPropertyUrls,
    detailEnrichCount: 2,
  });
  params.sources.push(...additionalSources);
  const findings = mergeAndRankFindings(params.findings, secondFindings);
  const coverage = evaluateCoverage({
    plan: params.plan,
    findings,
    sources: params.sources,
    excludedPropertyUrls: params.excludedPropertyUrls,
  });
  return { findings, coverage };
}
