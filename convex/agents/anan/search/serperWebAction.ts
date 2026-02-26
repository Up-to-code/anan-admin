/**
 * Internal action for Serper web search. Used with Action Cache for webSearch and searchRealEstateInfo.
 * Supports deep mode: runs 2 related queries, merges and deduplicates by URL.
 */
import { internalAction } from "../../../_generated/server";
import { v } from "convex/values";
import { sanitizeWebText } from "../../_lib/sanitize";
import { fetchJsonWithRetry } from "../../_lib/http";
import { detectPreferredLanguage } from "../../../lib/language";

function normalizeUrl(url: string): string {
  try {
    const u = url.trim().toLowerCase().replace(/\/+$/, "");
    return u || url;
  } catch {
    return url;
  }
}

/** Build a related query for deep search (e.g. bilingual or add Saudi/2025). */
function buildRelatedQuery(query: string): string {
  const q = query.trim().toLowerCase();
  const hasSaudi = /\b(saudi|السعودية|الرياض|جدة|رياض|جده)\b/.test(q);
  const hasYear = /\b(202[0-9]|2025)\b/.test(q);
  let related = query.trim();
  if (!hasSaudi) related += " Saudi Arabia real estate";
  if (!hasYear) related += " 2025";
  return related.trim();
}

function detectQueryIntent(query: string): "legal" | "market" | "general" {
  const q = query.toLowerCase();
  if (
    /\b(law|regulation|rules|compliance|zoning|license|legal|نظام|لائحة|لوائح|قانون|تشريع|ضوابط|اشتراطات|رخصة)\b/i.test(
      q,
    )
  ) {
    return "legal";
  }
  if (
    /\b(market|trend|price|rates|index|forecast|العرض|الطلب|الأسعار|سوق|مؤشر|اتجاه)\b/i.test(
      q,
    )
  ) {
    return "market";
  }
  return "general";
}

function readPositiveInt(raw: string | undefined, fallback: number): number {
  if (!raw) return fallback;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

const SERPER_WEB_ACTION_TIMEOUT_MS = readPositiveInt(
  process.env.SERPER_WEB_ACTION_TIMEOUT_MS,
  7000,
);
const SERPER_WEB_ACTION_MAX_RETRIES = readPositiveInt(
  process.env.SERPER_WEB_ACTION_MAX_RETRIES,
  2,
);
const SERPER_WEB_ACTION_QUERY_PARALLELISM = readPositiveInt(
  process.env.SERPER_WEB_ACTION_QUERY_PARALLELISM,
  2,
);

function buildDeepQueries(query: string): string[] {
  const intent = detectQueryIntent(query);
  const base = query.trim();
  if (!base) return [];

  const candidates =
    intent === "legal"
      ? [
          `${base} site:gov.sa`,
          `${base} site:sama.gov.sa OR site:moj.gov.sa`,
        ]
      : intent === "market"
        ? [
            buildRelatedQuery(base),
            `${base} report OR index OR statistics`,
          ]
        : [buildRelatedQuery(base)];

  return Array.from(new Set([base, ...candidates]))
    .map((q) => q.trim())
    .filter(Boolean)
    .slice(0, 3);
}

async function runSerper(
  apiKey: string,
  query: string,
  num: number,
  localeParams: { gl: string; hl: string }
): Promise<{ title: string; url: string; snippet: string }[]> {
  const data = await fetchJsonWithRetry<{
    organic?: Array<{ title?: string; link?: string; snippet?: string }>;
  }>(
    "https://google.serper.dev/search",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-KEY": apiKey,
      },
      body: JSON.stringify({
        q: query,
        num: Math.min(num, 10),
        ...localeParams,
      }),
    },
    {
      timeoutMs: SERPER_WEB_ACTION_TIMEOUT_MS,
      maxRetries: SERPER_WEB_ACTION_MAX_RETRIES,
    },
  );
  return (data.organic ?? []).map((o) => ({
    title: sanitizeWebText(o.title),
    url: o.link ?? "",
    snippet: sanitizeWebText(o.snippet),
  }));
}

export const runSerperWebSearch = internalAction({
  args: {
    query: v.string(),
    num: v.optional(v.number()),
    deep: v.optional(v.boolean()),
  },
  handler: async (_ctx, { query, num = 5, deep = false }): Promise<
    | {
        ok: true;
        results: { title: string; url: string; snippet: string }[];
        queriesUsed: string[];
      }
    | { ok: false; error: string }
  > => {
    const apiKey = process.env.SERPER_API_KEY;
    if (!apiKey) {
      return { ok: false, error: "Web search is not configured (missing SERPER_API_KEY)." };
    }
    try {
      const preferredLanguage = detectPreferredLanguage(query);
      const localeParams =
        preferredLanguage === "ar" ? { gl: "sa", hl: "ar" } : { gl: "us", hl: "en" };
      const perQueryNum = deep ? 10 : Math.min(num, 10);

      let allResults: { title: string; url: string; snippet: string }[];
      let queriesUsed: string[] = [query];

      if (deep) {
        const deepQueries = buildDeepQueries(query);
        queriesUsed = deepQueries;
        const batches: Array<{ title: string; url: string; snippet: string }[]> = [];
        for (
          let i = 0;
          i < deepQueries.length;
          i += SERPER_WEB_ACTION_QUERY_PARALLELISM
        ) {
          const queryBatch = deepQueries.slice(
            i,
            i + SERPER_WEB_ACTION_QUERY_PARALLELISM,
          );
          const resultBatch = await Promise.all(
            queryBatch.map((q) => runSerper(apiKey, q, perQueryNum, localeParams)),
          );
          batches.push(...resultBatch);
        }
        const byUrl = new Map<string, { title: string; url: string; snippet: string }>();
        for (const batch of batches) {
          for (const r of batch) {
            const norm = normalizeUrl(r.url);
            if (r.url && !byUrl.has(norm)) {
              byUrl.set(norm, r);
            }
          }
        }
        allResults = Array.from(byUrl.values()).slice(0, perQueryNum * 2);
      } else {
        allResults = await runSerper(apiKey, query, perQueryNum, localeParams);
      }

      const results = allResults.slice(0, num);
      return { ok: true, results, queriesUsed };
    } catch (e) {
      return {
        ok: false,
        error: e instanceof Error ? e.message : "Web search request failed",
      };
    }
  },
});
