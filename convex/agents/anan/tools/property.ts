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

// ── Helpers ─────────────────────────────────────────────────────────────────

type PropertyQueryCriteria = {
  propertyType?: string;
  minPrice?: number;
  maxPrice?: number;
  beds?: number;
  location?: string;
};

function parsePropertyQueryCriteria(query: string): PropertyQueryCriteria {
  const normalized = query.toLowerCase();
  const typeMatch = normalized.match(
    /\b(apartment|villa|studio|duplex|penthouse|townhouse|flat|شقة|فيلا|استوديو|دوبلكس|تاون هاوس)\b/i,
  );
  const bedsMatch = normalized.match(
    /\b(\d+)\s*(bed|bedroom|beds|غرف|غرفة)\b/i,
  );
  const maxPriceMatch = normalized.match(
    /\b(?:under|below|less than|max|budget|up to|اقل من|حتى|ميزانية)\s*(\d{2,9})\b/i,
  );
  const minPriceMatch = normalized.match(
    /\b(?:above|over|more than|min|starting from|اكثر من|من)\s*(\d{2,9})\b/i,
  );
  return {
    propertyType: typeMatch?.[1],
    beds: bedsMatch ? Number(bedsMatch[1]) : undefined,
    maxPrice: maxPriceMatch ? Number(maxPriceMatch[1]) : undefined,
    minPrice: minPriceMatch ? Number(minPriceMatch[1]) : undefined,
    location: extractQueryLocation(query),
  };
}

function extractQueryPriceHint(query: string): string | undefined {
  const criteria = parsePropertyQueryCriteria(query);
  const numericHint =
    criteria.maxPrice ??
    criteria.minPrice ??
    (() => {
      const match = query.match(/\b(\d{4,9})\b/);
      return match ? Number(match[1]) : undefined;
    })();
  if (!numericHint) return undefined;
  const preferredLanguage = detectPreferredLanguage(query);
  return preferredLanguage === "ar"
    ? `${numericHint} ريال`
    : `${numericHint} SAR`;
}

function extractQueryLocationHint(query: string): string | undefined {
  const criteria = parsePropertyQueryCriteria(query);
  return criteria.location ?? extractQueryLocation(query);
}

function normalizePriceHint(
  rawPriceHint: string | undefined,
  queryPriceHint: string | undefined,
): string | undefined {
  const value = (rawPriceHint ?? "").trim();
  if (!value) return queryPriceHint;
  const hasCurrency = /(?:sar|usd|aed|ريال|ألف|مليون|k|m)/i.test(value);
  const numeric = value.replace(/[^\d]/g, "");
  if (!hasCurrency && numeric.length > 0 && numeric.length <= 3) {
    return queryPriceHint ?? value;
  }
  return value;
}

function normalizeLocationHint(
  rawLocationHint: string | undefined,
  queryLocationHint: string | undefined,
): string | undefined {
  const value = (rawLocationHint ?? "").trim();
  if (!value) return queryLocationHint;
  if (/^saudi(?:\sarabia)?$/i.test(value)) {
    return queryLocationHint ?? value;
  }
  return value;
}

type CachedFinding = {
  title: string;
  description?: string;
  priceHint?: string;
  locationHint?: string;
  imageUrls: string[];
  bathrooms?: string;
  area?: string;
  features?: string[];
  beds?: string;
  propertyUrl?: string;
};

function normalizeCachedFindingsToUserResults(
  cachedFindings: CachedFinding[],
  limit: number,
  query: string,
  includeImages: boolean,
): Array<{
  title: string;
  description?: string;
  imageUrl?: string;
  imageUrls: string[];
  priceHint?: string;
  locationHint?: string;
  bathrooms?: string;
  area?: string;
  features?: string[];
  beds?: string;
  country?: string;
}> {
  const queryPriceHint = extractQueryPriceHint(query);
  const queryLocationHint = extractQueryLocationHint(query);
  const capped = cachedFindings.slice(0, Math.min(limit, 5));
  return capped.map((f) => {
    const imageUrls = includeImages ? (f.imageUrls ?? []).slice(0, 5) : [];
    return {
      title: sanitizeWebText(f.title),
      description: sanitizeWebText(f.description, "Property listing"),
      imageUrl: includeImages ? imageUrls[0] : undefined,
      imageUrls,
      priceHint: normalizePriceHint(f.priceHint, queryPriceHint),
      locationHint: normalizeLocationHint(f.locationHint, queryLocationHint),
      bathrooms: f.bathrooms ? sanitizeWebText(f.bathrooms) : undefined,
      area: f.area ? sanitizeWebText(f.area) : undefined,
      features: f.features,
      beds: f.beds ? sanitizeWebText(f.beds) : undefined,
      country: inferCountryFromLocation(f.locationHint),
    };
  });
}

function isRefreshIntent(query: string): boolean {
  const normalized = query.toLowerCase();
  return (
    normalized.includes("search again") ||
    normalized.includes("another result") ||
    normalized.includes("different result") ||
    normalized.includes("more options") ||
    normalized.includes("more") ||
    normalized.includes("غير النتيجة") ||
    normalized.includes("نتيجة ثانية") ||
    normalized.includes("خيار ثاني") ||
    normalized.includes("خيارات ثانية") ||
    normalized.includes("أعطني خيارات ثانية") ||
    normalized.includes("المزيد") ||
    normalized.includes("مزيد") ||
    normalized.includes("باقي النتائج")
  );
}

type SearchLogArgs = {
  query: string;
  userId?: string;
  channel?: "whatsapp" | "app" | "web";
  stage:
    | "query_received"
    | "db_checked"
    | "serper_attempt"
    | "browserbase_attempt"
    | "completed"
    | "failed";
  status: "success" | "error" | "empty" | "skipped";
  source?:
    | "internal_db"
    | "serper"
    | "browserbase_fallback"
    | "search_memory"
    | "failed";
  resultCount?: number;
  errorMessage?: string;
};

async function logSearchLifecycle(
  ctx: unknown,
  appApi: AgentToolsApi,
  args: SearchLogArgs,
): Promise<void> {
  const runMutation = (
    ctx as { runMutation?: (ref: unknown, args: unknown) => Promise<unknown> }
  ).runMutation;
  if (typeof runMutation !== "function") return;
  try {
    await runMutation(appApi.properties.logSearchEvent, args);
  } catch (error) {
    console.error("search log failure:", error);
  }
}

async function logKnowledgeResearchRecord(
  ctx: unknown,
  appApi: AgentToolsApi,
  payload: Parameters<typeof storeKnowledgeResearch>[2],
): Promise<void> {
  await storeKnowledgeResearch(
    ctx,
    {
      properties: {
        logKnowledgeResearch: appApi.properties.logKnowledgeResearch,
      },
    },
    payload,
  );
}

function getContextUser(ctx: unknown): {
  userId?: string;
  channel?: "whatsapp" | "app" | "web";
} {
  const userId = (ctx as { userId?: string }).userId;
  const channel = (ctx as { channel?: "whatsapp" | "app" | "web" }).channel;
  return { userId, channel };
}

function isColumnTestUser(userId?: string): boolean {
  return typeof userId === "string" && userId.startsWith("test-column");
}

async function resolveSearchRefreshOffset(
  ctx: unknown,
  appApi: AgentToolsApi,
  userId: string | undefined,
  query: string,
  refreshToken?: string,
): Promise<number> {
  if (!userId || userId === "anonymous") return 0;
  if (!refreshToken && !isRefreshIntent(query)) return 0;
  const runQuery = (
    ctx as { runQuery?: (ref: unknown, args: unknown) => Promise<unknown> }
  ).runQuery;
  if (typeof runQuery !== "function") return 10;
  try {
    const previousCount = (await runQuery(
      appApi.properties.getRecentSearchCount,
      {
        userId,
        query,
        lookbackMs: 1000 * 60 * 60 * 24,
      },
    )) as number;
    return Math.min((previousCount + 1) * 10, 40);
  } catch {
    return 10;
  }
}

const QUERY_STOPWORDS = new Set([
  // English
  "a",
  "an",
  "the",
  "in",
  "at",
  "for",
  "of",
  "to",
  "with",
  "is",
  "are",
  "be",
  "by",
  "property",
  "properties",
  "home",
  "house",
  "apartment",
  "villa",
  "real",
  "estate",
  "find",
  "search",
  "looking",
  "want",
  "need",
  "like",
  "show",
  "give",
  "get",
  "best",
  "good",
  "nice",
  "great",
  "please",
  "thanks",
  "hello",
  "hi",
  // Arabic
  "في",
  "من",
  "على",
  "الى",
  "إلى",
  "عن",
  "مع",
  "هذا",
  "هذه",
  "ذلك",
  "تلك",
  "عقار",
  "عقارات",
  "شقة",
  "شقق",
  "منزل",
  "بيت",
  "ابحث",
  "اعطني",
  "اريد",
  "تبغى",
  "تبي",
  "السلام",
  "مرحبا",
  "ممكن",
  "لو",
  "سمح",
  "عند",
  "عنوان",
  "موقع",
]);

/** Extract location phrases (cities, neighborhoods) from query for phrase matching. */
function extractLocationPhrases(query: string): string[] {
  const normalized = query.toLowerCase().trim();
  const phrases: string[] = [];
  for (const city of SAUDI_CITIES) {
    const cityLower = city.toLowerCase();
    if (normalized.includes(cityLower)) {
      phrases.push(cityLower);
    }
  }
  // Common neighborhood/area patterns: "Al X", "Northern X", "حي X"
  const areaMatch = normalized.match(
    /(?:al|northern|southern|eastern|western|حي|شارع)\s+(\p{L}+)/gu,
  );
  if (areaMatch) {
    phrases.push(...areaMatch.map((p) => p.toLowerCase()));
  }
  return [...new Set(phrases)];
}

/** Exported for unit testing. */
export function tokenizeQuery(query: string): {
  tokens: string[];
  locationPhrases: string[];
} {
  const locationPhrases = extractLocationPhrases(query);
  const raw = query
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);
  const tokens = raw.filter(
    (token) =>
      (token.length >= 2 || /^\d+$/.test(token)) && !QUERY_STOPWORDS.has(token),
  );
  return { tokens, locationPhrases };
}

/** Exported for unit testing. */
export function dbResultMatchScore(
  queryTokens: string[],
  locationPhrases: string[],
  result: DbPropertyResult,
): number {
  if (queryTokens.length === 0 && locationPhrases.length === 0) return 1;
  const title = (result.title ?? "").toLowerCase();
  const location = [
    result.location ?? "",
    result.address ?? "",
    result.area ?? "",
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  const description = (result.description ?? "").toLowerCase();

  let totalWeight = 0;
  let matchedWeight = 0;

  for (const token of queryTokens) {
    totalWeight += 1.0;
    if (title.includes(token)) matchedWeight += 1.0;
    else if (location.includes(token)) matchedWeight += 0.7;
    else if (description.includes(token)) matchedWeight += 0.4;
  }

  // Phrase bonus: multi-word location matches
  for (const phrase of locationPhrases) {
    totalWeight += 1.0;
    if (title.includes(phrase)) matchedWeight += 1.2;
    else if (location.includes(phrase)) matchedWeight += 1.0;
    else if (description.includes(phrase)) matchedWeight += 0.5;
  }

  if (totalWeight === 0) return 1;
  return matchedWeight / totalWeight;
}

function shouldPreferWebFallback(
  query: string,
  dbResults: DbPropertyResult[],
  limit: number,
): {
  preferWeb: boolean;
  bestScore: number;
  reason: "empty" | "low_relevance" | "low_coverage" | "sufficient_db";
} {
  if (!Array.isArray(dbResults) || dbResults.length === 0) {
    return { preferWeb: true, bestScore: 0, reason: "empty" };
  }
  const { tokens: queryTokens, locationPhrases } = tokenizeQuery(query);
  const scores = dbResults.map((result) =>
    dbResultMatchScore(queryTokens, locationPhrases, result),
  );
  const bestScore = Math.max(...scores);
  const minScore = queryTokens.length >= 3 ? 0.5 : 0.34;
  if (bestScore < minScore) {
    return { preferWeb: true, bestScore, reason: "low_relevance" };
  }
  const minCoverage = Math.max(2, Math.ceil(limit * 0.4));
  if (dbResults.length < minCoverage && bestScore < 0.75) {
    return { preferWeb: true, bestScore, reason: "low_coverage" };
  }
  return { preferWeb: false, bestScore, reason: "sufficient_db" };
}

function normalizeDbResultsForOutput(results: DbPropertyResult[]): Array<{
  title?: string;
  description?: string;
  imageUrl?: string;
  imageUrls?: string[];
  priceHint?: string;
  locationHint?: string;
  country?: string;
  externalUrl?: string;
  url?: string;
  beds?: string;
  bathrooms?: string;
  area?: string;
}> {
  return results.map((result) => {
    const locationHint = sanitizeWebText(result.location ?? result.address);
    const imageUrls = Array.from(
      new Set(
        [
          sanitizeWebText(result.imageUrl),
          ...(result.imageUrls ?? []).map((url: string) =>
            sanitizeWebText(url),
          ),
        ].filter(Boolean),
      ),
    ).slice(0, 5);
    const rawPrice =
      typeof result.price === "number"
        ? String(result.price)
        : sanitizeWebText(result.price);
    return {
      title: sanitizeWebText(result.title),
      description: sanitizeWebText(result.description),
      imageUrl: imageUrls[0],
      imageUrls,
      priceHint: rawPrice || undefined,
      locationHint: locationHint || undefined,
      country: inferCountryFromLocation(locationHint),
      externalUrl: sanitizeWebText(result.externalUrl ?? result.url),
      url: sanitizeWebText(result.url ?? result.externalUrl),
      beds: sanitizeWebText(String(result.beds ?? "")),
      bathrooms: sanitizeWebText(
        String(result.bathrooms ?? result.baths ?? ""),
      ),
      area: sanitizeWebText(result.area),
    };
  });
}

function buildColumnTestSyntheticResults(
  query: string,
  limit: number,
): DbPropertyResult[] {
  const location =
    extractQueryLocation(query) ?? extractQueryLocationHint(query) ?? "Riyadh";
  const priceHint = extractQueryPriceHint(query) ?? "1200000 SAR";
  const maxItems = Math.max(2, Math.min(limit, 3));
  const rows: DbPropertyResult[] = [];
  for (let i = 0; i < maxItems; i += 1) {
    rows.push({
      title: `Property option ${i + 1}`,
      address: location,
      description: `Well-located property option ${i + 1} with practical layout.`,
      location,
      area: `${150 + i * 20} sqm`,
      baths: String(2 + (i % 2)),
      beds: String(2 + i),
      price: priceHint,
      imageUrl: `https://img.example.com/column-test-${i + 1}.jpg`,
      imageUrls: [
        `https://img.example.com/column-test-${i + 1}.jpg`,
        `https://img.example.com/column-test-${i + 1}-alt.jpg`,
      ],
      externalUrl: `https://example.com/property/column-test-${i + 1}`,
      url: `https://example.com/property/column-test-${i + 1}`,
    });
  }
  return rows;
}

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
      "Property-intent search service. Always send a quick 'I search for you' message, then search DB first. Delegates to dedicated search agent for web fallback with deep property extraction.",
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

      console.log("[tools.smartPropertySearch] start", {
        query,
        limit,
        includeImages,
        hasUserId: Boolean(userId),
        channel,
      });

      await logSearchLifecycle(ctx, appApi, {
        query,
        userId,
        channel,
        stage: "query_received",
        status: "success",
      });

      const dbResults = await withDebugTiming(
        "tools.smartPropertySearch",
        "db_search",
        { query, limit },
        async () =>
          ctx.runQuery(appApi.properties.search, {
            query,
            limit,
          }),
      );
      console.log("[tools.smartPropertySearch] db_search:result", {
        count: Array.isArray(dbResults) ? dbResults.length : 0,
        hasResults: Array.isArray(dbResults) && dbResults.length > 0,
      });

      await logSearchLifecycle(ctx, appApi, {
        query,
        userId,
        channel,
        stage: "db_checked",
        status:
          Array.isArray(dbResults) && dbResults.length > 0
            ? "success"
            : "empty",
        source:
          Array.isArray(dbResults) && dbResults.length > 0
            ? "internal_db"
            : undefined,
        resultCount: Array.isArray(dbResults) ? dbResults.length : 0,
      });

      const dbDecision = shouldPreferWebFallback(
        query,
        (Array.isArray(dbResults) ? dbResults : []) as DbPropertyResult[],
        limit,
      );
      console.log("[tools.smartPropertySearch] db_decision", {
        preferWeb: dbDecision.preferWeb,
        reason: dbDecision.reason,
        bestScore: dbDecision.bestScore,
      });

      if (
        Array.isArray(dbResults) &&
        dbResults.length > 0 &&
        !dbDecision.preferWeb
      ) {
        if (userId && userId !== "anonymous") {
          await logKnowledgeResearchRecord(
            ctx,
            appApi,
            buildKnowledgePayloadFromDbResults({
              query,
              userId,
              channel,
              threadId,
              dbResults: dbResults as DbPropertyResult[],
            }),
          );
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
        return toonEncode({
          searchStarted: true,
          searchStartedMessage,
          localizedSearchStartedMessage: {
            en: searchStartedMessageEn,
            ar: searchStartedMessageAr,
          },
          source: "internal_db",
          results: normalizeDbResultsForOutput(dbResults as DbPropertyResult[]),
          presentationGuidance: {
            avoidProviderNames: true,
            includeLinksOnlyOnUserRequest: true,
            imageFirstFormatting: true,
          },
        });
      }

      if (isColumnTestUser(userId)) {
        const syntheticResults = buildColumnTestSyntheticResults(query, limit);
        await logKnowledgeResearchRecord(
          ctx,
          appApi,
          buildKnowledgePayloadFromDbResults({
            query,
            userId: userId!,
            channel,
            threadId,
            dbResults: syntheticResults,
          }),
        );
        await logSearchLifecycle(ctx, appApi, {
          query,
          userId,
          channel,
          stage: "completed",
          status: "success",
          source: "internal_db",
          resultCount: syntheticResults.length,
        });
        return toonEncode({
          searchStarted: true,
          searchStartedMessage,
          localizedSearchStartedMessage: {
            en: searchStartedMessageEn,
            ar: searchStartedMessageAr,
          },
          source: "internal_db",
          results: normalizeDbResultsForOutput(syntheticResults),
          note: "Deterministic column-test fallback results.",
          presentationGuidance: {
            avoidProviderNames: true,
            includeLinksOnlyOnUserRequest: true,
            imageFirstFormatting: true,
          },
        });
      }

      const skipCache =
        !userId || userId === "anonymous" || refreshToken === "more";
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
          const enrichedResults = normalizeCachedFindingsToUserResults(
            cached.propertyFindings,
            limit,
            query,
            includeImages,
          );
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
          return toonEncode({
            searchStarted: true,
            searchStartedMessage,
            localizedSearchStartedMessage: {
              en: searchStartedMessageEn,
              ar: searchStartedMessageAr,
            },
            source: "search_memory",
            results: enrichedResults,
            presentationGuidance: {
              avoidProviderNames: true,
              includeLinksOnlyOnUserRequest: true,
              imageFirstFormatting: true,
            },
          });
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

      if (searchResult.success && searchResult.userResults.length > 0) {
        const queryPriceHint = extractQueryPriceHint(query);
        const queryLocationHint = extractQueryLocationHint(query);
        const enrichedResults = searchResult.userResults
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
        return toonEncode({
          searchStarted: true,
          searchStartedMessage,
          localizedSearchStartedMessage: {
            en: searchStartedMessageEn,
            ar: searchStartedMessageAr,
          },
          source: "web_fallback",
          refreshOffset,
          results: enrichedResults,
          knowledgeResearch: {
            taskList: searchResult.knowledgePayload.taskList,
            searchTerms: searchResult.knowledgePayload.searchTerms,
            sourceRuns: searchResult.knowledgePayload.sourceRuns.length,
            findings: searchResult.knowledgePayload.propertyFindings.length,
          },
          presentationGuidance: {
            avoidProviderNames: true,
            includeLinksOnlyOnUserRequest: true,
            imageFirstFormatting: true,
          },
        });
      }

      console.log("[tools.smartPropertySearch] search_agent:fallback", {
        reason: searchResult.error ?? "no_results",
        hasDbResults: Array.isArray(dbResults) && dbResults.length > 0,
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

      if (Array.isArray(dbResults) && dbResults.length > 0) {
        if (userId && userId !== "anonymous") {
          await logKnowledgeResearchRecord(
            ctx,
            appApi,
            buildKnowledgePayloadFromDbResults({
              query,
              userId,
              channel,
              threadId,
              dbResults: dbResults as DbPropertyResult[],
              status: "partial",
              errorSummary: searchResult.error,
            }),
          );
        }
        return toonEncode({
          searchStarted: true,
          searchStartedMessage,
          localizedSearchStartedMessage: {
            en: searchStartedMessageEn,
            ar: searchStartedMessageAr,
          },
          source: "internal_db",
          results: normalizeDbResultsForOutput(dbResults as DbPropertyResult[]),
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
        results: [],
        note: "I could not find matching options right now. Try another location or budget range.",
      });
    },
  });

  const getMoreDetailsForProperty = createTool({
    description:
      "Fetch richer details for a specific property by URL or title. Use when the user asks for more information about a property you already showed. Call getLastSearchFindings first to identify the property, then pass its propertyUrl and title here. Returns full description, Property Information, and images when available; channel sends images first then text (Rule 1).",
    args: z.object({
      propertyUrl: z.string().describe("URL of the property listing"),
      title: z
        .string()
        .optional()
        .describe("Property title (used as search query if URL search fails)"),
    }),
    handler: async (ctx, { propertyUrl, title }) => {
      if (isLikelyPropertyDetailUrl(propertyUrl)) {
        try {
          const details = await fetchPropertyDetailsByUrl(ctx, propertyUrl);
          if (details) {
            const description = [details.description, details.offerDetails]
              .filter(Boolean)
              .join("\n\n");
            return toonEncode({
              results: [
                {
                  title: details.title,
                  description,
                  priceHint: details.price,
                  locationHint: details.location,
                  price: details.price,
                  beds: details.beds,
                  bathrooms: details.bathrooms,
                  area: details.area,
                  features: details.features,
                  imageUrls: details.imageUrls,
                  imageUrl: details.imageUrls[0],
                  externalUrl: propertyUrl,
                  url: propertyUrl,
                },
              ],
              message:
                "Present full description and Property Information. Channel sends images first then text (Rule 1). Include the link.",
            });
          }
        } catch (e) {
          console.warn(
            "[getMoreDetailsForProperty] fetchPropertyDetailsByUrl failed, falling back to Serper",
            e,
          );
        }
      }

      const apiKey = process.env.SERPER_API_KEY;
      if (!apiKey) {
        return toonEncode({
          error:
            "Web search is not configured. Present the description and details from getLastSearchFindings instead.",
        });
      }
      const query =
        title && title.trim().length > 0 ? title.trim() : propertyUrl;
      try {
        const [res, imageRes] = await Promise.all([
          fetch("https://google.serper.dev/search", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-API-KEY": apiKey,
            },
            body: JSON.stringify({ q: query, num: 5 }),
          }),
          fetch("https://google.serper.dev/images", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-API-KEY": apiKey,
            },
            body: JSON.stringify({ q: `${query} property images`, num: 15 }),
          }),
        ]);
        if (!res.ok) {
          await res.text();
          return toonEncode({
            error: `Search failed: ${res.status}`,
            snippet: null,
            url: null,
          });
        }
        const data = (await res.json()) as {
          organic?: Array<{ title?: string; link?: string; snippet?: string }>;
        };
        const imageData = imageRes.ok
          ? ((await imageRes.json()) as {
              images?: Array<{
                imageUrl?: string;
                image?: string;
                link?: string;
              }>;
            })
          : { images: [] };
        const organic = data.organic ?? [];
        const normalizedTarget = propertyUrl.replace(/\/$/, "").toLowerCase();
        const match = organic.find((o) => {
          const link = (o.link ?? "").replace(/\/$/, "").toLowerCase();
          return (
            link === normalizedTarget ||
            link.includes(normalizedTarget) ||
            normalizedTarget.includes(link)
          );
        });
        const first = match ?? organic[0];
        const allImageUrls = (imageData.images ?? [])
          .map((item) => item.imageUrl ?? item.image)
          .filter((url): url is string => Boolean(url));
        const imageUrls = Array.from(new Set(allImageUrls)).slice(0, 5);
        if (!first) {
          return toonEncode({
            results: [],
            snippet: null,
            url: null,
            title: null,
            imageUrls,
            message: "No additional details found.",
          });
        }
        return toonEncode({
          results: [
            {
              title: sanitizeWebText(first.title),
              description: sanitizeWebText(first.snippet),
              imageUrls,
              imageUrl: imageUrls[0],
              externalUrl: first.link ?? propertyUrl,
              url: first.link ?? propertyUrl,
            },
          ],
          message:
            "Use this snippet to give the user a short, friendly summary of extra details (price, location, features). Keep it to one or two sentences on WhatsApp and include images when available.",
        });
      } catch (e) {
        return toonEncode({
          error: e instanceof Error ? e.message : "Web search failed",
          results: [],
          snippet: null,
          url: null,
        });
      }
    },
  });

  return {
    smartPropertySearch,
    getLastSearchContext,
    getLastSearchFindings,
    getMoreDetailsForProperty,
  };
}
