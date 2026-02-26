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

// ── Helpers ─────────────────────────────────────────────────────────────────

export async function storeSearchSummaryInMemory(
  ctx: unknown,
  params: {
    userId: string;
    threadId?: string;
    query: string;
    locationHint?: string;
    budgetHint?: string;
    findingsCount: number;
  },
): Promise<void> {
  const runMutation = (
    ctx as { runMutation?: (ref: unknown, args: unknown) => Promise<unknown> }
  ).runMutation;
  if (typeof runMutation !== "function") return;
  try {
    await runMutation(internal.services.memory.storeSearchSummaryInternal, {
      userId: params.userId,
      threadId: params.threadId,
      query: params.query,
      locationHint: params.locationHint,
      budgetHint: params.budgetHint,
      findingsCount: params.findingsCount,
    });
  } catch (e) {
    console.warn("[property.storeSearchSummaryInMemory] failed:", e);
  }
}

export type PropertyQueryCriteria = {
  propertyType?: string;
  minPrice?: number;
  maxPrice?: number;
  beds?: number;
  location?: string;
};

export function parsePropertyQueryCriteria(query: string): PropertyQueryCriteria {
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

export function extractQueryPriceHint(query: string): string | undefined {
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

export function extractQueryLocationHint(query: string): string | undefined {
  const criteria = parsePropertyQueryCriteria(query);
  return criteria.location ?? extractQueryLocation(query);
}

export function normalizePriceHint(
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

export function normalizeLocationHint(
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

export function normalizeUrlKey(url: string | undefined): string | null {
  if (!url) return null;
  return url.trim().replace(/\/+$/, "").toLowerCase() || null;
}

export function shouldExcludePreviousResults(query: string, refreshToken?: string): boolean {
  return Boolean(refreshToken) || isRefreshIntent(query);
}

export type CachedFinding = {
  sourceUrl?: string;
  sourceTitle?: string;
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
  detailSourceUrl?: string;
  detailFetched?: boolean;
};

export function normalizeCachedFindingsToUserResults(
  cachedFindings: CachedFinding[],
  limit: number,
  query: string,
  includeImages: boolean,
): Array<{
  sourceUrl?: string;
  sourceTitle?: string;
  externalUrl?: string;
  url?: string;
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
      sourceUrl: sanitizeWebText(f.sourceUrl),
      sourceTitle: sanitizeWebText(f.sourceTitle),
      externalUrl: sanitizeWebText(f.propertyUrl ?? f.detailSourceUrl),
      url: sanitizeWebText(f.propertyUrl ?? f.detailSourceUrl),
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

export function isRefreshIntent(query: string): boolean {
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

export function detectSearchScopeFromQuery(query: string): "saudi" | "uae" | "global" {
  const normalized = query.toLowerCase();
  if (
    /(?:saudi|السعودية|riyadh|الرياض|jeddah|جدة|dammam|الدمام|khobar|الخبر)/i.test(
      normalized,
    )
  ) {
    return "saudi";
  }
  if (
    /(?:uae|dubai|abu dhabi|sharjah|ajman|الامارات|الإمارات|دبي|ابوظبي|أبوظبي|الشارقة|عجمان)/i.test(
      normalized,
    )
  ) {
    return "uae";
  }
  return "global";
}

export type SearchLogArgs = {
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

export async function logSearchLifecycle(
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

export async function logKnowledgeResearchRecord(
  ctx: GenericActionCtx<DataModel>,
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

export function getContextUser(ctx: unknown): {
  userId?: string;
  channel?: "whatsapp" | "app" | "web";
} {
  const userId = (ctx as { userId?: string }).userId;
  const channel = (ctx as { channel?: "whatsapp" | "app" | "web" }).channel;
  return { userId, channel };
}



export async function resolveSearchRefreshOffset(
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

export async function resolveExcludedPropertyUrls(
  ctx: unknown,
  appApi: AgentToolsApi,
  userId: string | undefined,
  threadId: string | undefined,
  query: string,
  refreshToken?: string,
): Promise<string[]> {
  if (!userId || userId === "anonymous") return [];
  if (!shouldExcludePreviousResults(query, refreshToken)) return [];
  const runQuery = (
    ctx as { runQuery?: (ref: unknown, args: unknown) => Promise<unknown> }
  ).runQuery;
  if (typeof runQuery !== "function") return [];
  try {
    const lastFindings = (await runQuery(appApi.properties.getLastSearchFindings, {
      userId,
      threadId,
      maxFindings: 50,
    })) as
      | {
        findings?: Array<{
          propertyUrl?: string;
          detailSourceUrl?: string;
        }>;
      }
      | null;
    if (!lastFindings?.findings?.length) return [];
    return Array.from(
      new Set(
        lastFindings.findings
          .flatMap((f) => [f.propertyUrl, f.detailSourceUrl])
          .map((url) => normalizeUrlKey(url))
          .filter((url): url is string => Boolean(url)),
      ),
    );
  } catch {
    return [];
  }
}

export async function resolveSeenExposureUrls(
  ctx: unknown,
  appApi: AgentToolsApi,
  userId: string | undefined,
  threadId: string | undefined,
  query: string,
): Promise<string[]> {
  if (!userId || userId === "anonymous") return [];
  if (!appApi.properties.getUserPropertyExposureKeys) return [];
  const runQuery = (
    ctx as { runQuery?: (ref: unknown, args: unknown) => Promise<unknown> }
  ).runQuery;
  if (typeof runQuery !== "function") return [];
  try {
    const keys = (await runQuery(appApi.properties.getUserPropertyExposureKeys, {
      userId,
      threadId,
      query,
      lookbackMs: 24 * 60 * 60 * 1000,
    })) as string[];
    return Array.isArray(keys) ? keys : [];
  } catch {
    return [];
  }
}

export async function trackExposedPropertyUrls(
  ctx: unknown,
  appApi: AgentToolsApi,
  params: {
    userId: string | undefined;
    threadId: string | undefined;
    query: string;
    urls: Array<string | undefined>;
  },
): Promise<void> {
  if (!params.userId || params.userId === "anonymous") return;
  if (!appApi.properties.trackUserPropertyExposure) return;
  const runMutation = (
    ctx as { runMutation?: (ref: unknown, args: unknown) => Promise<unknown> }
  ).runMutation;
  if (typeof runMutation !== "function") return;
  const propertyUrls = Array.from(
    new Set(
      params.urls
        .map((url) => sanitizeWebText(url))
        .filter((url): url is string => Boolean(url)),
    ),
  );
  if (propertyUrls.length === 0) return;
  try {
    await runMutation(appApi.properties.trackUserPropertyExposure, {
      userId: params.userId,
      threadId: params.threadId,
      query: params.query,
      propertyUrls,
    });
  } catch (error) {
    console.warn("[property.trackExposedPropertyUrls] failed:", error);
  }
}

export const QUERY_STOPWORDS = new Set([
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
export function extractLocationPhrases(query: string): string[] {
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

export function shouldPreferWebFallback(
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

export function normalizeDbResultsForOutput(results: DbPropertyResult[]): Array<{
  sourceUrl?: string;
  sourceTitle?: string;
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
      sourceUrl: "internal://properties",
      sourceTitle: "Internal property database",
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

export function filterCachedFindingsByExcludedUrls(
  findings: CachedFinding[],
  excludedUrlKeys: Set<string>,
): CachedFinding[] {
  if (excludedUrlKeys.size === 0) return findings;
  return findings.filter((finding) => {
    const key = normalizeUrlKey(finding.propertyUrl ?? finding.detailSourceUrl);
    return !key || !excludedUrlKeys.has(key);
  });
}

export function filterDbResultsByExcludedUrls(
  results: DbPropertyResult[],
  excludedUrlKeys: Set<string>,
): DbPropertyResult[] {
  if (excludedUrlKeys.size === 0) return results;
  return results.filter((result) => {
    const key = normalizeUrlKey(result.externalUrl ?? result.url);
    return !key || !excludedUrlKeys.has(key);
  });
}

export function filterUserResultsByExcludedUrls<
  T extends { externalUrl?: string; url?: string },
>(results: T[], excludedUrlKeys: Set<string>): T[] {
  if (excludedUrlKeys.size === 0) return results;
  return results.filter((result) => {
    const key = normalizeUrlKey(result.externalUrl ?? result.url);
    return !key || !excludedUrlKeys.has(key);
  });
}

export function collectResultUrls(
  results: Array<{ externalUrl?: string; url?: string }>,
): string[] {
  return Array.from(
    new Set(
      results
        .flatMap((result) => [result.externalUrl, result.url])
        .map((url) => sanitizeWebText(url))
        .filter((url): url is string => Boolean(url)),
    ),
  );
}

