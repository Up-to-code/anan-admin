/**
 * Serper web search for property listings.
 */

import { cleanWhitespace, sanitizeWebText } from "../../_lib/sanitize";
import {
  extractQueryLocation,
  getDomain,
  isBlockedDomain,
  isLikelyHomePageUrl,
  isLikelyPropertyDetailUrl,
} from "../../_lib/location";
import {
  PREFERRED_PROPERTY_SOURCE_DOMAINS,
  TOP_SOURCE_LIMIT,
  TOP_CARDS_PER_SOURCE,
} from "../../_lib/constants";
import { scorePropertyResult, attachMultipleImages } from "./quality";
import type { SerperResult, SerperImageResult } from "./types";

async function runSerperImageSearch(
  query: string,
  limit: number,
): Promise<SerperImageResult[]> {
  const apiKey = process.env.SERPER_API_KEY;
  if (!apiKey) return [];
  try {
    const res = await fetch("https://google.serper.dev/images", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-KEY": apiKey,
      },
      body: JSON.stringify({
        q: query,
        num: Math.min(limit * 3, 30),
        gl: "sa",
        hl: "ar",
      }),
    });
    if (!res.ok) return [];
    const data = (await res.json()) as {
      images?: Array<{ title?: string; link?: string; imageUrl?: string }>;
    };
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

  let searchQuery = query;
  if (!hasPropertyTerms) {
    searchQuery = `${query} property listing`;
  }

  if (location && !query.toLowerCase().includes("saudi")) {
    searchQuery = `${searchQuery} Saudi Arabia`;
  }

  return searchQuery;
}

export function buildTaskList(query: string): string[] {
  return [
    "Create focused search keywords",
    `Search Google for: ${query}`,
    `Open top ${TOP_SOURCE_LIMIT} source results`,
    `Extract top ${TOP_CARDS_PER_SOURCE} property cards per source`,
    "Extract property details (title, description, price, location, images)",
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
  console.log("[anan.search] serper:start", { query, optimizedQuery });

  try {
    const res = await fetch("https://google.serper.dev/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-KEY": apiKey,
      },
      body: JSON.stringify({
        q: optimizedQuery,
        num: Math.min(limit * 2, 20),
        start: Math.max(0, offset),
        gl: "sa",
        hl: "ar",
      }),
    });

    if (!res.ok) {
      console.log("[anan.search] serper:error", { status: res.status });
      return { ok: false, error: `serper_http_${res.status}` };
    }

    const data = (await res.json()) as {
      organic?: Array<{ title?: string; link?: string; snippet?: string }>;
      images?: Array<{ title?: string; link?: string; imageUrl?: string }>;
    };

    const results = (data.organic ?? [])
      .filter(
        (r) =>
          r.link && !isBlockedDomain(r.link) && !isLikelyHomePageUrl(r.link),
      )
      .map((r) => ({
        title: sanitizeWebText(r.title, "Property"),
        description: sanitizeWebText(r.snippet),
        externalUrl: r.link ?? "",
        qualityScore: 0,
      }))
      .map((r) => ({ ...r, qualityScore: scorePropertyResult(r) }))
      .filter((r) => r.qualityScore >= 15)
      .sort((a, b) => b.qualityScore - a.qualityScore)
      .slice(0, limit);
    const extraImages = await runSerperImageSearch(optimizedQuery, limit);
    const images = [...(data.images ?? []), ...extraImages];
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
