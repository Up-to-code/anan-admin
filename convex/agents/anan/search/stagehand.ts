/**
 * Stagehand/Browserbase extraction for property cards and details.
 */

import { Stagehand } from "@browserbasehq/convex-stagehand";
import { z } from "zod";
import { components } from "../../../_generated/api";
import { getStagehandConfig } from "../../_lib/stagehand";
import { sanitizeWebText } from "../../_lib/sanitize";
import { isLikelyPropertyDetailUrl } from "../../_lib/location";
import { TOP_CARDS_PER_SOURCE } from "../../_lib/constants";
import type { PropertyCardCandidate, StagehandState } from "./types";

function classifyStagehandError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error ?? "");
  if (message.includes("Incorrect API key provided"))
    return "invalid_model_key";
  if (message.includes("burst rate limit")) return "burst_rate_limited";
  if (message.includes("max concurrent sessions")) return "concurrency_limited";
  if (message.includes("429")) return "rate_limited";
  return "unknown";
}

export async function extractCardsFromSource(
  ctx: unknown,
  sourceUrl: string,
  sourceRank: number,
  state: StagehandState,
): Promise<PropertyCardCandidate[]> {
  if (state.disabled) {
    console.log("[anan.search] cards:skipped", {
      sourceUrl,
      reason: state.reason,
    });
    return [];
  }

  const config = getStagehandConfig();
  if ("error" in config) {
    state.disabled = true;
    state.reason = config.error;
    console.log("[anan.search] cards:error", {
      sourceUrl,
      error: config.error,
    });
    return [];
  }

  console.log("[anan.search] cards:extracting", { sourceUrl, sourceRank });

  try {
    const stagehand = new Stagehand(components.stagehand, config);

    const extracted = await stagehand.extract(ctx as any, {
      url: sourceUrl,
      instruction:
        `Extract up to ${TOP_CARDS_PER_SOURCE} property cards from the page. ` +
        "Only return direct property detail listings (not homepage/search/category links). " +
        "For each card, return title, url, snippet, and imageUrl if available.",
      schema: z.object({
        cards: z
          .array(
            z.object({
              title: z.string().optional(),
              url: z.string().optional(),
              snippet: z.string().optional(),
              imageUrl: z.string().optional(),
            }),
          )
          .optional(),
      }),
    });

    const cards = (extracted?.cards ?? [])
      .filter((card) => card.url && isLikelyPropertyDetailUrl(card.url))
      .slice(0, TOP_CARDS_PER_SOURCE)
      .map((card, idx) => ({
        rank: idx + 1,
        title: sanitizeWebText(card.title, `Property ${idx + 1}`),
        url: card.url,
        snippet: sanitizeWebText(card.snippet),
        imageUrl: card.imageUrl,
      }));

    console.log("[anan.search] cards:extracted", {
      sourceUrl,
      cardCount: cards.length,
    });
    return cards;
  } catch (error) {
    state.disabled = true;
    state.reason = classifyStagehandError(error);
    console.error("[anan.search] cards:error", {
      sourceUrl,
      error: error instanceof Error ? error.message : String(error),
      classification: state.reason,
    });
    return [];
  }
}

export async function extractPropertyDetails(
  ctx: unknown,
  cardUrl: string,
  cardRank: number,
  state: StagehandState,
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
}> {
  if (state.disabled) {
    console.log("[anan.search] details:skipped", {
      cardUrl,
      reason: state.reason,
    });
    return { imageUrls: [] };
  }

  const config = getStagehandConfig();
  if ("error" in config) {
    state.disabled = true;
    state.reason = config.error;
    console.log("[anan.search] details:error", {
      cardUrl,
      error: config.error,
    });
    return { imageUrls: [] };
  }

  console.log("[anan.search] details:extracting", { cardUrl, cardRank });

  try {
    const stagehand = new Stagehand(components.stagehand, config);

    const extracted = await stagehand.extract(ctx as any, {
      url: cardUrl,
      instruction:
        "Extract the full property listing by navigating through the page:\n\n" +
        "1. FIRST, look for image galleries, carousels, or 'View all photos' buttons. Click them to expand the full gallery.\n" +
        "2. Extract ALL property images from the expanded gallery (up to 10). Prioritize:\n" +
        "   - Large/high-resolution images over thumbnails\n" +
        "   - Interior photos (living room, bedrooms, kitchen, bathrooms)\n" +
        "   - Exterior photos (building, pool, garden)\n" +
        "   - Amenities photos (gym, parking, lobby)\n" +
        "   - SKIP: logos, avatars, placeholder images, ads\n\n" +
        "3. Extract property details:\n" +
        "   - Title (full property name)\n" +
        "   - Price (with currency)\n" +
        "   - Location (neighborhood, city)\n" +
        "   - Bedrooms/Beds\n" +
        "   - Bathrooms\n" +
        "   - Area (in sqm or sqft)\n" +
        "   - Key features list (balcony, parking, pool, gym, etc.)\n\n" +
        "4. Extract Property Information table if available:\n" +
        "   - Type, Purpose, Reference ID, Completion status, Furnishing\n\n" +
        "5. Extract full description including:\n" +
        "   - General specifications\n" +
        "   - Floor breakdown\n" +
        "   - Nearby amenities\n" +
        "   - Any special features or highlights",
      schema: z.object({
        title: z.string().optional(),
        description: z.string().optional(),
        price: z.string().optional(),
        location: z.string().optional(),
        offerDetails: z.string().optional(),
        propertyInfo: z
          .string()
          .optional()
          .describe(
            "Property Information table: Type, Purpose, ID, Residence Type, Completion, Furnishing, Added on",
          ),
        bedrooms: z.string().optional(),
        bathrooms: z.string().optional(),
        area: z.string().optional(),
        features: z.array(z.string()).optional(),
        imageUrls: z.array(z.string()).max(10).optional(),
      }),
    });

    const propertyInfoBlock = sanitizeWebText(extracted?.propertyInfo);
    const offerDetailsCombined =
      [extracted?.offerDetails, propertyInfoBlock]
        .filter(Boolean)
        .map((s) => sanitizeWebText(s))
        .filter(Boolean)
        .join("\n\n") || undefined;

    const result = {
      title: sanitizeWebText(extracted?.title),
      description: sanitizeWebText(extracted?.description),
      price: sanitizeWebText(extracted?.price),
      location: sanitizeWebText(extracted?.location),
      offerDetails:
        offerDetailsCombined ?? sanitizeWebText(extracted?.offerDetails),
      beds: sanitizeWebText(extracted?.bedrooms),
      bathrooms: sanitizeWebText(extracted?.bathrooms),
      area: sanitizeWebText(extracted?.area),
      features: Array.isArray(extracted?.features)
        ? extracted.features
            .map((f) => sanitizeWebText(f))
            .filter(Boolean)
            .slice(0, 5)
        : undefined,
      imageUrls: Array.isArray(extracted?.imageUrls)
        ? extracted.imageUrls
            .filter(
              (url) => url && typeof url === "string" && url.startsWith("http"),
            )
            .slice(0, 5)
        : [],
    };

    console.log("[anan.search] details:extracted", {
      cardUrl,
      hasImages: result.imageUrls.length > 0,
      hasPrice: Boolean(result.price),
      hasLocation: Boolean(result.location),
    });

    return result;
  } catch (error) {
    state.disabled = true;
    state.reason = classifyStagehandError(error);
    console.error("[anan.search] details:error", {
      cardUrl,
      error: error instanceof Error ? error.message : String(error),
      classification: state.reason,
    });
    return { imageUrls: [] };
  }
}
