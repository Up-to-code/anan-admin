import { SAUDI_PORTAL_CONFIGS, runPortalSearch, toSerperResult } from "./saudiPortals";
import { runSerperSearch } from "./serper";
import type { SearchExecutionPlan } from "./orchestrationTypes";
import type { PropertyFinding, SerperResult, StagehandState } from "./types";

function normalizeUrl(url: string | undefined): string | null {
  if (!url) return null;
  return url.trim().replace(/\/+$/, "").toLowerCase() || null;
}

import { type GenericActionCtx } from "convex/server";
import { type DataModel } from "../../../_generated/dataModel";

export async function retrievePortalFindings(params: {
  ctx: GenericActionCtx<DataModel>;
  plan: SearchExecutionPlan;
  excludedPropertyUrls: Set<string>;
}): Promise<{ portalFindings: PropertyFinding[]; portalSources: SerperResult[] }> {
  const state: StagehandState = { disabled: false };
  const portalSources: SerperResult[] = [];
  const portalFindings: PropertyFinding[] = [];
  let remainingDetailEnrichment = 3;

  for (let idx = 0; idx < SAUDI_PORTAL_CONFIGS.length; idx += 1) {
    if (Date.now() > params.plan.deadlineMs) break;
    if (portalFindings.length >= params.plan.limit) break;
    const config = SAUDI_PORTAL_CONFIGS[idx];
    if (!config.buildSearchUrl(params.plan.primaryQuery, 1)) continue;
    const result = await runPortalSearch(
      params.ctx,
      params.plan.primaryQuery,
      idx + 1,
      config,
      state,
      {
        deadlineMs: params.plan.deadlineMs,
        detailEnrichCount: remainingDetailEnrichment,
        excludePropertyUrls: params.excludedPropertyUrls,
      },
    );
    const consumed = result.findings.filter((finding) => finding.detailFetched).length;
    remainingDetailEnrichment = Math.max(0, remainingDetailEnrichment - consumed);
    if (result.findings.length === 0) continue;
    const seen = new Set(
      portalFindings
        .map((finding) => normalizeUrl(finding.propertyUrl))
        .filter((url): url is string => Boolean(url)),
    );
    for (const finding of result.findings) {
      const key = normalizeUrl(finding.propertyUrl);
      if (key && seen.has(key)) continue;
      if (key) seen.add(key);
      portalFindings.push(finding);
    }
    portalSources.push(toSerperResult(result.sourceUrl, config.name));
  }

  return { portalFindings, portalSources };
}

export async function retrieveWebResults(params: {
  plan: SearchExecutionPlan;
}): Promise<
  | { ok: true; results: SerperResult[]; images: Array<{ imageUrl?: string }> }
  | { ok: false; error: string }
> {
  return runSerperSearch(params.plan.primaryQuery, params.plan.limit * 2, params.plan.offset);
}
