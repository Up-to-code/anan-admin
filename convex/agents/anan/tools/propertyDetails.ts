import { createTool } from "@convex-dev/agent";
import { toonEncode } from "../../../lib/toon";
import { z } from "zod";
import { fetchPropertyDetailsByUrl } from "../search";
import { sanitizeWebText } from "../../_lib/sanitize";
import { isLikelyPropertyDetailUrl } from "../../_lib/location";

function extractDomainFromUrl(url: string | undefined): string | null {
    if (!url) return null;
    try {
        return new URL(url).hostname.toLowerCase();
    } catch {
        return null;
    }
}

async function runSerperImageQueries(
    apiKey: string,
    queries: string[],
): Promise<string[]> {
    const responses = await Promise.all(
        queries.map((q) =>
            fetch("https://google.serper.dev/images", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "X-API-KEY": apiKey,
                },
                body: JSON.stringify({ q, num: 20 }),
            }).catch(() => null),
        ),
    );
    const imageUrls: string[] = [];
    for (const res of responses) {
        if (!res?.ok) continue;
        try {
            const payload = (await res.json()) as {
                images?: Array<{ imageUrl?: string; image?: string }>;
            };
            for (const item of payload.images ?? []) {
                const url = item.imageUrl ?? item.image;
                if (url && url.startsWith("http")) imageUrls.push(url);
            }
        } catch {
            continue;
        }
    }
    return Array.from(new Set(imageUrls));
}

export function createPropertyDetailsTool() {
    return createTool({
        description:
            "Fetch richer details for a specific property by URL or title. Use when the user asks for more information about a property you already showed. Call getLastSearchFindings first to identify the property, then pass its propertyUrl and title here. Returns full description, Property Information, and images when available; channel sends images first then text (Rule 1).",
        args: z.object({
            propertyUrl: z.string().describe("URL of the property listing"),
            title: z
                .string()
                .optional()
                .describe("Property title (used as search query if URL search fails)"),
        }),
        handler: async (ctx, { propertyUrl, title }) => {
            if (isLikelyPropertyDetailUrl(propertyUrl)) {
                try {
                    const details = await fetchPropertyDetailsByUrl(ctx, propertyUrl);
                    if (details) {
                        const description = [details.description, details.offerDetails]
                            .filter(Boolean)
                            .join("\n\n");
                        return toonEncode({
                            responseMode: "single_property_detail",
                            results: [
                                {
                                    title: details.title,
                                    description,
                                    priceHint: details.price,
                                    locationHint: details.location,
                                    price: details.price,
                                    beds: details.beds,
                                    bathrooms: details.bathrooms,
                                    area: details.area,
                                    features: details.features,
                                    imageUrls: details.imageUrls,
                                    imageUrl: details.imageUrls[0],
                                    externalUrl: propertyUrl,
                                    url: propertyUrl,
                                },
                            ],
                            message:
                                "Present full description and Property Information. Channel sends images first then text (Rule 1). Do not include direct links unless the user explicitly asks.",
                        });
                    }
                } catch (e) {
                    console.warn(
                        "[getMoreDetailsForProperty] fetchPropertyDetailsByUrl failed, falling back to Serper",
                        e,
                    );
                }
            }

            const apiKey = process.env.SERPER_API_KEY;
            if (!apiKey) {
                return toonEncode({
                    responseMode: "single_property_detail",
                    error:
                        "Web search is not configured. Present the description and details from getLastSearchFindings instead.",
                });
            }
            const query =
                title && title.trim().length > 0 ? title.trim() : propertyUrl;
            try {
                const propertyDomain = extractDomainFromUrl(propertyUrl);
                const detailSearchQueries = Array.from(
                    new Set(
                        [
                            query,
                            propertyDomain ? `${query} site:${propertyDomain}` : "",
                            `${query} apartment details`,
                        ].filter(Boolean),
                    ),
                );
                const searchResponses = await Promise.all(
                    detailSearchQueries.map((q) =>
                        fetch("https://google.serper.dev/search", {
                            method: "POST",
                            headers: {
                                "Content-Type": "application/json",
                                "X-API-KEY": apiKey,
                            },
                            body: JSON.stringify({ q, num: 8 }),
                        }),
                    ),
                );
                const res = searchResponses[0];
                if (!res?.ok) {
                    const errText = res ? await res.text() : "no response";
                    return toonEncode({
                        responseMode: "single_property_detail",
                        error: `Search failed: ${res?.status ?? "unknown"} ${errText}`,
                        snippet: null,
                        url: null,
                    });
                }
                const organic = (
                    await Promise.all(
                        searchResponses
                            .filter((response) => response?.ok)
                            .map(async (response) => {
                                const data = (await response.json()) as {
                                    organic?: Array<{ title?: string; link?: string; snippet?: string }>;
                                };
                                return data.organic ?? [];
                            }),
                    )
                ).flat();
                const normalizedTarget = propertyUrl.replace(/\/$/, "").toLowerCase();
                const dedupedOrganic = Array.from(
                    new Map(
                        organic
                            .filter((item) => Boolean(item.link))
                            .map((item) => [
                                (item.link ?? "").replace(/\/$/, "").toLowerCase(),
                                item,
                            ]),
                    ).values(),
                );
                const match = dedupedOrganic.find((o) => {
                    const link = (o.link ?? "").replace(/\/$/, "").toLowerCase();
                    return (
                        link === normalizedTarget ||
                        link.includes(normalizedTarget) ||
                        normalizedTarget.includes(normalizedTarget) // original had logic error, fixing to normalizedTarget.includes(link)
                    );
                });
                const first = match ?? dedupedOrganic[0];
                const imageSearchQueries = Array.from(
                    new Set(
                        [
                            `${query} property images`,
                            `${query} apartment interior`,
                            `${query} exterior`,
                            propertyDomain ? `${query} site:${propertyDomain} images` : "",
                        ].filter(Boolean),
                    ),
                );
                const imageUrlsFromSearch = await runSerperImageQueries(
                    apiKey,
                    imageSearchQueries,
                );
                const detailCandidates = Array.from(
                    new Set(
                        [
                            propertyUrl,
                            ...dedupedOrganic
                                .map((item) => item.link ?? "")
                                .filter((url) => isLikelyPropertyDetailUrl(url))
                                .slice(0, 3),
                        ].filter(Boolean),
                    ),
                ).slice(0, 4);
                const detailImages = (
                    await Promise.all(
                        detailCandidates.map(async (candidateUrl) => {
                            const details = await fetchPropertyDetailsByUrl(ctx, candidateUrl);
                            return details?.imageUrls ?? [];
                        }),
                    )
                ).flat();
                const imageUrls = Array.from(
                    new Set([...detailImages, ...imageUrlsFromSearch]),
                ).slice(0, 10);
                if (!first) {
                    return toonEncode({
                        responseMode: "single_property_detail",
                        results: [],
                        snippet: null,
                        url: null,
                        title: null,
                        imageUrls,
                        message: "No additional details found.",
                    });
                }
                return toonEncode({
                    responseMode: "single_property_detail",
                    results: [
                        {
                            title: sanitizeWebText(first.title),
                            description: sanitizeWebText(first.snippet),
                            imageUrls,
                            imageUrl: imageUrls[0],
                            externalUrl: first.link ?? propertyUrl,
                            url: first.link ?? propertyUrl,
                        },
                    ],
                    message:
                        "Use this snippet to give the user a short, friendly summary of extra details (price, location, features). Keep it to one or two sentences on WhatsApp and include images when available. Do not include direct source links unless the user explicitly asks.",
                });
            } catch (e) {
                console.error("[getMoreDetailsForProperty] unhandled failure", e);
                return toonEncode({
                    error: e instanceof Error ? e.message : "Web search failed",
                    responseMode: "single_property_detail",
                    results: [],
                    snippet: null,
                    url: null,
                });
            }
        },
    });
}
