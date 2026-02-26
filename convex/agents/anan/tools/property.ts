/**
 * Property search tools – smartPropertySearch, getLastSearchContext,
 * getLastSearchFindings, getMoreDetailsForProperty.
 */
import { createTool } from "@convex-dev/agent";
import { toonEncode } from "../../../lib/toon";
import { z } from "zod";
import { withDebugTiming } from "../../debug";
import {
  fetchPropertyDetailsByUrl,
  runSearchAgent,
  storeKnowledgeResearch,
  buildKnowledgePayloadFromDbResults,
} from "../search";
import { detectPreferredLanguage } from "../../../lib/language";
import {
  extractPriceHint,
  extractLocationHint,
  sanitizeWebText,
} from "../../_lib/sanitize";
import { extractQueryLocation } from "../../_lib/location";
import {
  inferCountryFromLocation,
  isLikelyPropertyDetailUrl,
} from "../../_lib/location";
import { SEARCH_CACHE_TTL_MS, SAUDI_CITIES } from "../../_lib/constants";
import type { DbPropertyResult } from "../../_lib/types";
import type { AgentToolsApi } from "./types";
import { internal } from "../../../_generated/api";
import { type GenericActionCtx } from "convex/server";
import { type DataModel } from "../../../_generated/dataModel";

import { storeSearchSummaryInMemory, parsePropertyQueryCriteria, extractQueryPriceHint, extractQueryLocationHint, normalizePriceHint, normalizeLocationHint, normalizeUrlKey, shouldExcludePreviousResults, normalizeCachedFindingsToUserResults, isRefreshIntent, detectSearchScopeFromQuery, logSearchLifecycle, logKnowledgeResearchRecord, getContextUser, resolveSearchRefreshOffset, resolveExcludedPropertyUrls, resolveSeenExposureUrls, trackExposedPropertyUrls, extractLocationPhrases, tokenizeQuery, dbResultMatchScore, shouldPreferWebFallback, normalizeDbResultsForOutput, filterCachedFindingsByExcludedUrls, filterDbResultsByExcludedUrls, filterUserResultsByExcludedUrls, collectResultUrls, type PropertyQueryCriteria, type CachedFinding, type SearchLogArgs } from "./propertyCache";
// ── Tools ───────────────────────────────────────────────────────────────────

export function createPropertyTools(appApi: AgentToolsApi) {
  const getLastSearchContext = createTool({
    description:
      "Get the last property search context for this user (and thread if available). Use when the user asks for 'more' or 'different results' and you need the previous query to reuse or vary it.",
    args: z.object({}),
    handler: async (ctx) => {
      const { userId } = getContextUser(ctx);
      const threadId = (ctx as { threadId?: string }).threadId;
      if (!userId)
        return toonEncode({ query: null, findingsCount: 0, createdAt: 0 });
      const context = await ctx.runQuery(
        appApi.properties.getLastSearchContext,
        {
          userId,
          threadId,
        },
      );
      return toonEncode(
        context ?? { query: null, findingsCount: 0, createdAt: 0 },
      );
    },
  });

  const getLastSearchFindings = createTool({
    description:
      "Get the list of properties from the last search (titles, URLs, details). Use when the user refers to a property you already showed (e.g. 'the second one', 'هذا العقار', 'more details about that apartment') so you can identify which property they mean and re-present or fetch more details.",
    args: z.object({
      maxFindings: z
        .number()
        .optional()
        .default(10)
        .describe("Max number of findings to return (default 10)"),
    }),
    handler: async (ctx, { maxFindings }) => {
      const { userId } = getContextUser(ctx);
      const threadId = (ctx as { threadId?: string }).threadId;
      if (!userId)
        return toonEncode({ query: null, createdAt: 0, findings: [] });
      const result = await ctx.runQuery(
        appApi.properties.getLastSearchFindings,
        {
          userId,
          threadId,
          maxFindings,
        },
      );
      return toonEncode(result ?? { query: "", createdAt: 0, findings: [] });
    },
  });

  const smartPropertySearch = createTool({
    description:
      "Property-intent search service. Always send a quick 'I search for you' message, then search DB first. Delegates to dedicated search agent for web fallback with deep property extraction. Only for listing search. Do NOT use for 'market like', 'how is the market', 'market trends', or general market questions—use searchRealEstateInfo for those.",
    args: z.object({
      query: z
        .string()
        .describe(
          "Property search query (location, budget, bedrooms, features)",
        ),
      limit: z.number().optional().default(10),
      refreshToken: z
        .string()
        .optional()
        .describe(
          "Pass when user requests fresh/different results for the same query",
        ),
      includeImages: z
        .boolean()
        .optional()
        .default(true)
        .describe("Prefer image-rich results when web fallback is used"),
    }),
    handler: async (ctx, { query, limit, refreshToken, includeImages }) => {
      const searchStartedMessageEn =
        "We're searching for the best results for you...";
      const searchStartedMessageAr = "نبحث لك عن أفضل النتائج...";
      const preferredLanguage = detectPreferredLanguage(query);
      const searchStartedMessage =
        preferredLanguage === "ar"
          ? searchStartedMessageAr
          : searchStartedMessageEn;
      const { userId, channel } = getContextUser(ctx);
      const threadId = (ctx as { threadId?: string }).threadId;
      const refreshOffset = await resolveSearchRefreshOffset(
        ctx,
        appApi,
        userId,
        query,
        refreshToken,
      );
      const excludedPropertyUrls = await resolveExcludedPropertyUrls(
        ctx,
        appApi,
        userId,
        threadId,
        query,
        refreshToken,
      );
      const seenExposureUrls = await resolveSeenExposureUrls(
        ctx,
        appApi,
        userId,
        threadId,
        query,
      );
      const excludedUrlKeys = new Set([...excludedPropertyUrls, ...seenExposureUrls]);

      console.log("[tools.smartPropertySearch] start", {
        query,
        limit,
        includeImages,
        hasUserId: Boolean(userId),
        channel,
        excludedPreviousResults: excludedUrlKeys.size,
      });

      await logSearchLifecycle(ctx, appApi, {
        query,
        userId,
        channel,
        stage: "query_received",
        status: "success",
      });

      const rawDbResults = await withDebugTiming(
        "tools.smartPropertySearch",
        "db_search",
        { query, limit },
        async () =>
          ctx.runQuery(appApi.properties.search, {
            query,
            limit,
          }),
      );
      const dbResults = filterDbResultsByExcludedUrls(
        (Array.isArray(rawDbResults) ? rawDbResults : []) as DbPropertyResult[],
        excludedUrlKeys,
      );
      console.log("[tools.smartPropertySearch] db_search:result", {
        count: Array.isArray(rawDbResults) ? rawDbResults.length : 0,
        filteredCount: dbResults.length,
        hasResults: dbResults.length > 0,
      });

      await logSearchLifecycle(ctx, appApi, {
        query,
        userId,
        channel,
        stage: "db_checked",
        status: dbResults.length > 0 ? "success" : "empty",
        source: dbResults.length > 0 ? "internal_db" : undefined,
        resultCount: dbResults.length,
      });

      const dbDecision = shouldPreferWebFallback(
        query,
        dbResults,
        limit,
      );
      const forceWebForRefresh =
        excludedUrlKeys.size > 0 && dbResults.length < Math.min(limit, 2);
      console.log("[tools.smartPropertySearch] db_decision", {
        preferWeb: dbDecision.preferWeb,
        forceWebForRefresh,
        reason: dbDecision.reason,
        bestScore: dbDecision.bestScore,
      });

      if (dbResults.length > 0 && !dbDecision.preferWeb && !forceWebForRefresh) {
        if (userId && userId !== "anonymous") {
          await logKnowledgeResearchRecord(
            ctx,
            appApi,
            buildKnowledgePayloadFromDbResults({
              query,
              userId,
              channel,
              threadId,
              dbResults,
            }),
          );
          await storeSearchSummaryInMemory(ctx, {
            userId,
            threadId,
            query,
            locationHint: extractQueryLocation(query),
            budgetHint: extractQueryPriceHint(query),
            findingsCount: dbResults.length,
          });
        }
        console.log("[tools.smartPropertySearch] complete", {
          source: "internal_db",
          resultCount: dbResults.length,
        });
        await logSearchLifecycle(ctx, appApi, {
          query,
          userId,
          channel,
          stage: "completed",
          status: "success",
          source: "internal_db",
          resultCount: dbResults.length,
        });
        const dbOutput = normalizeDbResultsForOutput(dbResults);
        await trackExposedPropertyUrls(ctx, appApi, {
          userId,
          threadId,
          query,
          urls: collectResultUrls(dbOutput),
        });
        return toonEncode({
          searchStarted: true,
          searchStartedMessage,
          localizedSearchStartedMessage: {
            en: searchStartedMessageEn,
            ar: searchStartedMessageAr,
          },
          source: "internal_db",
          responseMode: "search_list",
          results: dbOutput,
          presentationGuidance: {
            avoidProviderNames: true,
            includeLinksOnlyOnUserRequest: true,
            imageFirstFormatting: true,
          },
        });
      }



      const skipCache =
        !userId ||
        userId === "anonymous" ||
        shouldExcludePreviousResults(query, refreshToken);
      const searchScope = detectSearchScopeFromQuery(query);
      const globalCacheBypass = shouldExcludePreviousResults(query, refreshToken);
      if (!globalCacheBypass) {
        const globalCached = await ctx.runQuery(
          appApi.properties.getGlobalSearchCache,
          {
            query,
            offset: refreshOffset,
            scope: searchScope,
            minFindings: Math.min(limit, 3),
          },
        );
        if (
          globalCached?.propertyFindings &&
          globalCached.propertyFindings.length >= Math.min(limit, 3)
        ) {
          const cachedFindings = filterCachedFindingsByExcludedUrls(
            globalCached.propertyFindings as CachedFinding[],
            excludedUrlKeys,
          );
          if (cachedFindings.length > 0) {
            const enrichedResults = normalizeCachedFindingsToUserResults(
              cachedFindings,
              limit,
              query,
              includeImages,
            );
            await ctx.runMutation(appApi.properties.trackGlobalSearchCacheHit, {
              cacheKey: globalCached.cacheKey,
            });
            if (userId && userId !== "anonymous") {
              await storeSearchSummaryInMemory(ctx, {
                userId,
                threadId,
                query,
                locationHint: extractQueryLocation(query),
                budgetHint: extractQueryPriceHint(query),
                findingsCount: enrichedResults.length,
              });
            }
            await logSearchLifecycle(ctx, appApi, {
              query,
              userId,
              channel,
              stage: "completed",
              status: "success",
              source: "search_memory",
              resultCount: enrichedResults.length,
            });
            await trackExposedPropertyUrls(ctx, appApi, {
              userId,
              threadId,
              query,
              urls: collectResultUrls(enrichedResults),
            });
            return toonEncode({
              searchStarted: true,
              searchStartedMessage,
              localizedSearchStartedMessage: {
                en: searchStartedMessageEn,
                ar: searchStartedMessageAr,
              },
              source: "search_memory",
              cacheLayer: "global",
              refreshOffset,
              responseMode: "search_list",
              results: enrichedResults,
              presentationGuidance: {
                avoidProviderNames: true,
                includeLinksOnlyOnUserRequest: true,
                imageFirstFormatting: true,
              },
            });
          }
        }
      }

      if (!skipCache) {
        const cached = await ctx.runQuery(
          appApi.properties.getCachedSearchResults,
          {
            userId,
            threadId,
            query,
            limit,
            maxAgeMs: SEARCH_CACHE_TTL_MS,
          },
        );
        if (
          cached?.propertyFindings &&
          cached.propertyFindings.length >= Math.min(limit, 3)
        ) {
          const cachedFindings = filterCachedFindingsByExcludedUrls(
            cached.propertyFindings as CachedFinding[],
            excludedUrlKeys,
          );
          if (cachedFindings.length === 0) {
            console.log("[tools.smartPropertySearch] cache_skipped:excluded_all", {
              originalCount: cached.propertyFindings.length,
            });
          } else {
            const enrichedResults = normalizeCachedFindingsToUserResults(
              cachedFindings,
              limit,
              query,
              includeImages,
            );
            if (userId && userId !== "anonymous") {
              await storeSearchSummaryInMemory(ctx, {
                userId,
                threadId,
                query,
                locationHint: extractQueryLocation(query),
                budgetHint: extractQueryPriceHint(query),
                findingsCount: enrichedResults.length,
              });
            }
            console.log("[tools.smartPropertySearch] complete", {
              source: "search_memory",
              resultCount: enrichedResults.length,
            });
            await logSearchLifecycle(ctx, appApi, {
              query,
              userId,
              channel,
              stage: "completed",
              status: "success",
              source: "search_memory",
              resultCount: enrichedResults.length,
            });
            await trackExposedPropertyUrls(ctx, appApi, {
              userId,
              threadId,
              query,
              urls: collectResultUrls(enrichedResults),
            });
            return toonEncode({
              searchStarted: true,
              searchStartedMessage,
              localizedSearchStartedMessage: {
                en: searchStartedMessageEn,
                ar: searchStartedMessageAr,
              },
              source: "search_memory",
              responseMode: "search_list",
              results: enrichedResults,
              presentationGuidance: {
                avoidProviderNames: true,
                includeLinksOnlyOnUserRequest: true,
                imageFirstFormatting: true,
              },
            });
          }
        }
      }

      console.log("[tools.smartPropertySearch] web_search:delegating", {
        reason: dbDecision.reason,
        userId,
        channel,
      });
      await logSearchLifecycle(ctx, appApi, {
        query,
        userId,
        channel,
        stage: "serper_attempt",
        status: "success",
      });

      const searchResult = await withDebugTiming(
        "tools.smartPropertySearch",
        "search_agent",
        { query, limit, includeImages },
        async () =>
          runSearchAgent(ctx, {
            query,
            userId: userId ?? "anonymous",
            channel,
            limit,
            refreshToken,
            offset: refreshOffset,
            threadId,
            excludedPropertyUrls,
          }),
      );

      console.log("[tools.smartPropertySearch] search_agent:result", {
        success: searchResult.success,
        findingsCount: searchResult.knowledgePayload.propertyFindings.length,
        userResultsCount: searchResult.userResults.length,
        durationMs: searchResult.durationMs,
        error: searchResult.error,
      });

      if (userId && userId !== "anonymous") {
        await storeKnowledgeResearch(
          ctx,
          {
            properties: {
              logKnowledgeResearch: appApi.properties.logKnowledgeResearch,
            },
          },
          searchResult.knowledgePayload,
        );
      }

      if (searchResult.success) {
        if (searchResult.knowledgePayload.propertyFindings.length > 0) {
          await ctx.runMutation(appApi.properties.upsertGlobalSearchCache, {
            query,
            offset: refreshOffset,
            scope: searchScope,
            propertyFindings: searchResult.knowledgePayload.propertyFindings,
            status: searchResult.knowledgePayload.status,
            createdAt: searchResult.knowledgePayload.createdAt,
          });
        }
        const freshUserResults = filterUserResultsByExcludedUrls(
          searchResult.userResults,
          excludedUrlKeys,
        );
        if (freshUserResults.length === 0) {
          console.log("[tools.smartPropertySearch] search_agent:excluded_all", {
            originalCount: searchResult.userResults.length,
          });
        }
        const queryPriceHint = extractQueryPriceHint(query);
        const queryLocationHint = extractQueryLocationHint(query);
        const enrichedResults = freshUserResults
          .map((r) => {
            const textBlob = `${r.title} ${r.description}`;
            return {
              ...r,
              imageUrl: includeImages ? r.imageUrl : undefined,
              imageUrls: includeImages ? (r.imageUrls ?? []) : [],
              priceHint: normalizePriceHint(
                r.priceHint ?? extractPriceHint(textBlob),
                queryPriceHint,
              ),
              locationHint: normalizeLocationHint(
                r.locationHint ?? extractLocationHint(textBlob),
                queryLocationHint,
              ),
            };
          })
          .slice(0, Math.min(limit, 5));

        if (enrichedResults.length === 0) {
          console.log("[tools.smartPropertySearch] search_agent:no_fresh_results", {
            originalCount: searchResult.userResults.length,
          });
        } else {
          if (userId && userId !== "anonymous") {
            await storeSearchSummaryInMemory(ctx, {
              userId,
              threadId,
              query,
              locationHint:
                queryLocationHint ??
                extractQueryLocation(query) ??
                enrichedResults[0]?.locationHint,
              budgetHint: queryPriceHint ?? enrichedResults[0]?.priceHint,
              findingsCount: enrichedResults.length,
            });
          }

          console.log("[tools.smartPropertySearch] complete", {
            source: "search_agent",
            resultCount: enrichedResults.length,
            durationMs: searchResult.durationMs,
          });
          await logSearchLifecycle(ctx, appApi, {
            query,
            userId,
            channel,
            stage: "completed",
            status: "success",
            source: "serper",
            resultCount: enrichedResults.length,
          });
          await trackExposedPropertyUrls(ctx, appApi, {
            userId,
            threadId,
            query,
            urls: collectResultUrls(enrichedResults),
          });
          return toonEncode({
            searchStarted: true,
            searchStartedMessage,
            localizedSearchStartedMessage: {
              en: searchStartedMessageEn,
              ar: searchStartedMessageAr,
            },
            source: "web_fallback",
            refreshOffset,
            responseMode: "search_list",
            results: enrichedResults,
            knowledgeResearch: {
              taskList: searchResult.knowledgePayload.taskList,
              searchTerms: searchResult.knowledgePayload.searchTerms,
              sourceRuns: searchResult.knowledgePayload.sourceRuns.length,
              findings: searchResult.knowledgePayload.propertyFindings.length,
              orchestrationTrace: (searchResult.orchestrationTrace ?? []).map(
                ({ stage, status, meta }) => ({
                  stage,
                  status,
                  ...(meta ? { meta } : {}),
                }),
              ),
              coverageReport: searchResult.coverageReport,
            },
            presentationGuidance: {
              avoidProviderNames: true,
              includeLinksOnlyOnUserRequest: true,
              imageFirstFormatting: true,
            },
          });
        }
      }

      console.log("[tools.smartPropertySearch] search_agent:fallback", {
        reason: searchResult.error ?? "no_results",
        hasDbResults: dbResults.length > 0,
      });
      await logSearchLifecycle(ctx, appApi, {
        query,
        userId,
        channel,
        stage: "failed",
        status: "error",
        source: "failed",
        errorMessage: searchResult.error,
      });

      if (dbResults.length > 0) {
        if (userId && userId !== "anonymous") {
          await logKnowledgeResearchRecord(
            ctx,
            appApi,
            buildKnowledgePayloadFromDbResults({
              query,
              userId,
              channel,
              threadId,
              dbResults,
              status: "partial",
              errorSummary: searchResult.error,
            }),
          );
        }
        const dbFallbackOutput = normalizeDbResultsForOutput(dbResults);
        await trackExposedPropertyUrls(ctx, appApi, {
          userId,
          threadId,
          query,
          urls: collectResultUrls(dbFallbackOutput),
        });
        return toonEncode({
          searchStarted: true,
          searchStartedMessage,
          localizedSearchStartedMessage: {
            en: searchStartedMessageEn,
            ar: searchStartedMessageAr,
          },
          source: "internal_db",
          responseMode: "search_list",
          results: dbFallbackOutput,
          note: "I returned the closest internal matches while searching wider options.",
          presentationGuidance: {
            avoidProviderNames: true,
            includeLinksOnlyOnUserRequest: true,
            imageFirstFormatting: true,
          },
        });
      }

      return toonEncode({
        searchStarted: true,
        searchStartedMessage,
        localizedSearchStartedMessage: {
          en: searchStartedMessageEn,
          ar: searchStartedMessageAr,
        },
        source: "web_fallback_failed",
        responseMode: "search_list",
        results: [],
        note: "I could not find matching options right now. Try refining location or budget.",
      });

    },
  });

  return {
    smartPropertySearch,
    getLastSearchContext,
    getLastSearchFindings,
  };
}
