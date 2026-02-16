/**
 * Wasalt.sa as first direct property search source.
 * Listing: https://wasalt.sa/ar/sale/search?propertyFor=sale&countryId=1&cityId=273&type=residential
 * Detail: https://wasalt.sa/property/sale/{slug}-{id}
 */

import { Stagehand } from "@browserbasehq/convex-stagehand";
import { z } from "zod";
import { components } from "../../../_generated/api";
import { getStagehandConfig } from "../../_lib/stagehand";
import { sanitizeWebText } from "../../_lib/sanitize";
import { extractQueryLocation } from "../../_lib/location";
import { cleanWhitespace } from "../../_lib/sanitize";
import { isLikelyPropertyDetailUrl } from "../../_lib/location";
import type { PropertyCardCandidate, StagehandState } from "./types";

const WASALT_BASE = "https://wasalt.sa";

const CITY_ID_MAP: Record<string, number> = {
  riyadh: 273,
  الرياض: 273,
  jeddah: 274,
  جدة: 274,
  جده: 274,
  dammam: 275,
  الدمام: 275,
  mecca: 276,
  مكة: 276,
  medina: 277,
  المدينة: 277,
  khobar: 278,
  الخبر: 278,
};

const PROPERTY_TYPE_MAP: Record<string, string> = {
  residential: "residential",
  شقة: "residential",
  شقق: "residential",
  فيلا: "residential",
  فلل: "residential",
  دور: "residential",
  منزل: "residential",
  land: "land",
  أرض: "land",
  ارض: "land",
  أراضي: "land",
  commercial: "commercial",
  تجاري: "commercial",
};

function isSaudiPropertyQuery(query: string): boolean {
  const q = cleanWhitespace(query).toLowerCase();
  const saudiTerms = ["للبيع", "للإيجار", "شقة", "فيلا", "عقار", "شقق", "فلل", "أرض", "ارضي"];
  const enTerms = ["sale", "rent", "apartment", "villa", "property", "land"];
  return saudiTerms.some((t) => q.includes(t)) || enTerms.some((t) => q.includes(t));
}

export function buildWasaltSearchUrl(query: string, page?: number): string | null {
  if (!isSaudiPropertyQuery(query)) return null;

  const location = extractQueryLocation(query);
  const cityId = location ? CITY_ID_MAP[location.toLowerCase()] ?? 273 : 273;

  const q = query.toLowerCase();
  const propertyFor = q.includes("إيجار") || q.includes("ايجار") || q.includes("rent") ? "rent" : "sale";

  let type = "residential";
  for (const [term, t] of Object.entries(PROPERTY_TYPE_MAP)) {
    if (q.includes(term)) {
      type = t;
      break;
    }
  }

  const path = propertyFor === "rent" ? "/ar/rent/search" : "/ar/sale/search";
  const params = new URLSearchParams({
    propertyFor,
    countryId: "1",
    cityId: String(cityId),
    type,
  });
  if (page && page > 1) params.set("page", String(page));

  return `${WASALT_BASE}${path}?${params.toString()}`;
}

function resolveWasaltUrl(href: string): string {
  if (!href) return href;
  if (href.startsWith("http://") || href.startsWith("https://")) return href;
  const base = new URL(WASALT_BASE);
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

export async function extractWasaltListingCards(
  ctx: unknown,
  listingUrl: string,
  maxCards: number,
  state: StagehandState
): Promise<PropertyCardCandidate[]> {
  if (state.disabled) {
    console.log("[anan.search] wasalt:skipped", { listingUrl, reason: state.reason });
    return [];
  }

  const config = getStagehandConfig();
  if ("error" in config) {
    state.disabled = true;
    state.reason = config.error;
    console.log("[anan.search] wasalt:error", { listingUrl, error: config.error });
    return [];
  }

  console.log("[anan.search] wasalt:extracting", { listingUrl });

  try {
    const stagehand = new Stagehand(components.stagehand, config);

    const extracted = await stagehand.extract(ctx as any, {
      url: listingUrl,
      instruction:
        `Extract all property listing cards from this Wasalt search results page (up to ${maxCards}). ` +
        "Each card links to a detail page (URL like wasalt.sa/property/sale/... or wasalt.sa/property/rent/...). " +
        "Return full absolute URLs for each card. For each card, return title, url, snippet, and imageUrl if available.",
      schema: z.object({
        cards: z
          .array(
            z.object({
              title: z.string().optional(),
              url: z.string().optional(),
              snippet: z.string().optional(),
              imageUrl: z.string().optional(),
            })
          )
          .optional(),
      }),
    });

    const cards = (extracted?.cards ?? [])
      .map((c) => ({ ...c, url: c.url ? resolveWasaltUrl(c.url) : undefined }))
      .filter((card) => card.url && isLikelyPropertyDetailUrl(card.url))
      .slice(0, maxCards)
      .map((card, idx) => ({
        rank: idx + 1,
        title: sanitizeWebText(card.title, `Property ${idx + 1}`),
        url: card.url,
        snippet: sanitizeWebText(card.snippet),
        imageUrl: card.imageUrl,
      }));

    console.log("[anan.search] wasalt:extracted", { listingUrl, cardCount: cards.length });
    return cards;
  } catch (error) {
    state.disabled = true;
    state.reason = classifyStagehandError(error);
    console.error("[anan.search] wasalt:error", {
      listingUrl,
      error: error instanceof Error ? error.message : String(error),
      classification: state.reason,
    });
    return [];
  }
}
