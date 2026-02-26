/**
 * Serper web search for property listings.
 */

import { cleanWhitespace, sanitizeWebText } from "../../_lib/sanitize";
import { fetchJsonWithRetry } from "../../_lib/http";
import {
  extractQueryLocation,
  getDomain,
  isBlockedDomain,
  isLikelyHomePageUrl,
  isLikelyPropertyDetailUrl,
} from "../../_lib/location";
import {
  INTERNATIONAL_PROPERTY_PRIORITY_DOMAINS,
  PREFERRED_PROPERTY_SOURCE_DOMAINS,
  SAUDI_PROPERTY_PRIORITY_DOMAINS,
  UAE_PROPERTY_PRIORITY_DOMAINS,
  TOP_SOURCE_LIMIT,
  TOP_CARDS_PER_SOURCE,
} from "../../_lib/constants";
import { scorePropertyResult, attachMultipleImages } from "./quality";
import type { SerperResult, SerperImageResult } from "./types";

function readPositiveInt(raw: string | undefined, fallback: number): number {
  if (!raw) return fallback;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

const SERPER_QUERY_PARALLELISM = readPositiveInt(
  process.env.SERPER_QUERY_PARALLELISM,
  3,
);
const SERPER_TIMEOUT_MS = readPositiveInt(process.env.SERPER_TIMEOUT_MS, 7000);
const SERPER_MAX_RETRIES = readPositiveInt(process.env.SERPER_MAX_RETRIES, 2);

type SerperPayload = {
  organic?: Array<{ title?: string; link?: string; snippet?: string }>;
  images?: Array<{ title?: string; link?: string; imageUrl?: string }>;
};

async function runSerperImageSearch(
  query: string,
  limit: number,
  locale: { gl: string; hl: string },
): Promise<SerperImageResult[]> {
  const apiKey = process.env.SERPER_API_KEY;
  if (!apiKey) return [];
  try {
    const data = await fetchJsonWithRetry<{
      images?: Array<{ title?: string; link?: string; imageUrl?: string }>;
    }>(
      "https://google.serper.dev/images",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-KEY": apiKey,
        },
        body: JSON.stringify({
          q: query,
          num: Math.min(limit * 3, 30),
          gl: locale.gl,
          hl: locale.hl,
        }),
      },
      { timeoutMs: SERPER_TIMEOUT_MS, maxRetries: SERPER_MAX_RETRIES },
    );
    return (data.images ?? []).filter((item) => Boolean(item.imageUrl));
  } catch {
    return [];
  }
}

function buildPropertySearchQuery(query: string): string {
  const location = extractQueryLocation(query);
  const baseTerms = ["property", "real estate", "for sale", "listing"];
  const hasPropertyTerms = baseTerms.some((term) =>
    query.toLowerCase().includes(term),
  );
  const hasUaeTerms =
    /\b(uae|dubai|abu dhabi|sharjah|ajman)\b/i.test(query) ||
    /(?:الإمارات|دبي|أبوظبي|الشارقة|عجمان)/i.test(query);
  const hasSaudiTerms =
    /\b(saudi|riyadh|jeddah|dammam|khobar)\b/i.test(query) ||
    /(?:السعود|الرياض|جدة|الدمام|الخبر)/i.test(query);

  let searchQuery = query;
  if (!hasPropertyTerms) {
    searchQuery = `${query} property listing`;
  }

  if (hasUaeTerms && !/uae|united arab emirates/i.test(searchQuery)) {
    searchQuery = `${searchQuery} UAE`;
  } else if (location && !hasSaudiTerms && !hasUaeTerms) {
    searchQuery = `${searchQuery} Saudi Arabia`;
  }

  return searchQuery;
}

function chunkDomains(domains: string[], size: number): string[][] {
  const chunks: string[][] = [];
  for (let i = 0; i < domains.length; i += size) {
    chunks.push(domains.slice(i, i + size));
  }
  return chunks;
}

function detectSearchScope(query: string): "saudi" | "uae" | "global" {
  const q = query.toLowerCase();
  const hasUae =
    /\b(uae|united arab emirates|dubai|abu dhabi|sharjah|ajman)\b/i.test(q) ||
    /(?:الإمارات|دبي|أبوظبي|الشارقة|عجمان)/i.test(query);
  const hasSaudi =
    /\b(saudi|riyadh|jeddah|dammam|khobar|mecca|medina)\b/i.test(q) ||
    /(?:السعود|الرياض|جدة|الدمام|الخبر|مكة|المدينة)/i.test(query);
  if (hasUae && !hasSaudi) return "uae";
  if (hasSaudi && !hasUae) return "saudi";
  return "global";
}

function buildDomainConstrainedQueries(query: string): string[] {
  const scope = detectSearchScope(query);
  const domains =
    scope === "uae"
      ? UAE_PROPERTY_PRIORITY_DOMAINS
      : scope === "saudi"
        ? SAUDI_PROPERTY_PRIORITY_DOMAINS
        : INTERNATIONAL_PROPERTY_PRIORITY_DOMAINS;
  const grouped = chunkDomains(domains, 4).slice(0, 5);
  const scopedQueries = grouped.map((group) => {
    const siteFilter = group.map((d) => `site:${d}`).join(" OR ");
    return `${query} (${siteFilter})`;
  });
  return [query, ...scopedQueries];
}

export function buildTaskList(query: string): string[] {
  return [
    "Create focused search keywords",
    `Search Google for: ${query}`,
    "Fan out search across popular Saudi + UAE property portals (20+ domains) and merge results",
    `Open top ${TOP_SOURCE_LIMIT} source results`,
    `Extract top ${TOP_CARDS_PER_SOURCE} property cards per source`,
    "Rank and deduplicate listing candidates across all sources",
    "Deeply enrich only top 3 candidates (details + gallery)",
    "Keep the rest as lightweight cards to save latency and tokens",
    "Store knowledge research with source lineage",
    "Return user-facing offers without source links",
  ];
}

export function buildSearchTerms(
  query: string,
  refreshToken?: string,
  offset = 0,
): string[] {
  const normalized = cleanWhitespace(query);
  const optimized = buildPropertySearchQuery(query);
  return Array.from(
    new Set([
      normalized,
      optimized,
      refreshToken ? `refresh:${refreshToken}` : "",
      offset > 0 ? `offset:${offset}` : "",
    ]),
  )
    .filter(Boolean)
    .slice(0, 5);
}

export async function runSerperSearch(
  query: string,
  limit: number,
  offset = 0,
): Promise<
  | { ok: true; results: SerperResult[]; images: SerperImageResult[] }
  | { ok: false; error: string }
> {
  const apiKey = process.env.SERPER_API_KEY;
  if (!apiKey) {
    console.log("[anan.search] serper:error", { error: "serper_unavailable" });
    return { ok: false, error: "serper_unavailable" };
  }

  const optimizedQuery = buildPropertySearchQuery(query);
  const scope = detectSearchScope(optimizedQuery);
  const locale =
    scope === "uae" ? { gl: "ae", hl: "ar" } : { gl: "sa", hl: "ar" };
  console.log("[anan.search] serper:start", { query, optimizedQuery });

  try {
    const runSingleQuery = (q: string) =>
      fetchJsonWithRetry<SerperPayload>(
        "https://google.serper.dev/search",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-API-KEY": apiKey,
          },
          body: JSON.stringify({
            q,
            num: Math.min(limit * 2, 20),
            start: Math.max(0, offset),
            gl: locale.gl,
            hl: locale.hl,
          }),
        },
        { timeoutMs: SERPER_TIMEOUT_MS, maxRetries: SERPER_MAX_RETRIES },
      );

    const serperQueries = buildDomainConstrainedQueries(optimizedQuery);
    const responses: SerperPayload[] = [];
    for (let i = 0; i < serperQueries.length; i += SERPER_QUERY_PARALLELISM) {
      const batch = serperQueries.slice(i, i + SERPER_QUERY_PARALLELISM);
      const settledResponses = await Promise.allSettled(
        batch.map((q) => runSingleQuery(q)),
      );
      for (const item of settledResponses) {
        if (item.status === "fulfilled") {
          responses.push(item.value);
        }
      }
    }
    if (responses.length === 0) {
      return { ok: false, error: "serper_multi_query_failed" };
    }

    const organic = responses.flatMap((data) => data.organic ?? []);
    const inlineImages = responses.flatMap((data) => data.images ?? []);
    const dedupedByUrl = new Map<string, SerperResult>();
    for (const item of organic) {
      const link = item.link ?? "";
      if (!link || isBlockedDomain(link) || isLikelyHomePageUrl(link)) continue;
      const key = link.replace(/\/+$/, "").toLowerCase();
      if (dedupedByUrl.has(key)) continue;
      const scored: SerperResult = {
        title: sanitizeWebText(item.title, "Property"),
        description: sanitizeWebText(item.snippet),
        externalUrl: link,
        qualityScore: 0,
      };
      dedupedByUrl.set(key, {
        ...scored,
        qualityScore: scorePropertyResult(scored),
      });
    }

    const results = Array.from(dedupedByUrl.values())
      .filter((r) => (r.qualityScore ?? 0) >= 15)
      .sort((a, b) => (b.qualityScore ?? 0) - (a.qualityScore ?? 0))
      .slice(0, Math.max(limit, 20));
    const extraImages = await runSerperImageSearch(
      optimizedQuery,
      Math.max(limit, 10),
      locale,
    );
    const images = [...inlineImages, ...extraImages];
    const resultsWithImages = attachMultipleImages(results, images, 5);

    console.log("[anan.search] serper:response", {
      status: "success",
      resultCount: resultsWithImages.length,
      topScores: resultsWithImages.slice(0, 3).map((r) => r.qualityScore),
      imageCount: images.length,
    });

    return { ok: true, results: resultsWithImages, images };
  } catch (error) {
    console.error("[anan.search] serper:error", {
      error: error instanceof Error ? error.message : String(error),
    });
    return {
      ok: false,
      error: error instanceof Error ? error.message : "serper_request_failed",
    };
  }
}

export function selectTopSources(
  results: SerperResult[],
  images: SerperImageResult[],
): SerperResult[] {
  const byLink = new Map<string, string>();
  const fallbackImagePool: string[] = [];
  for (const image of images) {
    if (image.imageUrl && image.link) {
      byLink.set(image.link, image.imageUrl);
    }
    if (image.imageUrl) fallbackImagePool.push(image.imageUrl);
  }
  let fallbackIdx = 0;

  const withImages = results.map((r) => ({
    ...r,
    imageUrl:
      byLink.get(r.externalUrl) ??
      r.imageUrl ??
      (fallbackIdx < fallbackImagePool.length
        ? fallbackImagePool[fallbackIdx++]
        : undefined),
  }));

  const isPreferred = (url: string) => {
    const domain = getDomain(url);
    return PREFERRED_PROPERTY_SOURCE_DOMAINS.some(
      (d) => domain === d || domain.endsWith("." + d),
    );
  };

  let candidates = withImages.filter((r) =>
    isLikelyPropertyDetailUrl(r.externalUrl),
  );
  if (candidates.length === 0) {
    candidates = withImages.filter((r) => !isLikelyHomePageUrl(r.externalUrl));
  }

  const preferred = candidates.filter((r) => isPreferred(r.externalUrl));
  const others = candidates.filter((r) => !isPreferred(r.externalUrl));
  const selected = [...preferred, ...others].slice(0, TOP_SOURCE_LIMIT);

  console.log("[anan.search] sources:selected", {
    count: selected.length,
    urls: selected.map((s) => s.externalUrl),
  });

  return selected;
}
