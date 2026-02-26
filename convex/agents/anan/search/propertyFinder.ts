/**
 * Property Finder Saudi Arabia as a direct property search source.
 * Listing: https://www.propertyfinder.sa/en/search?c={cat}&l={loc}
 * Detail: https://www.propertyfinder.sa/en/buy/{slug}-{id}.html
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

const PF_BASE = "https://www.propertyfinder.sa";

const CITY_ID_MAP: Record<string, number> = {
    riyadh: 4,
    الرياض: 4,
    jeddah: 1,
    جدة: 1,
    جده: 1,
    dammam: 3,
    الدمام: 3,
    mecca: 2, // approximation
    مكة: 2,
    medina: 5, // approximation
    المدينة: 5,
    khobar: 6, // approximation
    الخبر: 6,
};

function isSaudiPropertyQuery(query: string): boolean {
    const q = cleanWhitespace(query).toLowerCase();
    const saudiTerms = ["للبيع", "للإيجار", "شقة", "فيلا", "عقار", "شقق", "فلل", "أرض", "ارضي"];
    const enTerms = ["sale", "rent", "apartment", "villa", "property", "land"];
    return saudiTerms.some((t) => q.includes(t)) || enTerms.some((t) => q.includes(t));
}

export function buildPropertyFinderSearchUrl(query: string, page?: number): string | null {
    if (!isSaudiPropertyQuery(query)) return null;

    const location = extractQueryLocation(query);
    const cityId = location ? CITY_ID_MAP[location.toLowerCase()] ?? 4 : 4; // Default Riyadh

    const q = query.toLowerCase();
    // c=1 is Buy, c=2 is Rent
    const category = q.includes("إيجار") || q.includes("ايجار") || q.includes("rent") ? 2 : 1;

    // t=1 is Apartment, t=35 is Villa
    let type = "";
    if (q.includes("فيلا") || q.includes("فلل") || q.includes("villa") || q.includes("house")) {
        type = "&t=35";
    } else if (q.includes("شقة") || q.includes("شقق") || q.includes("apartment")) {
        type = "&t=1";
    }

    const params = new URLSearchParams({
        c: String(category),
        l: String(cityId),
        ob: "mr", // sort by Most Recent
    });
    if (page && page > 1) {
        params.set("page", String(page));
    }

    return `${PF_BASE}/en/search?${params.toString()}${type}`;
}

export function isPropertyFinderDetailUrl(url: string): boolean {
    if (!url) return false;
    return url.toLowerCase().includes("propertyfinder.sa") && /\d+\.html$/.test(url);
}

function resolvePropertyFinderUrl(href: string): string {
    if (!href) return href;
    if (href.startsWith("http://") || href.startsWith("https://")) return href;
    const base = new URL(PF_BASE);
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

export async function extractPropertyFinderListingCards(
    ctx: GenericActionCtx<DataModel>,
    listingUrl: string,
    maxCards: number,
    state: StagehandState
): Promise<PropertyCardCandidate[]> {
    if (state.disabled) {
        console.log("[anan.search] propertyfinder:skipped", { listingUrl, reason: state.reason });
        return [];
    }

    const config = getStagehandConfig();
    if ("error" in config) {
        state.disabled = true;
        state.reason = config.error;
        console.log("[anan.search] propertyfinder:error", { listingUrl, error: config.error });
        return [];
    }

    console.log("[anan.search] propertyfinder:extracting", { listingUrl });

    try {
        const stagehand = new Stagehand(components.stagehand, config);

        const extracted = await stagehand.extract(ctx, {
            url: listingUrl,
            instruction:
                `Extract all property listing cards from this Property Finder search results page (up to ${maxCards}). ` +
                "Each card has a link wrapping it (usually a.styles-module_property-card__link__). " +
                "For each card, extract the absolute url, title, snippet (brief description), imageUrl, price (e.g. 4,650,000 SAR), beds, baths, area (e.g. 560 sqm), and location text.",
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
            .map((c) => ({ ...c, url: c.url ? resolvePropertyFinderUrl(c.url) : undefined }))
            .filter((card) => card.url && isPropertyFinderDetailUrl(card.url))
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

        console.log("[anan.search] propertyfinder:extracted", { listingUrl, cardCount: cards.length });
        return cards;
    } catch (error) {
        state.disabled = true;
        state.reason = classifyStagehandError(error);
        console.error("[anan.search] propertyfinder:error", {
            listingUrl,
            error: error instanceof Error ? error.message : String(error),
            classification: state.reason,
        });
        return [];
    }
}
