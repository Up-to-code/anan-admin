/**
 * Aqar Saudi Arabia as a direct property search source.
 * Listing: https://sa.aqar.fm/{type}/{string-city}
 * Detail: https://sa.aqar.fm/{type}/{city}/{district}/{slug}-{id}
 */

import { Stagehand } from "@browserbasehq/convex-stagehand";
import { z } from "zod";
import { components } from "../../../_generated/api";
import { getStagehandConfig } from "../../_lib/stagehand";
import { sanitizeWebText, cleanWhitespace } from "../../_lib/sanitize";
import { extractQueryLocation } from "../../_lib/location";
import type { PropertyCardCandidate, StagehandState } from "./types";
import { type GenericActionCtx } from "convex/server";
import { type DataModel } from "../../../_generated/dataModel";

const AQAR_BASE = "https://sa.aqar.fm";

function isSaudiPropertyQuery(query: string): boolean {
  const q = cleanWhitespace(query).toLowerCase();
  const saudiTerms = ["للبيع", "للإيجار", "شقة", "فيلا", "عقار", "شقق", "فلل", "أرض", "ارضي"];
  const enTerms = ["sale", "rent", "apartment", "villa", "property", "land"];
  return saudiTerms.some((t) => q.includes(t)) || enTerms.some((t) => q.includes(t));
}

export function buildAqarSearchUrl(query: string, page?: number): string | null {
  if (!isSaudiPropertyQuery(query)) return null;

  const location = extractQueryLocation(query);
  const city = location ? location.replace(/\s+/g, "-") : "الرياض";

  const q = query.toLowerCase();
  let propertyType = "عقارات"; // Default "Properties"

  const isRent = q.includes("إيجار") || q.includes("ايجار") || q.includes("rent");

  if (q.includes("فيلا") || q.includes("فلل") || q.includes("villa") || q.includes("house")) {
    propertyType = isRent ? "فلل-للإيجار" : "فلل-للبيع";
  } else if (q.includes("شقة") || q.includes("شقق") || q.includes("apartment")) {
    propertyType = isRent ? "شقق-للإيجار" : "شقق-للبيع";
  } else if (q.includes("أرض") || q.includes("ارض") || q.includes("land")) {
    propertyType = isRent ? "أراضي-للإيجار" : "أراضي-للبيع";
  } else if (isRent) {
    propertyType = "عقارات-للإيجار";
  } else {
    propertyType = "عقارات-للبيع"; // Default to sale
  }

  // Aqar doesn't easily support page={n} in the URL like others, it uses infinite scroll or internal tokens. 
  // We'll return just the base city listing for now, Stagehand can scroll it.
  if (page && page > 1) return null; // Prevent multi-page duplicates until we implement precise pagination

  return `${AQAR_BASE}/${propertyType}/${city}`;
}

export function isAqarDetailUrl(url: string): boolean {
  if (!url) return false;
  return url.toLowerCase().includes("aqar.fm") && /\d{6,}$/.test(url);
}

function resolveAqarUrl(href: string): string {
  if (!href) return href;
  if (href.startsWith("http://") || href.startsWith("https://")) return href;
  const base = new URL(AQAR_BASE);
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

export async function extractAqarListingCards(
  ctx: GenericActionCtx<DataModel>,
  listingUrl: string,
  maxCards: number,
  state: StagehandState
): Promise<PropertyCardCandidate[]> {
  if (state.disabled) {
    console.log("[anan.search] aqar:skipped", { listingUrl, reason: state.reason });
    return [];
  }

  const config = getStagehandConfig();
  if ("error" in config) {
    state.disabled = true;
    state.reason = config.error;
    console.log("[anan.search] aqar:error", { listingUrl, error: config.error });
    return [];
  }

  console.log("[anan.search] aqar:extracting", { listingUrl });

  try {
    const stagehand = new Stagehand(components.stagehand, config);

    const extracted = await stagehand.extract(ctx, {
      url: listingUrl,
      instruction:
        `Extract all property listing cards from this Aqar.fm search results page (up to ${maxCards}). ` +
        "Each card has a link wrapping it pointing to a detail page ending in a numeric ID (e.g. -6596731). " +
        "For each card, extract the absolute url, title (e.g. شقة للإيجار في شارع...), snippet, imageUrl, price (e.g. 48,000 ريال/سنوي), beds, baths, area (e.g. 163 م²), and location text (e.g. جدة-حي الفيحاء).",
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
      .map((c) => ({ ...c, url: c.url ? resolveAqarUrl(c.url) : undefined }))
      .filter((card) => card.url && isAqarDetailUrl(card.url))
      .slice(0, maxCards)
      .map((card, idx) => ({
        rank: idx + 1,
        title: sanitizeWebText(card.title, `Property ${idx + 1}`),
        url: card.url,
        snippet: sanitizeWebText(card.snippet),
        imageUrl: card.imageUrl,
        price: card.price,
        beds: card.beds,
        baths: card.baths,
        area: card.area,
        location: card.location,
      }));

    console.log("[anan.search] aqar:extracted", { listingUrl, cardCount: cards.length });
    return cards;
  } catch (error) {
    state.disabled = true;
    state.reason = classifyStagehandError(error);
    console.error("[anan.search] aqar:error", {
      listingUrl,
      error: error instanceof Error ? error.message : String(error),
      classification: state.reason,
    });
    return [];
  }
}

