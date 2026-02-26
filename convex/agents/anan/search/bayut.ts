/**
 * Bayut.sa as second direct property search source.
 * Listing: https://www.bayut.sa/s/{slug}/ or https://www.bayut.sa/s/{slug}/صفحة-{n}/
 * Detail: https://www.bayut.sa/العقار/تفاصيل-{id}.html
 */

import { Stagehand } from "@browserbasehq/convex-stagehand";
import { z } from "zod";
import { components } from "../../../_generated/api";
import { getStagehandConfig } from "../../_lib/stagehand";
import { sanitizeWebText } from "../../_lib/sanitize";
import { cleanWhitespace } from "../../_lib/sanitize";
import { isLikelyPropertyDetailUrl } from "../../_lib/location";
import type { PropertyCardCandidate, StagehandState } from "./types";
import { type GenericActionCtx } from "convex/server";
import { type DataModel } from "../../../_generated/dataModel";

const BAYUT_BASE = "https://www.bayut.sa";

function isSaudiPropertyQuery(query: string): boolean {
  const q = cleanWhitespace(query).toLowerCase();
  const saudiTerms = ["للبيع", "للإيجار", "شقة", "فيلا", "عقار", "شقق", "فلل", "أرض", "ارضي", "عقارات"];
  const enTerms = ["sale", "rent", "apartment", "villa", "property", "land"];
  return saudiTerms.some((t) => q.includes(t)) || enTerms.some((t) => q.includes(t));
}

function queryToSlug(query: string): string {
  const cleaned = cleanWhitespace(query)
    .replace(/\s+/g, "-")
    .replace(/[^\p{L}\p{N}\u0600-\u06FF\-]/gu, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return cleaned || "عقارات-الرياض";
}

function extractFirstHttpUrl(text: string): string | null {
  const match = text.match(/https?:\/\/[^\s)]+/i);
  return match?.[0] ?? null;
}

function parseBayutListingSeed(query: string): {
  basePath: string;
  startPage: number;
} | null {
  const firstUrl = extractFirstHttpUrl(query);
  if (!firstUrl) return null;
  let parsed: URL;
  try {
    parsed = new URL(firstUrl);
  } catch {
    return null;
  }
  if (!parsed.hostname.toLowerCase().includes("bayut.sa")) return null;

  const decodedPath = (() => {
    try {
      return decodeURIComponent(parsed.pathname);
    } catch {
      return parsed.pathname;
    }
  })();
  if (!decodedPath.startsWith("/s/")) return null;

  const pageMatch = decodedPath.match(/\/صفحة-(\d+)\/?$/);
  const startPage = pageMatch ? Math.max(1, Number(pageMatch[1])) : 1;
  const basePath = decodedPath.replace(/\/صفحة-\d+\/?$/, "/");
  return { basePath: basePath.endsWith("/") ? basePath : `${basePath}/`, startPage };
}

export function buildBayutSearchUrl(query: string, page?: number): string | null {
  const listingSeed = parseBayutListingSeed(query);
  if (listingSeed) {
    const requestedPage = page && page > 0 ? page : 1;
    const effectivePage = listingSeed.startPage + (requestedPage - 1);
    const base = `${BAYUT_BASE}${listingSeed.basePath}`;
    if (effectivePage > 1) {
      return `${base}صفحة-${effectivePage}/`;
    }
    return base;
  }

  if (!isSaudiPropertyQuery(query)) return null;

  const slug = queryToSlug(query);
  const base = `${BAYUT_BASE}/s/${slug}/`;
  if (page && page > 1) {
    return `${base}صفحة-${page}/`;
  }
  return base;
}

export function isBayutDetailUrl(url: string): boolean {
  if (!url) return false;
  const lower = url.toLowerCase();
  return (
    lower.includes("bayut.sa") &&
    (lower.includes("تفاصيل") || lower.includes("detail")) &&
    /\d{6,}/.test(url)
  );
}

function resolveBayutUrl(href: string): string {
  if (!href) return href;
  if (href.startsWith("http://") || href.startsWith("https://")) return href;
  const base = new URL(BAYUT_BASE);
  return new URL(href, base).href;
}

function classifyStagehandError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error ?? "");
  if (message.includes("Incorrect API key provided")) return "invalid_model_key";
  if (message.includes("burst rate limit")) return "burst_rate_limited";
  if (message.includes("max concurrent sessions")) return "concurrency_limited";
  if (message.includes("429")) return "rate_limited";
  return "unknown";
}

export async function extractBayutListingCards(
  ctx: GenericActionCtx<DataModel>,
  listingUrl: string,
  maxCards: number,
  state: StagehandState
): Promise<PropertyCardCandidate[]> {
  if (state.disabled) {
    console.log("[anan.search] bayut:skipped", { listingUrl, reason: state.reason });
    return [];
  }

  const config = getStagehandConfig();
  if ("error" in config) {
    state.disabled = true;
    state.reason = config.error;
    console.log("[anan.search] bayut:error", { listingUrl, error: config.error });
    return [];
  }

  console.log("[anan.search] bayut:extracting", { listingUrl });

  try {
    const stagehand = new Stagehand(components.stagehand, config);

    const extracted = await stagehand.extract(ctx, {
      url: listingUrl,
      instruction:
        `Extract all property listing cards from this Bayut search results page (up to ${maxCards}). ` +
        "Each card links to a detail page (URL like bayut.sa/العقار/تفاصيل-*.html). " +
        "Return full absolute URLs for each card. For each card, extract title, url, snippet, imageUrl, price, beds, baths, area, and location. " +
        "Look for aria-labels like 'Price', 'Beds', 'Baths', 'Area' and 'Property location' since CSS classes are heavily obfuscated.",
      schema: z.object({
        cards: z
          .array(
            z.object({
              title: z.string().optional(),
              url: z.string().optional(),
              snippet: z.string().optional(),
              imageUrl: z.string().optional(),
              price: z.string().optional(),
              beds: z.string().optional(),
              baths: z.string().optional(),
              area: z.string().optional(),
              location: z.string().optional(),
            })
          )
          .optional(),
      }),
    });

    const cards = (extracted?.cards ?? [])
      .map((c) => ({ ...c, url: c.url ? resolveBayutUrl(c.url) : undefined }))
      .filter((card) => card.url && isLikelyPropertyDetailUrl(card.url))
      .slice(0, maxCards)
      .map((card, idx) => ({
        rank: idx + 1,
        title: sanitizeWebText(card.title, `Property ${idx + 1}`),
        url: card.url,
        snippet: sanitizeWebText(card.snippet),
        imageUrl: card.imageUrl,
      }));

    console.log("[anan.search] bayut:extracted", { listingUrl, cardCount: cards.length });
    return cards;
  } catch (error) {
    state.disabled = true;
    state.reason = classifyStagehandError(error);
    console.error("[anan.search] bayut:error", {
      listingUrl,
      error: error instanceof Error ? error.message : String(error),
      classification: state.reason,
    });
    return [];
  }
}
