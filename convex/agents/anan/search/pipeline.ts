/**
 * Search pipeline: build findings, knowledge payload, user results.
 */

import { cleanWhitespace, sanitizeWebText } from "../../_lib/sanitize";
import { inferCountryFromLocation } from "../../_lib/location";
import { internal } from "../../../_generated/api";
import type { DbPropertyResult } from "../../_lib/types";
import {
  extractPriceHint,
  extractLocationHint,
  extractBathroomsHint,
  extractAreaHint,
  extractBedsHint,
} from "../../_lib/sanitize";
import {
  DETAIL_ENRICHMENT_LIMIT,
  MIN_CONFIDENCE_FOR_USER,
  PARALLEL_DETAIL_BATCH,
  TOP_SOURCE_LIMIT,
  TOP_CARDS_PER_SOURCE,
} from "../../_lib/constants";
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
import { type GenericActionCtx } from "convex/server";
import { type DataModel } from "../../../_generated/dataModel";

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

type FindingCandidate = {
  sourceRank: number;
  sourceUrl: string;
  sourceTitle?: string;
  cardRank: number;
  propertyUrl?: string;
  title: string;
  description?: string;
  imageUrls: string[];
  score: number;
};

function normalizeCandidateImages(
  ...sources: Array<Array<string | undefined> | undefined>
): string[] {
  return Array.from(
    new Set(
      sources
        .flat()
        .flat()
        .filter((url): url is string => Boolean(url && url.startsWith("http"))),
    ),
  ).slice(0, 5);
}

function baseCandidateScore(candidate: {
  sourceRank: number;
  cardRank: number;
  propertyUrl?: string;
  imageUrls: string[];
}): number {
  const sourceWeight = Math.max(0, 40 - (candidate.sourceRank - 1) * 10);
  const cardWeight = Math.max(0, 25 - (candidate.cardRank - 1) * 8);
  const urlWeight = candidate.propertyUrl ? 20 : 0;
  const imageWeight = Math.min(candidate.imageUrls.length * 4, 12);
  return sourceWeight + cardWeight + urlWeight + imageWeight;
}

function rankCandidates(candidates: FindingCandidate[]): FindingCandidate[] {
  return [...candidates].sort((a, b) => b.score - a.score);
}

function normalizeUrlKey(url: string | undefined): string | null {
  if (!url) return null;
  return url.trim().replace(/\/+$/, "").toLowerCase() || null;
}

type CachedPropertyDetails = {
  title?: string;
  description?: string;
  price?: string;
  location?: string;
  imageUrls?: string[];
  offerDetails?: string;
  bathrooms?: string;
  area?: string;
  features?: string[];
  beds?: string;
};

async function getPropertyDetailsWithCache(
  ctx: GenericActionCtx<DataModel>,
  propertyUrl: string,
  cardRank: number,
  state: StagehandState,
): Promise<Awaited<ReturnType<typeof extractPropertyDetails>>> {
  const runQuery = (
    ctx as { runQuery?: (ref: unknown, args: unknown) => Promise<unknown> }
  ).runQuery;
  const runMutation = (
    ctx as { runMutation?: (ref: unknown, args: unknown) => Promise<unknown> }
  ).runMutation;
  if (typeof runQuery === "function") {
    try {
      const cached = (await runQuery(
        internal.services.properties.getPropertyDetailCache,
        { propertyUrl },
      )) as { detail?: CachedPropertyDetails } | null;
      if (cached?.detail) {
        return {
          title: cached.detail.title,
          description: cached.detail.description,
          price: cached.detail.price,
          location: cached.detail.location,
          imageUrls: cached.detail.imageUrls ?? [],
          offerDetails: cached.detail.offerDetails,
          bathrooms: cached.detail.bathrooms,
          area: cached.detail.area,
          features: cached.detail.features,
          beds: cached.detail.beds,
        };
      }
    } catch {
      // best-effort cache read
    }
  }

  const details = await extractPropertyDetails(ctx, propertyUrl, cardRank, state);
  if (typeof runMutation === "function" && details && details.imageUrls.length > 0) {
    const imageCount = details.imageUrls.length;
    const qualityTier = imageCount >= 4 ? "hot" : imageCount >= 2 ? "warm" : "cold";
    try {
      await runMutation(internal.services.properties.upsertPropertyDetailCache, {
        propertyUrl,
        qualityTier,
        detail: {
          title: details.title,
          description: details.description,
          price: details.price,
          location: details.location,
          imageUrls: details.imageUrls,
          offerDetails: details.offerDetails,
          bathrooms: details.bathrooms,
          area: details.area,
          features: details.features,
          beds: details.beds,
        },
      });
    } catch {
      // best-effort cache write
    }
  }
  return details;
}

function toFallbackFinding(candidate: FindingCandidate): PropertyFinding {
  const textBlob = `${candidate.title} ${candidate.description ?? ""}`;
  const finding: PropertyFinding = {
    sourceRank: candidate.sourceRank,
    sourceUrl: candidate.sourceUrl,
    sourceTitle: candidate.sourceTitle,
    cardRank: candidate.cardRank,
    propertyUrl: candidate.propertyUrl,
    detailSourceUrl: candidate.propertyUrl,
    detailFetched: false,
    title: candidate.title,
    description: candidate.description,
    priceHint: extractPriceHint(textBlob),
    locationHint: extractLocationHint(textBlob),
    imageUrls: candidate.imageUrls,
    offerDetails: candidate.description,
    bathrooms: extractBathroomsHint(textBlob),
    area: extractAreaHint(textBlob),
    beds: extractBedsHint(textBlob),
  };
  finding.confidence = computeDataQualityScore(finding);
  return finding;
}

export async function buildFindings(
  ctx: GenericActionCtx<DataModel>,
  sources: SerperResult[],
  extraImagePool?: string[],
  options?: {
    deadlineMs?: number;
    maxFindings?: number;
    detailEnrichCount?: number;
    excludePropertyUrls?: Set<string>;
  },
): Promise<PropertyFinding[]> {
  const state: StagehandState = { disabled: false };
  const findings: PropertyFinding[] = [];
  const candidates: FindingCandidate[] = [];
  const seenCandidateKeys = new Set<string>();
  const deadlineMs = options?.deadlineMs;
  const maxFindings = Math.max(options?.maxFindings ?? 12, 3);
  const detailEnrichCount = Math.max(
    1,
    Math.min(options?.detailEnrichCount ?? DETAIL_ENRICHMENT_LIMIT, 5),
  );
  const excludedUrls = new Set<string>(
    Array.from(options?.excludePropertyUrls ?? [])
      .map((url) => normalizeUrlKey(url))
      .filter((url): url is string => Boolean(url)),
  );

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
    const sourceTitle = source.title;

    const cards = await extractCardsFromSource(
      ctx,
      sourceUrl,
      sourceRank,
      state,
    );

    if (cards.length === 0) {
      const imageUrls = normalizeCandidateImages(
        [source.imageUrl],
        source.imageUrls,
      );
      const fallbackCandidate: FindingCandidate = {
        sourceRank,
        sourceUrl,
        sourceTitle,
        cardRank: 1,
        propertyUrl: source.externalUrl,
        title: source.title || "Property",
        description: source.description,
        imageUrls,
        score: baseCandidateScore({
          sourceRank,
          cardRank: 1,
          propertyUrl: source.externalUrl,
          imageUrls,
        }),
      };
      const normalizedFallbackUrl = normalizeUrlKey(fallbackCandidate.propertyUrl);
      if (normalizedFallbackUrl && excludedUrls.has(normalizedFallbackUrl)) {
        continue;
      }
      const key = normalizedFallbackUrl
        ? `url:${normalizedFallbackUrl}`
        : `fallback:${sourceRank}:${fallbackCandidate.title}`;
      if (!seenCandidateKeys.has(key)) {
        seenCandidateKeys.add(key);
        candidates.push(fallbackCandidate);
      }
      continue;
    }

    for (const card of cards) {
      const normalizedCardUrl = normalizeUrlKey(card.url);
      if (normalizedCardUrl && excludedUrls.has(normalizedCardUrl)) {
        continue;
      }
      const imageUrls = normalizeCandidateImages(
        [card.imageUrl],
        card.imageUrls,
        [source.imageUrl],
        source.imageUrls,
      );
      const candidate: FindingCandidate = {
        sourceRank,
        sourceUrl,
        sourceTitle,
        cardRank: card.rank,
        propertyUrl: card.url,
        title: card.title || source.title || "Property",
        description: card.snippet || source.description,
        imageUrls,
        score: baseCandidateScore({
          sourceRank,
          cardRank: card.rank,
          propertyUrl: card.url,
          imageUrls,
        }),
      };
      const key = normalizedCardUrl
        ? `url:${normalizedCardUrl}`
        : `text:${candidate.sourceRank}:${candidate.cardRank}:${candidate.title}`;
      if (!seenCandidateKeys.has(key)) {
        seenCandidateKeys.add(key);
        candidates.push(candidate);
      }
    }
  }

  const ranked = rankCandidates(candidates).slice(0, maxFindings);
  const detailCandidates = ranked
    .filter((candidate) => candidate.propertyUrl)
    .sort((a, b) => {
      const aWeakImages = a.imageUrls.length < 2 ? 1 : 0;
      const bWeakImages = b.imageUrls.length < 2 ? 1 : 0;
      if (aWeakImages !== bWeakImages) return bWeakImages - aWeakImages;
      return b.score - a.score;
    })
    .slice(0, detailEnrichCount);
  const detailsByUrl = new Map<
    string,
    Awaited<ReturnType<typeof extractPropertyDetails>>
  >();

  type DetailResult = Awaited<ReturnType<typeof extractPropertyDetails>>;
  const emptyDetails: DetailResult = { imageUrls: [] };
  for (let i = 0; i < detailCandidates.length; i += PARALLEL_DETAIL_BATCH) {
    if (deadlineMs != null && Date.now() > deadlineMs) break;
    const batch = detailCandidates.slice(i, i + PARALLEL_DETAIL_BATCH);
    const detailResults: DetailResult[] = await Promise.all(
      batch.map((candidate) =>
        candidate.propertyUrl
          ? getPropertyDetailsWithCache(
            ctx,
            candidate.propertyUrl,
            candidate.cardRank,
            state,
          )
          : Promise.resolve(emptyDetails),
      ),
    );
    for (let j = 0; j < batch.length; j += 1) {
      const candidate = batch[j];
      const details = detailResults[j];
      const candidateKey = normalizeUrlKey(candidate.propertyUrl);
      if (candidateKey) {
        detailsByUrl.set(candidateKey, details);
      }
    }
  }

  for (const candidate of ranked) {
    const normalizedCandidateUrl = normalizeUrlKey(candidate.propertyUrl);
    if (normalizedCandidateUrl && excludedUrls.has(normalizedCandidateUrl)) {
      continue;
    }
    const details = normalizedCandidateUrl
      ? detailsByUrl.get(normalizedCandidateUrl)
      : undefined;
    if (!details) {
      findings.push(toFallbackFinding(candidate));
      continue;
    }
    const mergedTitle =
      details.title || candidate.title || candidate.sourceTitle || "Property";
    const mergedDescription = details.description || candidate.description;
    const textBlob = `${mergedTitle} ${mergedDescription ?? ""}`;
    const imageUrls = normalizeCandidateImages(
      details.imageUrls,
      candidate.imageUrls,
    );
    const finding: PropertyFinding = {
      sourceRank: candidate.sourceRank,
      sourceUrl: candidate.sourceUrl,
      sourceTitle: candidate.sourceTitle,
      cardRank: candidate.cardRank,
      propertyUrl: candidate.propertyUrl,
      detailSourceUrl: candidate.propertyUrl,
      detailFetched: true,
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

  if (extraImagePool && extraImagePool.length > 0) {
    enrichFindingsWithImagePool(findings, extraImagePool);
  }

  // Final dedupe by propertyUrl/title while preserving rank order.
  const seenFinalKeys = new Set<string>();
  const deduped: PropertyFinding[] = [];
  for (const finding of findings) {
    const findingUrlKey = normalizeUrlKey(finding.propertyUrl);
    const key = findingUrlKey
      ? `url:${findingUrlKey}`
      : `text:${finding.sourceRank}:${finding.cardRank}:${finding.title}`;
    if (seenFinalKeys.has(key)) continue;
    seenFinalKeys.add(key);
    deduped.push(finding);
  }

  return deduped.slice(0, maxFindings);
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
        sourceTitle: "Internal property database",
        cardRank: idx + 1,
        propertyUrl: propertyUrl || undefined,
        detailSourceUrl: propertyUrl || undefined,
        detailFetched: true,
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
    (f) =>
      (f.confidence ?? 1) >= MIN_CONFIDENCE_FOR_USER &&
      Boolean((f.title ?? "").trim()) &&
      Boolean((f.propertyUrl ?? f.detailSourceUrl ?? "").trim()),
  );
  const results = filtered.slice(0, limit).map((finding) => ({
    title: finding.title,
    description: sanitizeWebText(finding.description, "Property listing"),
    externalUrl: finding.propertyUrl ?? finding.detailSourceUrl,
    sourceUrl: finding.sourceUrl,
    sourceTitle: finding.sourceTitle,
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
