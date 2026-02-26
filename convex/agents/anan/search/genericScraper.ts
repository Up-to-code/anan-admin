/**
 * A generic, config-driven property scraper using Stagehand's LLM vision.
 * Adheres to the Open/Closed Principle: new portals can be added purely via config
 * without modifying this core extraction logic.
 */

import { Stagehand } from "@browserbasehq/convex-stagehand";
import { z } from "zod";
import { components } from "../../../_generated/api";
import { getStagehandConfig } from "../../_lib/stagehand";
import { sanitizeWebText } from "../../_lib/sanitize";
import type { PropertyCardCandidate, StagehandState, GenericPortalConfig } from "./types";
import { type GenericActionCtx } from "convex/server";
import { type DataModel } from "../../../_generated/dataModel";

function classifyStagehandError(error: unknown): string {
    const message = error instanceof Error ? error.message : String(error ?? "");
    if (message.includes("Incorrect API key provided")) return "invalid_model_key";
    if (message.includes("burst rate limit")) return "burst_rate_limited";
    if (message.includes("max concurrent sessions")) return "concurrency_limited";
    if (message.includes("429")) return "rate_limited";
    return "unknown";
}

function resolveGenericUrl(href: string, baseUrl: string): string {
    if (!href) return href;
    if (href.startsWith("http://") || href.startsWith("https://")) return href;
    try {
        return new URL(href, baseUrl).href;
    } catch {
        return href;
    }
}

export async function extractGenericListingCards(
    ctx: GenericActionCtx<DataModel>,
    listingUrl: string,
    config: GenericPortalConfig,
    maxCards: number,
    state: StagehandState
): Promise<PropertyCardCandidate[]> {
    if (state.disabled) {
        console.log(`[anan.search] generic:${config.name}:skipped`, { listingUrl, reason: state.reason });
        return [];
    }

    const stagehandConfig = getStagehandConfig();
    if ("error" in stagehandConfig) {
        state.disabled = true;
        state.reason = stagehandConfig.error;
        console.log(`[anan.search] generic:${config.name}:error`, { listingUrl, error: stagehandConfig.error });
        return [];
    }

    console.log(`[anan.search] generic:${config.name}:extracting`, { listingUrl });

    try {
        const stagehand = new Stagehand(components.stagehand, stagehandConfig);

        const baseInstruction = `Extract all property listing cards from this ${config.name} search results page (up to ${maxCards}). For each card, extract the absolute url to the property detail page, the title, a brief snippet, the main image URL, the price, the number of beds and baths, the area size, and the location text. Assume structural variety, look for standard real estate metadata formatting.`;

        const instruction = config.customInstruction
            ? `${baseInstruction}\n\nSPECIAL INSTRUCTIONS FOR ${config.name}:\n${config.customInstruction}`
            : baseInstruction;

        const extracted = await stagehand.extract(ctx, {
            url: listingUrl,
            instruction,
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
            .map((c) => ({ ...c, url: c.url ? resolveGenericUrl(c.url, config.baseUrl) : undefined }))
            .filter((card) => card.url && card.url.length > 5) // Basic sanity check
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

        console.log(`[anan.search] generic:${config.name}:extracted`, { listingUrl, cardCount: cards.length });
        return cards;
    } catch (error) {
        state.disabled = true;
        state.reason = classifyStagehandError(error);
        console.error(`[anan.search] generic:${config.name}:error`, {
            listingUrl,
            error: error instanceof Error ? error.message : String(error),
            classification: state.reason,
        });
        return [];
    }
}
