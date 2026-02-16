/**
 * Channel-specific response formatting.
 * WhatsApp: extract image URL, strip from text, short-form rules.
 * App/Web: pass-through or rich formatting.
 */

import { decode } from "@toon-format/toon";
import type { Channel } from "./types";
import {
  detectPreferredLanguage,
  hasArabicChars,
  hasLatinChars,
  type PreferredLanguage,
} from "../lib/language";

const ARABIC_LABELS = {
  price: "💰 السعر",
  location: "📍 الموقع",
  beds: "🛏️ الغرف",
  bathrooms: "🚿 الحمامات",
  area: "📐 المساحة",
  country: "🌍 الدولة",
  link: "🔗 الرابط",
  details: "📋 التفاصيل",
  limitedInfo: "(معلومات محدودة – اضغط الرابط للتفاصيل الكاملة)",
  fallbackTitle: "عرض عقاري",
  fallbackDescription: "تفاصيل العقار متاحة عند الطلب.",
} as const;

const ENGLISH_LABELS = {
  price: "💰 Price",
  location: "📍 Location",
  beds: "🛏️ Beds",
  bathrooms: "🚿 Bathrooms",
  area: "📐 Area",
  country: "🌍 Country",
  link: "🔗 Link",
  details: "📋 Details",
  limitedInfo: "(Limited info – click for full details)",
  fallbackTitle: "Property Offer",
  fallbackDescription: "Property details are available on request.",
} as const;

/** Convex storage URL pattern */
const CONVEX_STORAGE_URL_REGEX =
  /https:\/\/[^\s"'<>]+\.convex\.(cloud|site)\/api\/storage\/[^\s"'<>]+/gi;
const GENERIC_IMAGE_URL_REGEX =
  /https?:\/\/[^\s"'<>]+\.(?:png|jpe?g|webp|gif)(?:\?[^\s"'<>]*)?/gi;
const GENERIC_HTTP_URL_REGEX = /https?:\/\/[^\s"'<>]+/gi;
const IMAGE_URL_EXT_REGEX = /\.(?:png|jpe?g|webp|gif)(?:\?|$)/i;

const INVALID_IMAGE_PATTERNS = [
  /placeholder/i,
  /\/thumb/i,
  /_thumb/i,
  /\/icon/i,
  /logo/i,
  /avatar/i,
  /spinner/i,
  /loading/i,
  /data:image/i,
  /\/\d+x\d+\//i,
];

function isValidPropertyImageUrl(url: string): boolean {
  if (!url || !url.startsWith("http")) return false;
  return !INVALID_IMAGE_PATTERNS.some((p) => p.test(url));
}

/**
 * Extract imageUrl field values from JSON/TOON encoded strings.
 * Matches patterns like "imageUrl": "https://..." or imageUrl: https://...
 * Also matches bare CDN URLs that look like image hosting services.
 * This captures CDN URLs that don't end in standard image extensions.
 */
function extractImageUrlFieldValues(text: string): string[] {
  // Match "imageUrl": "..." pattern (JSON format)
  const jsonPattern = /"imageUrl"\s*:\s*"([^"]+)"/gi;
  // Match imageUrl: ... pattern (TOON key-value format)
  const toonKeyValuePattern = /imageUrl:\s*(https?:\/\/[^\s,\t\n]+)/gi;
  // Match common image CDN URLs that don't have standard extensions
  // These are often found in TOON tabular format as bare values
  const cdnPattern =
    /https?:\/\/(?:cdn\.|images?\.|img\.|res\.cloudinary|storage\.googleapis|cloudinary\.com)[^\s,\t\n"'<>]+/gi;

  const urls: string[] = [];
  let match;
  while ((match = jsonPattern.exec(text)) !== null) {
    if (match[1] && match[1].startsWith("http")) urls.push(match[1]);
  }
  while ((match = toonKeyValuePattern.exec(text)) !== null) {
    if (match[1] && match[1].startsWith("http")) urls.push(match[1]);
  }
  while ((match = cdnPattern.exec(text)) !== null) {
    if (match[0]) urls.push(match[0]);
  }
  return urls;
}

export interface FormattedResponse {
  text: string;
  imageUrl?: string;
  imageUrls?: string[];
  offerBlocks?: OfferBlock[];
}

export interface OfferBlock {
  text: string;
  imageUrl?: string;
  imageUrls?: string[];
  title?: string;
  summary?: string;
  link?: string;
  price?: string;
  country?: string;
}

type SearchResultShape = {
  title?: string;
  description?: string;
  imageUrl?: string;
  imageUrls?: string[];
  priceHint?: string;
  locationHint?: string;
  price?: string | number;
  address?: string;
  location?: string;
  externalUrl?: string;
  url?: string;
  bathrooms?: string;
  area?: string;
  features?: string[];
  beds?: string;
  country?: string;
  /** Data quality 0–1; when < 0.6 show "(Limited info – click for full details)." */
  confidence?: number;
};

function inferCountryFromLocation(locationHint?: string): string | undefined {
  const value = (locationHint ?? "").toLowerCase();
  if (!value) return undefined;
  if (
    value.includes("riyadh") ||
    value.includes("jeddah") ||
    value.includes("dammam") ||
    value.includes("saudi") ||
    value.includes("السعود") ||
    value.includes("الرياض") ||
    value.includes("جدة") ||
    value.includes("الدمام")
  ) {
    return "Saudi Arabia";
  }
  if (
    value.includes("dubai") ||
    value.includes("abu dhabi") ||
    value.includes("sharjah") ||
    value.includes("uae") ||
    value.includes("الإمارات") ||
    value.includes("دبي") ||
    value.includes("أبوظبي")
  ) {
    return "United Arab Emirates";
  }
  return undefined;
}

function extractImageUrlFromText(text: string): string | undefined {
  const convexMatch = text.match(CONVEX_STORAGE_URL_REGEX);
  if (convexMatch?.[0]) return convexMatch[0];
  const genericMatch = text.match(GENERIC_IMAGE_URL_REGEX);
  return genericMatch?.[0];
}

function extractImageUrlsFromText(text: string): string[] {
  const convexMatches = text.match(CONVEX_STORAGE_URL_REGEX) ?? [];
  const genericMatches = text.match(GENERIC_IMAGE_URL_REGEX) ?? [];
  const fieldMatches = extractImageUrlFieldValues(text);
  // Prioritize: Convex storage > standard image extensions > field values from tool output
  const ordered = [...convexMatches, ...genericMatches, ...fieldMatches];
  return Array.from(new Set(ordered));
}

function stripImageUrlsFromText(text: string): string {
  return text
    .replace(CONVEX_STORAGE_URL_REGEX, "")
    .replace(GENERIC_IMAGE_URL_REGEX, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function stripAllNonImageUrlsFromText(text: string): string {
  return text
    .replace(GENERIC_HTTP_URL_REGEX, (url) =>
      IMAGE_URL_EXT_REGEX.test(url) ? url : "",
    )
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function normalizeToolOutputCandidates(toolOutput: unknown): unknown[] {
  if (toolOutput == null) return [];
  return Array.isArray(toolOutput) ? toolOutput : [toolOutput];
}

function parseToolOutputObject(
  candidate: unknown,
): Record<string, unknown> | undefined {
  if (candidate == null) return undefined;
  if (typeof candidate === "object" && candidate !== null) {
    return candidate as Record<string, unknown>;
  }
  if (typeof candidate !== "string") return undefined;
  const str = candidate.trim();
  if (!str) return undefined;

  try {
    return JSON.parse(str) as Record<string, unknown>;
  } catch {
    // Not valid JSON format, continue to TOON decode
  }

  try {
    return decode(str) as Record<string, unknown>;
  } catch {
    // Not valid TOON format either
  }

  return undefined;
}

function asSearchResults(value: unknown): SearchResultShape[] {
  if (!value || typeof value !== "object") return [];
  const results = (value as { results?: unknown }).results;
  if (!Array.isArray(results)) return [];
  return results.filter((item): item is SearchResultShape =>
    Boolean(item && typeof item === "object"),
  );
}

function buildOfferText(
  result: SearchResultShape,
  idx: number,
  includeLinks: boolean,
  channel: Channel,
  preferredLanguage?: PreferredLanguage,
): string {
  const title = (result.title ?? "").trim();
  const rawTitle = title;
  const rawDescription = (result.description ?? "").trim();
  let description = (result.description ?? "").trim();
  const rawPriceHint =
    result.priceHint ??
    (typeof result.price === "number"
      ? String(result.price)
      : (result.price ?? ""));
  const priceHint = String(rawPriceHint ?? "").trim();
  const locationHint = (
    result.locationHint ??
    result.location ??
    result.address ??
    ""
  ).trim();
  const externalUrl = (result.externalUrl ?? result.url ?? "").trim();

  const lines: string[] = [];
  const isWhatsApp = channel === "whatsapp";
  const resolvedLanguage =
    preferredLanguage ??
    detectPreferredLanguage(`${title} ${description} ${locationHint}`);

  const labels = resolvedLanguage === "ar" ? ARABIC_LABELS : ENGLISH_LABELS;

  const titleInArabic = hasArabicChars(title);
  const titleInLatin = hasLatinChars(title);
  let displayTitle = title;

  if (resolvedLanguage === "ar" && titleInLatin && !titleInArabic) {
    displayTitle = labels.fallbackTitle;
  }
  if (resolvedLanguage === "en" && titleInArabic && !titleInLatin) {
    displayTitle = labels.fallbackTitle;
  }

  if (
    resolvedLanguage === "ar" &&
    description &&
    hasLatinChars(description) &&
    !hasArabicChars(description)
  ) {
    description = labels.fallbackDescription;
  }
  if (
    resolvedLanguage === "en" &&
    description &&
    hasArabicChars(description) &&
    !hasLatinChars(description)
  ) {
    description = labels.fallbackDescription;
  }

  if (resolvedLanguage === "ar") {
    const factBlob = `${rawTitle} ${rawDescription}`;
    const facts: string[] = [];
    const bedsMatch = factBlob.match(/(\d+)\s*(?:bed|bedroom)/i);
    const areaMatch = factBlob.match(
      /(\d+)\s*(?:sqm|sq\.?\s?m|sqft|sq\.?\s?ft)/i,
    );
    if (bedsMatch) facts.push(`عدد الغرف: ${bedsMatch[1]}`);
    if (areaMatch) facts.push(`المساحة: ${areaMatch[1]}`);
    if (description === labels.fallbackDescription && facts.length > 0) {
      description = facts.join("، ");
    }
  }

  const bathroomsHint = (result.bathrooms ?? "").trim();
  const areaHint = (result.area ?? "").trim();
  const featuresList = Array.isArray(result.features)
    ? result.features.filter(Boolean)
    : [];
  const bedsHint = (result.beds ?? "").trim();

  if (isWhatsApp) {
    lines.push(`*${idx + 1}. ${displayTitle || labels.fallbackTitle}*`);
    lines.push("");
    if (priceHint) lines.push(`${labels.price}: ${priceHint}`);
    if (locationHint) lines.push(`${labels.location}: ${locationHint}`);
    const country = (
      result.country ??
      inferCountryFromLocation(locationHint) ??
      ""
    ).trim();
    if (country) lines.push(`${labels.country}: ${country}`);
    if (bedsHint) lines.push(`${labels.beds}: ${bedsHint}`);
    if (bathroomsHint) lines.push(`${labels.bathrooms}: ${bathroomsHint}`);
    if (areaHint) lines.push(`${labels.area}: ${areaHint}`);
    if (featuresList.length > 0) {
      const featuresText = featuresList
        .slice(0, 4)
        .join(resolvedLanguage === "ar" ? "، " : ", ");
      lines.push(`${labels.details}: ${featuresText}`);
    }
    if (description) {
      const maxDescLen = 100;
      const trimmed =
        description.length > maxDescLen
          ? description
              .slice(0, maxDescLen)
              .replace(/\s+[^\s]*$/, "")
              .trim() + "…"
          : description;
      lines.push(`${trimmed}`);
    }
  } else {
    lines.push(
      displayTitle
        ? `${idx + 1}. ${displayTitle}`
        : `${idx + 1}. ${labels.fallbackTitle}`,
    );
    if (priceHint) lines.push(`${labels.price}: ${priceHint}`);
    if (locationHint) lines.push(`${labels.location}: ${locationHint}`);
    const country = (
      result.country ??
      inferCountryFromLocation(locationHint) ??
      ""
    ).trim();
    if (country) lines.push(`${labels.country}: ${country}`);
    if (bedsHint) lines.push(`${labels.beds}: ${bedsHint}`);
    if (bathroomsHint) lines.push(`${labels.bathrooms}: ${bathroomsHint}`);
    if (areaHint) lines.push(`${labels.area}: ${areaHint}`);
    if (featuresList.length > 0) {
      const featuresText = featuresList
        .slice(0, 4)
        .join(resolvedLanguage === "ar" ? "، " : ", ");
      lines.push(featuresText);
    }
    if (description) lines.push(description);
    if (includeLinks && externalUrl)
      lines.push(`${labels.link}: ${externalUrl}`);
  }

  const confidence =
    typeof result.confidence === "number" ? result.confidence : 1;
  if (confidence < 0.6) {
    lines.push(labels.limitedInfo);
  }

  return lines.join("\n").trim();
}

function extractOfferBlocksFromToolOutput(
  toolOutput: unknown,
  maxBlocks = 5,
  includeLinks = true,
  channel: Channel = "app",
  preferredLanguage?: PreferredLanguage,
): OfferBlock[] {
  const candidates = normalizeToolOutputCandidates(toolOutput);
  for (const candidate of candidates) {
    const parsed = parseToolOutputObject(candidate);
    const results = asSearchResults(parsed);
    if (results.length === 0) continue;

    return results.slice(0, maxBlocks).map((result, idx) => {
      const text = buildOfferText(
        result,
        idx,
        includeLinks,
        channel,
        preferredLanguage,
      );
      const title = (result.title ?? "").trim() || `Property ${idx + 1}`;
      const summary = (result.description ?? "").trim();
      const price =
        typeof result.price === "number"
          ? String(result.price)
          : String(result.priceHint ?? result.price ?? "").trim();
      const link = (result.externalUrl ?? result.url ?? "").trim() || undefined;
      const country = (result.country ?? "").trim() || undefined;
      const imageUrls = Array.from(
        new Set(
          [
            (result.imageUrl ?? "").trim(),
            ...(Array.isArray(result.imageUrls) ? result.imageUrls : []).map(
              (url) => String(url ?? "").trim(),
            ),
          ].filter(Boolean),
        ),
      )
        .filter(isValidPropertyImageUrl)
        .slice(0, 5);
      const imageUrl = imageUrls[0];
      const baseBlock: OfferBlock = {
        text,
        imageUrl,
        ...(imageUrls.length > 1 ? { imageUrls } : {}),
      };
      if (channel === "whatsapp") return baseBlock;
      return {
        ...baseBlock,
        title,
        summary: summary || undefined,
        link,
        price: price || undefined,
        country,
      };
    });
  }
  return [];
}

/**
 * Format raw agent reply for channel delivery.
 * WhatsApp: extracts imageUrl for image+caption, strips URLs from text.
 * App/Web: returns text as-is, extracts imageUrl if present for UI.
 */
export function formatForChannel(
  rawText: string,
  channel: Channel,
  options?: {
    extractImageFromToolOutput?: unknown;
    preferredLanguage?: PreferredLanguage;
    detailedOffers?: boolean;
  },
): FormattedResponse {
  let text = rawText;
  let imageUrl: string | undefined;
  let imageUrls: string[] = [];
  let offerBlocks: OfferBlock[] | undefined;
  const rawToolOutput = options?.extractImageFromToolOutput;
  const preferredLanguage = options?.preferredLanguage;

  if (rawToolOutput != null) {
    const str =
      typeof rawToolOutput === "string"
        ? rawToolOutput
        : JSON.stringify(rawToolOutput ?? "");
    const fromTool = extractImageUrlsFromText(str);
    const fromText = extractImageUrlsFromText(text);
    imageUrls = Array.from(new Set([...fromTool, ...fromText])).slice(0, 5);
    imageUrl = imageUrls[0] ?? extractImageUrlFromText(text);
    offerBlocks = extractOfferBlocksFromToolOutput(
      rawToolOutput,
      5,
      channel !== "whatsapp",
      channel,
      preferredLanguage,
    );
    if (channel === "whatsapp") {
      if (options?.detailedOffers && offerBlocks.length > 0) {
        // Keep offer blocks compact for WhatsApp; CTA lives in lead text.
      }
      if (offerBlocks.length > 0) {
        const blockImageUrls = offerBlocks
          .flatMap((block) =>
            block.imageUrls?.length ? block.imageUrls : [block.imageUrl],
          )
          .filter((url): url is string => Boolean(url));
        imageUrls = Array.from(
          new Set([...blockImageUrls, ...imageUrls]),
        ).slice(0, 5);
        imageUrl = imageUrls[0] ?? imageUrl;
      }
    }
  } else {
    imageUrls = extractImageUrlsFromText(text).slice(0, 5);
    imageUrl = extractImageUrlFromText(text);
  }

  if (channel === "whatsapp" && imageUrls.length > 0) {
    text = stripAllNonImageUrlsFromText(stripImageUrlsFromText(text)) || text;
    return { text, imageUrl: imageUrl ?? imageUrls[0], imageUrls, offerBlocks };
  }

  if (channel === "whatsapp" && offerBlocks && offerBlocks.length > 0) {
    return {
      text: stripAllNonImageUrlsFromText(text),
      imageUrl,
      imageUrls,
      offerBlocks,
    };
  }

  // Keep app/web backward-compatible with single-image consumers.
  return { text, imageUrl, offerBlocks };
}
