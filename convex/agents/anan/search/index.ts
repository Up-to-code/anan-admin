/**
 * Anan Search Agent - dedicated web property research worker.
 * Re-exports public API: runSearchAgent, fetchPropertyDetailsByUrl, storeKnowledgeResearch.
 */

import type { FunctionReference } from "convex/server";
import { SEARCH_CIRCUIT_BREAKER_MS } from "../../_lib/constants";
import { isSearchOrchestratorEnabledForKey } from "../../runtime/env";
import { buildTaskList, buildSearchTerms, runSerperSearch, selectTopSources } from "./serper";
import { extractPropertyDetails } from "./stagehand";
import {
  buildFindings,
  buildKnowledgePayload,
  buildKnowledgePayloadFromDbResults,
  buildUserResults,
} from "./pipeline";
import { SAUDI_PORTAL_CONFIGS, runPortalSearch, toSerperResult } from "./saudiPortals";
import { runSearchOrchestrator } from "./searchOrchestrator";
import type {
  KnowledgePayload,
  PropertyFinding,
  SearchAgentResult,
  SerperResult,
  StagehandState,
} from "./types";
import { type GenericActionCtx } from "convex/server";
import { type DataModel } from "../../../_generated/dataModel";

export type { SearchAgentResult } from "./types";
export { buildKnowledgePayloadFromDbResults } from "./pipeline";

export type SearchAgentApi = {
  properties: {
    logKnowledgeResearch: FunctionReference<"mutation", "public">;
  };
};

function normalizeUrlKey(url: string | undefined): string | null {
  if (!url) return null;
  return url.trim().replace(/\/+$/, "").toLowerCase() || null;
}


/**
 * Fetch full property details (including Property Information and imageUrls) from a detail page URL.
 */
export async function fetchPropertyDetailsByUrl(
  ctx: GenericActionCtx<DataModel>,
  propertyUrl: string
): Promise<{
  title?: string;
  description?: string;
  price?: string;
  location?: string;
  imageUrls: string[];
  offerDetails?: string;
  bathrooms?: string;
  area?: string;
  features?: string[];
  beds?: string;
} | null> {
  const state: StagehandState = { disabled: false };
  const result = await extractPropertyDetails(ctx, propertyUrl, 1, state);
  if (
    state.disabled ||
    (result.imageUrls.length === 0 && !result.description && !result.title)
  ) {
    return null;
  }
  return result;
}

/**
 * Store knowledge research record.
 */
export async function storeKnowledgeResearch(
  ctx: GenericActionCtx<DataModel>,
  appApi: SearchAgentApi,
  payload: KnowledgePayload
): Promise<void> {
  const runMutation = (ctx as { runMutation?: Function }).runMutation;
  if (typeof runMutation !== "function") {
    console.error("[anan.search] knowledge:store_failed", { reason: "no_runMutation" });
    return;
  }

  try {
    await runMutation(appApi.properties.logKnowledgeResearch, payload);
    console.log("[anan.search] knowledge:stored", {
      userId: payload.userId,
      query: payload.query,
    });
  } catch (error) {
    console.error("[anan.search] knowledge:store_failed", {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Main search agent entry point.
 */
export async function runSearchAgent(
  ctx: GenericActionCtx<DataModel>,
  params: {
    query: string;
    userId: string;
    channel?: "whatsapp" | "app" | "web";
    limit?: number;
    refreshToken?: string;
    offset?: number;
    threadId?: string;
    excludedPropertyUrls?: string[];
  }
): Promise<SearchAgentResult> {
  const startTime = Date.now();
  const {
    query,
    userId,
    channel,
    limit = 5,
    refreshToken,
    offset = 0,
    threadId,
    excludedPropertyUrls,
  } = params;
  const excludedUrlKeys = new Set<string>(
    (excludedPropertyUrls ?? [])
      .map((url) => normalizeUrlKey(url))
      .filter((url): url is string => Boolean(url)),
  );
  const routingKey = threadId ?? `${userId}:${query}`;

  console.log("[anan.search] start", {
    query,
    userId,
    channel,
    limit,
    refreshToken,
    offset,
    excludedPropertyUrls: excludedUrlKeys.size,
  });

  if (isSearchOrchestratorEnabledForKey(routingKey)) {
    const orchestrated = await runSearchOrchestrator(ctx, {
      query,
      userId,
      channel,
      limit,
      refreshToken,
      offset,
      threadId,
      excludedPropertyUrls,
    });
    if (orchestrated.success) {
      console.log("[anan.search] complete:orchestrated", {
        duration: orchestrated.durationMs,
        findingsCount: orchestrated.knowledgePayload.propertyFindings.length,
        resultCount: orchestrated.userResults.length,
        coverage: orchestrated.coverageReport?.score,
      });
      return orchestrated;
    }
    console.warn("[anan.search] orchestrator:fallback_to_legacy", {
      error: orchestrated.error,
      traceStages: orchestrated.orchestrationTrace?.length ?? 0,
    });
  }

  const baseTaskList = buildTaskList(query);
  const taskList =
    offset > 0
      ? [...baseTaskList, `Refresh mode enabled (offset=${offset})`]
      : baseTaskList;
  const searchTerms = buildSearchTerms(query, refreshToken, offset);
  const deadlineMs = startTime + SEARCH_CIRCUIT_BREAKER_MS;

  let portalFindings: PropertyFinding[] = [];
  const portalSources: SerperResult[] = [];
  const portalState: StagehandState = { disabled: false };
  let remainingPortalDetailEnrichment = 3;

  for (let idx = 0; idx < SAUDI_PORTAL_CONFIGS.length; idx++) {
    if (Date.now() > deadlineMs) break;
    if (portalFindings.length >= limit) break;

    const config = SAUDI_PORTAL_CONFIGS[idx];
    if (!config.buildSearchUrl(query, 1)) continue;

    try {
      const result = await runPortalSearch(
        ctx,
        query,
        idx + 1,
        config,
        portalState,
        {
          deadlineMs,
          detailEnrichCount: remainingPortalDetailEnrichment,
          excludePropertyUrls: excludedUrlKeys,
        }
      );
      const consumedDetailBudget = result.findings.filter(
        (f) => f.detailFetched,
      ).length;
      remainingPortalDetailEnrichment = Math.max(
        0,
        remainingPortalDetailEnrichment - consumedDetailBudget,
      );
      if (result.findings.length > 0) {
        const seen = new Set(
          portalFindings
            .map((f) => normalizeUrlKey(f.propertyUrl))
            .filter((url): url is string => Boolean(url)),
        );
        for (const f of result.findings) {
          const key = normalizeUrlKey(f.propertyUrl);
          if (key && !seen.has(key)) {
            seen.add(key);
            portalFindings.push(f);
          }
        }
        portalSources.push(toSerperResult(result.sourceUrl, config.name));
      }
    } catch (e) {
      console.warn("[anan.search] portal:error", { provider: config.name, error: e });
    }
  }

  if (portalFindings.length >= limit) {
    const sourcesForPayload = portalSources.length > 0
      ? portalSources
      : [{ title: "Direct portals", description: "", externalUrl: "direct://wasalt,bayut" }];
    const knowledgePayload = buildKnowledgePayload(
      userId,
      query,
      channel,
      sourcesForPayload,
      portalFindings.slice(0, limit * 2),
      taskList,
      searchTerms,
      undefined,
      threadId
    );
    const userResults = buildUserResults(portalFindings, channel, limit);
    const durationMs = Date.now() - startTime;
    console.log("[anan.search] complete:portal_only", {
      duration: durationMs,
      findingsCount: portalFindings.length,
      providers: portalSources.map((s) => s.title),
    });
    return {
      success: true,
      knowledgePayload,
      userResults,
      durationMs,
    };
  }

  try {
    const serperResult = await runSerperSearch(query, limit * 2, offset);

    if (!serperResult?.ok) {
      const durationMs = Date.now() - startTime;
      const errorMsg = serperResult?.error ?? "serper_request_failed";
      console.log("[anan.search] failed", {
        duration: durationMs,
        error: errorMsg,
      });

      return {
        success: false,
        knowledgePayload: buildKnowledgePayload(
          userId,
          query,
          channel,
          [],
          [],
          taskList,
          searchTerms,
          errorMsg,
          threadId
        ),
        userResults: [],
        error: errorMsg,
        durationMs,
      };
    }

    let sources = selectTopSources(serperResult.results, serperResult.images);
    const imagePool = (serperResult.images ?? [])
      .map((i) => i.imageUrl)
      .filter((url): url is string => Boolean(url));

    if (sources.length === 0) {
      const durationMs = Date.now() - startTime;
      console.log("[anan.search] failed", {
        duration: durationMs,
        error: "no_valid_sources",
      });

      return {
        success: false,
        knowledgePayload: buildKnowledgePayload(
          userId,
          query,
          channel,
          [],
          [],
          taskList,
          searchTerms,
          "no_valid_sources",
          threadId
        ),
        userResults: [],
        error: "no_valid_sources",
        durationMs,
      };
    }

    let findings = await buildFindings(ctx, sources, imagePool, {
      deadlineMs,
      maxFindings: Math.max(limit * 2, 10),
      detailEnrichCount: 3,
      excludePropertyUrls: excludedUrlKeys,
    });

    const seenUrls = new Set(
      portalFindings
        .map((f) => normalizeUrlKey(f.propertyUrl))
        .filter((url): url is string => Boolean(url)),
    );
    const allFindings = [...portalFindings];
    for (const f of findings) {
      const key = normalizeUrlKey(f.propertyUrl);
      if (key && !seenUrls.has(key)) {
        seenUrls.add(key);
        allFindings.push(f);
      }
    }
    findings = allFindings;
    if (portalSources.length > 0) {
      sources = [...portalSources, ...sources];
    }

    if (findings.length < 2 && Date.now() < deadlineMs) {
      const secondResult = await runSerperSearch(query, limit * 2, 10);
      if (secondResult?.ok && secondResult.results.length > 0) {
        const existingUrls = new Set(sources.map((s) => s.externalUrl));
        const additionalSources = selectTopSources(
          secondResult.results,
          secondResult.images
        ).filter((s) => !existingUrls.has(s.externalUrl)).slice(0, 2);
        if (additionalSources.length > 0) {
          const secondImagePool = (secondResult.images ?? [])
            .map((i) => i.imageUrl)
            .filter((url): url is string => Boolean(url));
          const moreFindings = await buildFindings(ctx, additionalSources, secondImagePool, {
            deadlineMs,
            maxFindings: Math.max(limit, 6),
            detailEnrichCount: 3,
            excludePropertyUrls: excludedUrlKeys,
          });
          findings = [...findings, ...moreFindings];
          sources = [...sources, ...additionalSources];
          console.log("[anan.search] second_run", {
            additionalSources: additionalSources.length,
            totalFindings: findings.length,
          });
        }
      }
    }

    const knowledgePayload = buildKnowledgePayload(
      userId,
      query,
      channel,
      sources,
      findings,
      taskList,
      searchTerms,
      undefined,
      threadId
    );
    const userResults = buildUserResults(findings, channel, limit);

    const durationMs = Date.now() - startTime;
    console.log("[anan.search] complete", {
      duration: durationMs,
      success: true,
      findingsCount: findings.length,
      userResultsCount: userResults.length,
    });

    return {
      success: true,
      knowledgePayload,
      userResults,
      durationMs,
    };
  } catch (error) {
    const durationMs = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    console.error("[anan.search] failed", {
      duration: durationMs,
      error: errorMessage,
      stack: error instanceof Error ? error.stack : undefined,
    });

    return {
      success: false,
      knowledgePayload: buildKnowledgePayload(
        userId,
        query,
        channel,
        [],
        [],
        taskList,
        searchTerms,
        errorMessage,
        threadId
      ),
      userResults: [],
      error: errorMessage,
      durationMs,
    };
  }
}
