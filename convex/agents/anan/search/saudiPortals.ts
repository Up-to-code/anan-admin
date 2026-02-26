/**
 * Saudi property portal registry and shared types.
 * Provides a unified interface for Wasalt, Bayut, Aqar, and future providers.
 */

import type { PropertyCardCandidate, PropertyFinding, StagehandState } from "./types";
import type { SerperResult } from "./types";
import { type GenericActionCtx } from "convex/server";
import { type DataModel } from "../../../_generated/dataModel";
import { buildWasaltSearchUrl, extractWasaltListingCards } from "./wasalt";
import { buildBayutSearchUrl, extractBayutListingCards } from "./bayut";
import { buildAqarSearchUrl, extractAqarListingCards } from "./aqar";
import { buildPropertyFinderSearchUrl, extractPropertyFinderListingCards } from "./propertyFinder";
import { extractGenericListingCards } from "./genericScraper";
import {
  DETAIL_ENRICHMENT_LIMIT,
  PARALLEL_DETAIL_BATCH,
  PORTAL_CARDS_PER_PAGE,
  PORTAL_MAX_PAGES,
} from "../../_lib/constants";
import { extractPropertyDetails } from "./stagehand";
import {
  extractPriceHint,
  extractLocationHint,
  extractBathroomsHint,
  extractAreaHint,
  extractBedsHint,
} from "../../_lib/sanitize";
import { computeDataQualityScore } from "./quality";

export type PortalRunResult = {
  provider: string;
  sourceUrl: string;
  findings: PropertyFinding[];
};

export interface SaudiPortalConfig {
  name: string;
  buildSearchUrl: (query: string, page?: number) => string | null;
  extractCards: (
    ctx: GenericActionCtx<DataModel>,
    listingUrl: string,
    maxCards: number,
    state: StagehandState
  ) => Promise<PropertyCardCandidate[]>;
}

// Helpers for the generic port configs
function isSaudiPropertyQuery(query: string): boolean {
  const q = query.toLowerCase();
  const saudiTerms = ["للبيع", "للإيجار", "شقة", "فيلا", "عقار", "شقق", "فلل", "أرض", "ارضي"];
  const enTerms = ["sale", "rent", "apartment", "villa", "property", "land"];
  return saudiTerms.some((t) => q.includes(t)) || enTerms.some((t) => q.includes(t));
}

function parseGenericQuery(query: string): { city: string, isRent: boolean, propType: 'apartment' | 'villa' | 'land' | 'any' } {
  const q = query.toLowerCase();
  const isRent = q.includes("إيجار") || q.includes("ايجار") || q.includes("rent");

  let propType: 'apartment' | 'villa' | 'land' | 'any' = 'any';
  if (q.includes("فيلا") || q.includes("فلل") || q.includes("villa") || q.includes("house")) propType = 'villa';
  else if (q.includes("شقة") || q.includes("شقق") || q.includes("apartment")) propType = 'apartment';
  else if (q.includes("أرض") || q.includes("ارض") || q.includes("land")) propType = 'land';

  // Basic city extraction for the generic configs
  let city = "الرياض"; // Default
  if (q.includes("جدة") || q.includes("جده") || q.includes("jeddah")) city = "جدة";
  else if (q.includes("الدمام") || q.includes("dammam")) city = "الدمام";
  else if (q.includes("مكة") || q.includes("makkah") || q.includes("mecca")) city = "مكة";
  else if (q.includes("المدينة") || q.includes("medina")) city = "المدينة";
  else if (q.includes("الخبر") || q.includes("khobar")) city = "الخبر";

  return { city, isRent, propType };
}

import type { GenericPortalConfig } from "./types";

const GENERIC_PORTALS: GenericPortalConfig[] = [
  {
    name: "Haraj",
    baseUrl: "https://haraj.com.sa",
    buildSearchUrl: (city, isRent, propType) => `https://haraj.com.sa/tags/${encodeURIComponent(city)}_${encodeURIComponent(isRent ? 'عقار للايجار' : 'عقارات')}`,
    customInstruction: "Haraj is a classifieds site. Look for listings in the main feed that look like real estate. Focus on cards with prices."
  },
  {
    name: "OpenSooq",
    baseUrl: "https://sa.opensooq.com",
    buildSearchUrl: (city, isRent, propType) => `https://sa.opensooq.com/ar/${encodeURIComponent(city)}/عقارات-${isRent ? 'للايجار' : 'للبيع'}`
  },
  {
    name: "Zaahib",
    baseUrl: "https://www.zaahib.com",
    buildSearchUrl: (city, isRent, propType) => `https://www.zaahib.com/ar/real-estate-${isRent ? 'rent' : 'sale'}/${encodeURIComponent(city)}`
  },
  {
    name: "Mourjan",
    baseUrl: "https://sa.mourjan.com",
    buildSearchUrl: (city, isRent, propType) => `https://sa.mourjan.com/${encodeURIComponent(city)}/real-estate/`
  },
  {
    name: "Sakani",
    baseUrl: "https://sakani.sa",
    buildSearchUrl: (city, isRent, propType) => `https://sakani.sa/app/marketplace?city=${encodeURIComponent(city)}`
  },
  {
    name: "Aqarat",
    baseUrl: "https://aqarat.com.sa",
    buildSearchUrl: (city, isRent, propType) => `https://aqarat.com.sa/${encodeURIComponent(city)}`
  },
  {
    name: "Esimsar",
    baseUrl: "https://esimsar.com",
    buildSearchUrl: (city, isRent, propType) => `https://esimsar.com/ar/property-for-${isRent ? 'rent' : 'sale'}/saudi-arabia`
  },
  {
    name: "Sanadak",
    baseUrl: "https://sanadak.sa",
    buildSearchUrl: (city, isRent, propType) => `https://sanadak.sa/search?city=${encodeURIComponent(city)}`
  },
  {
    name: "Deal",
    baseUrl: "https://dealapp.sa",
    buildSearchUrl: (city, isRent, propType) => `https://dealapp.sa/ar/search?city=${encodeURIComponent(city)}`
  },
  {
    name: "MadaProperties",
    baseUrl: "https://madaproperties.sa",
    buildSearchUrl: (city, isRent, propType) => `https://madaproperties.sa/properties/`
  },
  {
    name: "Boshamlan",
    baseUrl: "https://sa.boshamlan.com",
    buildSearchUrl: (city, isRent, propType) => `https://sa.boshamlan.com/${isRent ? 'للايجار' : 'للبيع'}`
  },
  {
    name: "Wafi",
    baseUrl: "https://wafi.housing.sa",
    buildSearchUrl: (city, isRent, propType) => `https://wafi.housing.sa/ar/projects`
  },
  {
    name: "Expatriates",
    baseUrl: "https://www.expatriates.com",
    buildSearchUrl: (city, isRent, propType) => `https://www.expatriates.com/classifieds/saudi/housingavailable/`
  },
  {
    name: "Zameen",
    baseUrl: "https://www.zameen.com", // Keeping logic intact but primarily a PK site
    buildSearchUrl: (city, isRent, propType) => null
  },
  {
    name: "AqaarCity",
    baseUrl: "https://www.aqaarcity.com",
    buildSearchUrl: (city, isRent, propType) => `https://www.aqaarcity.com/`
  },
  {
    name: "Daleel",
    baseUrl: "https://daleel.sa",
    buildSearchUrl: (city, isRent, propType) => `https://daleel.sa/عقارات`
  }
];

export const SAUDI_PORTAL_CONFIGS: SaudiPortalConfig[] = [
  ...GENERIC_PORTALS.map(p => ({
    name: p.name,
    buildSearchUrl: (query: string, page?: number) => {
      if (!isSaudiPropertyQuery(query)) return null;
      if (page && page > 1) return null; // No multi-page yet
      const { city, isRent, propType } = parseGenericQuery(query);
      return p.buildSearchUrl(city, isRent, propType);
    },
    extractCards: async (ctx: GenericActionCtx<DataModel>, listingUrl: string, maxCards: number, state: StagehandState) => {
      return extractGenericListingCards(ctx, listingUrl, p, maxCards, state);
    }
  })),
  {
    name: "Wasalt",
    buildSearchUrl: buildWasaltSearchUrl,
    extractCards: extractWasaltListingCards,
  },
  {
    name: "Bayut",
    buildSearchUrl: buildBayutSearchUrl,
    extractCards: extractBayutListingCards,
  },
  {
    name: "Aqar",
    buildSearchUrl: buildAqarSearchUrl,
    extractCards: extractAqarListingCards,
  },
  {
    name: "PropertyFinder",
    buildSearchUrl: buildPropertyFinderSearchUrl,
    extractCards: extractPropertyFinderListingCards,
  },
];

export async function runPortalSearch(
  ctx: GenericActionCtx<DataModel>,
  query: string,
  sourceRank: number,
  config: SaudiPortalConfig,
  state: StagehandState,
  options: {
    deadlineMs?: number;
    detailEnrichCount?: number;
    excludePropertyUrls?: Set<string>;
  }
): Promise<PortalRunResult> {
  const findings: PropertyFinding[] = [];
  const seenUrls = new Set<string>();
  const excludedPropertyUrls = options.excludePropertyUrls ?? new Set<string>();
  let remainingDetailEnrichment = Math.max(
    0,
    options.detailEnrichCount ?? DETAIL_ENRICHMENT_LIMIT,
  );

  const normalizeUrlKey = (url: string | undefined): string | null => {
    if (!url) return null;
    return url.trim().replace(/\/+$/, "").toLowerCase() || null;
  };

  for (let page = 1; page <= PORTAL_MAX_PAGES; page++) {
    if (options.deadlineMs != null && Date.now() > options.deadlineMs) break;

    const listingUrl = config.buildSearchUrl(query, page);
    if (!listingUrl) break;

    const cards = await config.extractCards(
      ctx,
      listingUrl,
      PORTAL_CARDS_PER_PAGE,
      state
    );

    if (cards.length === 0) break;

    for (let i = 0; i < cards.length; i += PARALLEL_DETAIL_BATCH) {
      if (options.deadlineMs != null && Date.now() > options.deadlineMs) break;

      const batch = cards.slice(i, i + PARALLEL_DETAIL_BATCH);
      type DetailResult = Awaited<ReturnType<typeof extractPropertyDetails>>;
      const emptyDetails: DetailResult = { imageUrls: [] };
      const enrichMask = batch.map((card) => {
        const key = normalizeUrlKey(card.url);
        const shouldEnrich =
          remainingDetailEnrichment > 0 &&
          Boolean(key) &&
          !seenUrls.has(key ?? "") &&
          !excludedPropertyUrls.has(key ?? "");
        if (shouldEnrich) remainingDetailEnrichment -= 1;
        return shouldEnrich;
      });
      const detailResults = await Promise.all(
        batch.map((card, idx) =>
          enrichMask[idx] &&
            card.url &&
            !seenUrls.has(normalizeUrlKey(card.url) ?? "")
            ? extractPropertyDetails(ctx, card.url, card.rank, state)
            : Promise.resolve(emptyDetails)
        )
      );

      for (let j = 0; j < batch.length; j++) {
        const card = batch[j];
        const cardUrlKey = normalizeUrlKey(card.url);
        if (!card.url || !cardUrlKey) continue;
        if (seenUrls.has(cardUrlKey) || excludedPropertyUrls.has(cardUrlKey)) {
          continue;
        }
        seenUrls.add(cardUrlKey);

        const details = detailResults[j];
        const mergedTitle = details?.title || card.title || "Property";
        const mergedDescription = details?.description || card.snippet;
        const textBlob = `${mergedTitle} ${mergedDescription ?? ""}`;
        const imageUrls = Array.from(
          new Set([...(details?.imageUrls ?? []), card.imageUrl ?? ""])
        ).filter(Boolean);

        const finding: PropertyFinding = {
          sourceRank,
          sourceUrl: listingUrl,
          sourceTitle: config.name,
          cardRank: card.rank,
          propertyUrl: card.url,
          detailSourceUrl: card.url,
          detailFetched: enrichMask[j],
          title: mergedTitle,
          description: mergedDescription,
          priceHint: details?.price || extractPriceHint(textBlob),
          locationHint: details?.location || extractLocationHint(textBlob),
          imageUrls,
          offerDetails: details?.offerDetails,
          bathrooms: details?.bathrooms ?? extractBathroomsHint(textBlob),
          area: details?.area ?? extractAreaHint(textBlob),
          features: details?.features,
          beds: details?.beds ?? extractBedsHint(textBlob),
        };
        finding.confidence = computeDataQualityScore(finding);
        findings.push(finding);
      }
    }
  }

  const firstUrl = config.buildSearchUrl(query, 1);
  return {
    provider: config.name,
    sourceUrl: firstUrl ?? "",
    findings,
  };
}

export function toSerperResult(sourceUrl: string, title: string): SerperResult {
  return {
    title,
    description: "",
    externalUrl: sourceUrl,
  };
}
