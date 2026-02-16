/**
 * Search pipeline: build findings, knowledge payload, user results.
 */

import { cleanWhitespace, sanitizeWebText } from "../../_lib/sanitize";
import { inferCountryFromLocation } from "../../_lib/location";
import type { DbPropertyResult } from "../../_lib/types";
import {
  extractPriceHint,
  extractLocationHint,
  extractBathroomsHint,
  extractAreaHint,
  extractBedsHint,
} from "../../_lib/sanitize";
import {
  MIN_CONFIDENCE_FOR_USER,
  TOP_SOURCE_LIMIT,
  TOP_CARDS_PER_SOURCE,
} from "../../_lib/constants";
import { PARALLEL_DETAIL_BATCH } from "../../_lib/constants";
import { computeDataQualityScore } from "./quality";
import { extractCardsFromSource, extractPropertyDetails } from "./stagehand";
import type {
  KnowledgePayload,
  PropertyFinding,
  SerperResult,
  SourceRun,
  StagehandState,
  UserResult,
} from "./types";

function enrichFindingsWithImagePool(
  findings: PropertyFinding[],
  extraImagePool: string[],
): void {
  const pool = [...extraImagePool];
  for (const finding of findings) {
    if (finding.imageUrls.length < 2 && pool.length > 0) {
      const extra = pool.shift()!;
      if (extra && !finding.imageUrls.includes(extra)) {
        finding.imageUrls = [...finding.imageUrls, extra].slice(0, 5);
      }
    }
  }
}

export async function buildFindings(
  ctx: unknown,
  sources: SerperResult[],
  extraImagePool?: string[],
  options?: { deadlineMs?: number },
): Promise<PropertyFinding[]> {
  const state: StagehandState = { disabled: false };
  const findings: PropertyFinding[] = [];
  const deadlineMs = options?.deadlineMs;

  for (const [sourceIdx, source] of sources.entries()) {
    if (deadlineMs != null && Date.now() > deadlineMs) {
      console.log(
        "[anan.search] buildFindings: circuit-breaker deadline reached",
        {
          findingsSoFar: findings.length,
        },
      );
      break;
    }
    const sourceRank = sourceIdx + 1;
    const sourceUrl = source.externalUrl;

    const cards = await extractCardsFromSource(
      ctx,
      sourceUrl,
      sourceRank,
      state,
    );

    if (cards.length === 0) {
      const textBlob = `${source.title} ${source.description}`;
      const imageUrls = source.imageUrl ? [source.imageUrl] : [];
      const fallbackFinding: PropertyFinding = {
        sourceRank,
        sourceUrl,
        cardRank: 1,
        propertyUrl: source.externalUrl,
        title: source.title || "Property",
        description: source.description,
        priceHint: extractPriceHint(textBlob),
        locationHint: extractLocationHint(textBlob),
        imageUrls,
        offerDetails: source.description,
        bathrooms: extractBathroomsHint(textBlob),
        area: extractAreaHint(textBlob),
        beds: extractBedsHint(textBlob),
      };
      fallbackFinding.confidence = computeDataQualityScore(fallbackFinding);
      findings.push(fallbackFinding);
      continue;
    }

    type DetailResult = Awaited<ReturnType<typeof extractPropertyDetails>>;
    const emptyDetails: DetailResult = { imageUrls: [] };
    for (let i = 0; i < cards.length; i += PARALLEL_DETAIL_BATCH) {
      if (deadlineMs != null && Date.now() > deadlineMs) break;
      const batch = cards.slice(i, i + PARALLEL_DETAIL_BATCH);
      const detailResults: DetailResult[] = await Promise.all(
        batch.map((card) =>
          card.url
            ? extractPropertyDetails(ctx, card.url, card.rank, state)
            : Promise.resolve(emptyDetails),
        ),
      );
      for (let j = 0; j < batch.length; j++) {
        const card = batch[j];
        const details = detailResults[j];
        const mergedTitle =
          details.title || card.title || source.title || "Property";
        const mergedDescription =
          details.description || card.snippet || source.description;
        const textBlob = `${mergedTitle} ${mergedDescription ?? ""}`;
        const imageUrls = Array.from(
          new Set(
            [
              ...(details.imageUrls ?? []),
              card.imageUrl ?? "",
              ...(card.imageUrls ?? []),
              source.imageUrl ?? "",
              ...(source.imageUrls ?? []),
            ]
              .flat()
              .filter(Boolean),
          ),
        ).slice(0, 5);
        const finding: PropertyFinding = {
          sourceRank,
          sourceUrl,
          cardRank: card.rank,
          propertyUrl: card.url,
          title: mergedTitle,
          description: mergedDescription,
          priceHint: details.price || extractPriceHint(textBlob),
          locationHint: details.location || extractLocationHint(textBlob),
          imageUrls,
          offerDetails: details.offerDetails,
          bathrooms: details.bathrooms ?? extractBathroomsHint(textBlob),
          area: details.area ?? extractAreaHint(textBlob),
          features: details.features,
          beds: details.beds ?? extractBedsHint(textBlob),
        };
        finding.confidence = computeDataQualityScore(finding);
        findings.push(finding);
      }
    }
  }

  if (extraImagePool && extraImagePool.length > 0) {
    enrichFindingsWithImagePool(findings, extraImagePool);
  }

  return findings;
}

export function buildKnowledgePayload(
  userId: string,
  query: string,
  channel: "whatsapp" | "app" | "web" | undefined,
  sources: SerperResult[],
  findings: PropertyFinding[],
  taskList: string[],
  searchTerms: string[],
  error?: string,
  threadId?: string,
): KnowledgePayload {
  const sourceRuns: SourceRun[] = sources.map((source, idx) => ({
    rank: idx + 1,
    title: source.title,
    url: source.externalUrl,
    snippet: source.description,
  }));

  const status = error
    ? "failed"
    : findings.length > 0
      ? "completed"
      : "partial";

  console.log("[anan.search] output:knowledge", {
    userId,
    threadId,
    findingsCount: findings.length,
    sourceRunsCount: sourceRuns.length,
    status,
  });

  return {
    userId,
    threadId,
    query,
    channel,
    status,
    requestedTopSources: TOP_SOURCE_LIMIT,
    requestedTopCardsPerSource: TOP_CARDS_PER_SOURCE,
    createdAt: Date.now(),
    taskList,
    searchTerms,
    sourceRuns,
    propertyFindings: findings,
    errorSummary: error,
  };
}

/** Build knowledge payload from DB search results (internal database path). */
export function buildKnowledgePayloadFromDbResults(args: {
  query: string;
  userId: string;
  channel?: "whatsapp" | "app" | "web";
  threadId?: string;
  dbResults: DbPropertyResult[];
  status?: "completed" | "partial" | "failed";
  errorSummary?: string;
}): KnowledgePayload {
  const propertyFindings: PropertyFinding[] = args.dbResults
    .slice(0, 10)
    .map((result, idx) => {
      const locationHint = sanitizeWebText(result.location ?? result.address);
      const imageUrls = Array.from(
        new Set(
          [
            sanitizeWebText(result.imageUrl),
            ...(result.imageUrls ?? []).map((url: string) =>
              sanitizeWebText(url),
            ),
          ].filter(Boolean),
        ),
      );
      const propertyUrl = sanitizeWebText(result.externalUrl ?? result.url);
      return {
        sourceRank: 1,
        sourceUrl: "internal://properties",
        cardRank: idx + 1,
        propertyUrl: propertyUrl || undefined,
        title: sanitizeWebText(result.title, `Property ${idx + 1}`),
        description: sanitizeWebText(result.description),
        priceHint:
          typeof result.price === "number"
            ? String(result.price)
            : sanitizeWebText(result.price),
        locationHint: locationHint || undefined,
        imageUrls,
        area: sanitizeWebText(result.area),
        bathrooms: sanitizeWebText(
          String(result.bathrooms ?? result.baths ?? ""),
        ),
        beds: sanitizeWebText(String(result.beds ?? "")),
      };
    });
  const status =
    args.status ?? (propertyFindings.length > 0 ? "completed" : "partial");
  return {
    userId: args.userId,
    threadId: args.threadId,
    query: args.query,
    channel: args.channel,
    status,
    requestedTopSources: 1,
    requestedTopCardsPerSource: Math.max(propertyFindings.length, 1),
    createdAt: Date.now(),
    taskList: [
      "Reuse internal database search results",
      "Store findings for follow-up intents (another/more details)",
    ],
    searchTerms: [cleanWhitespace(args.query)],
    sourceRuns: [
      {
        rank: 1,
        title: "Internal property database",
        url: "internal://properties",
        snippet: "Saved from DB-first search path.",
      },
    ],
    propertyFindings,
    errorSummary: args.errorSummary,
  };
}

export function buildUserResults(
  findings: PropertyFinding[],
  channel: "whatsapp" | "app" | "web" | undefined,
  limit: number,
): UserResult[] {
  const filtered = findings.filter(
    (f) => (f.confidence ?? 1) >= MIN_CONFIDENCE_FOR_USER,
  );
  const results = filtered.slice(0, limit).map((finding) => ({
    title: finding.title,
    description: sanitizeWebText(finding.description, "Property listing"),
    imageUrl: finding.imageUrls[0],
    imageUrls: finding.imageUrls.slice(0, 5),
    priceHint: finding.priceHint,
    locationHint: finding.locationHint,
    bathrooms: finding.bathrooms,
    area: finding.area,
    features: finding.features,
    beds: finding.beds,
    country: inferCountryFromLocation(finding.locationHint),
    confidence: finding.confidence,
  }));

  console.log("[anan.search] output:user", {
    channel,
    resultsCount: results.length,
    hasImages: results.some((r) => Boolean(r.imageUrl)),
  });

  return results;
}
