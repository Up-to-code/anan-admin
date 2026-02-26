import type { CoverageReport, SearchExecutionPlan } from "./orchestrationTypes";
import type { PropertyFinding, SerperResult } from "./types";

function isSecondPassEnabled(): boolean {
  const raw = (process.env.SEARCH_ORCH_SECOND_PASS_ENABLED ?? "true")
    .trim()
    .toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes" || raw === "on";
}

export function evaluateCoverage(params: {
  plan: SearchExecutionPlan;
  findings: PropertyFinding[];
  sources: SerperResult[];
  excludedPropertyUrls?: Set<string>;
}): CoverageReport {
  const resultCount = params.findings.length;
  const sourceCount = params.sources.length;
  const withImageCount = params.findings.filter((finding) => finding.imageUrls.length > 0).length;
  const withDetailsCount = params.findings.filter((finding) => Boolean(finding.detailFetched)).length;
  const imageCoverage = resultCount > 0 ? withImageCount / resultCount : 0;
  const detailCoverage = resultCount > 0 ? withDetailsCount / resultCount : 0;
  const excluded = params.excludedPropertyUrls ?? new Set<string>();
  const repeatedCount = params.findings.filter((finding) => {
    const key = (finding.propertyUrl ?? finding.detailSourceUrl ?? "")
      .trim()
      .replace(/\/+$/, "")
      .toLowerCase();
    return key.length > 0 && excluded.has(key);
  }).length;
  const noveltyScore = resultCount > 0 ? Math.max(0, 1 - repeatedCount / resultCount) : 1;
  const countScore = Math.min(1, resultCount / Math.max(params.plan.limit, 1));
  const sourceScore = Math.min(1, sourceCount / 4);
  const imageScore = Math.min(1, imageCoverage / 0.7);
  const detailScore = Math.min(1, detailCoverage / 0.6);
  const noveltyWeight = excluded.size > 0 ? 0.15 : 0.05;
  const score =
    countScore * 0.35 +
    sourceScore * 0.2 +
    imageScore * 0.2 +
    detailScore * 0.2 +
    noveltyScore * noveltyWeight;
  const shouldRunSecondPass =
    isSecondPassEnabled() &&
    (resultCount < 2 || imageCoverage < 0.45 || detailCoverage < 0.45) &&
    params.plan.profile !== "fast";

  return {
    score,
    resultCount,
    sourceCount,
    imageCoverage,
    detailCoverage,
    noveltyScore,
    shouldRunSecondPass,
    reason: shouldRunSecondPass ? "low_coverage" : "sufficient",
  };
}
