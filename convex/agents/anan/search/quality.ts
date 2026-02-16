/**
 * Data quality scoring for search results.
 */

import {
  extractPriceHint,
  extractLocationHint,
  sanitizeWebText,
  tokenizeTitle,
} from "../../_lib/sanitize";
import { PROPERTY_KEYWORDS } from "../../_lib/constants";
import type { SerperResult, SerperImageResult } from "./types";

const INVALID_IMAGE_PATTERNS = [
  /placeholder/i,
  /thumb(?!\w)/i,
  /logo/i,
  /avatar/i,
  /icon/i,
  /spinner/i,
  /loading/i,
  /data:image/i,
  /\/\d+x\d+\//i,
  /_thumb/i,
  /_small/i,
  /_icon/i,
];

export function validateAndFilterImageUrls(urls: string[]): string[] {
  return urls
    .filter((url) => url && typeof url === "string")
    .filter((url) => url.startsWith("http"))
    .filter((url) => !INVALID_IMAGE_PATTERNS.some((p) => p.test(url)))
    .filter((url) => {
      const hasImageExt = /\.(jpg|jpeg|png|webp|gif)(\?|$)/i.test(url);
      const isCdn = /cdn|cloudinary|imgur|amazonaws|storage|images|img/i.test(
        url,
      );
      return hasImageExt || isCdn;
    });
}

/** Score 0–1: title 0.2, price 0.2, location 0.2, description 0.15, image 0.15, beds/baths/area 0.1. */
export function computeDataQualityScore(finding: {
  title?: string;
  priceHint?: string;
  locationHint?: string;
  description?: string;
  offerDetails?: string;
  imageUrls?: string[];
  beds?: string;
  bathrooms?: string;
  area?: string;
}): number {
  let score = 0;
  if (finding.title && finding.title.trim().length > 0) score += 0.2;
  if (finding.priceHint && finding.priceHint.trim().length > 0) score += 0.2;
  if (finding.locationHint && finding.locationHint.trim().length > 0)
    score += 0.2;
  const hasDesc =
    (finding.description && finding.description.trim().length > 0) ||
    (finding.offerDetails && finding.offerDetails.trim().length > 0);
  if (hasDesc) score += 0.15;
  if (Array.isArray(finding.imageUrls) && finding.imageUrls.length >= 1)
    score += 0.15;
  const hasExtra =
    (finding.beds && finding.beds.trim().length > 0) ||
    (finding.bathrooms && finding.bathrooms.trim().length > 0) ||
    (finding.area && finding.area.trim().length > 0);
  if (hasExtra) score += 0.1;
  return Math.min(1, score);
}

export function scorePropertyResult(result: SerperResult): number {
  let score = 0;
  const combined = `${result.title} ${result.description}`.toLowerCase();

  let keywordMatches = 0;
  for (const keyword of PROPERTY_KEYWORDS) {
    if (combined.includes(keyword.toLowerCase())) {
      keywordMatches++;
    }
  }
  score += Math.min(keywordMatches * 5, 40);

  if (extractPriceHint(combined)) score += 20;
  if (extractLocationHint(combined)) score += 15;
  if (/\d+\s*(bed|bedroom|غرف|bath|bathroom|حمام)/i.test(combined)) score += 15;

  const realEstateDomains = [
    "bayut.sa",
    "aqar.fm",
    "haraj.com.sa",
    "propertyfinder.sa",
    "zameen.com",
    "realtor.com",
    "zillow.com",
    "redfin.com",
  ];
  for (const domain of realEstateDomains) {
    if (result.externalUrl.includes(domain)) {
      score += 10;
      break;
    }
  }

  return Math.min(score, 100);
}

export function attachBestImages(
  results: SerperResult[],
  images: SerperImageResult[],
): SerperResult[] {
  const byLink = new Map<string, string>();
  const pool: Array<{ title: string; imageUrl: string }> = [];
  for (const image of images) {
    if (!image.imageUrl) continue;
    if (image.link) byLink.set(image.link, image.imageUrl);
    pool.push({
      title: sanitizeWebText(image.title).toLowerCase(),
      imageUrl: image.imageUrl,
    });
  }

  const used = new Set<string>();
  return results.map((result) => {
    const direct = byLink.get(result.externalUrl);
    if (direct) {
      used.add(direct);
      return { ...result, imageUrl: direct };
    }

    const resultTokens = tokenizeTitle(result.title);
    let bestIdx = -1;
    let bestScore = 0;
    for (let i = 0; i < pool.length; i++) {
      if (used.has(pool[i].imageUrl)) continue;
      const imageTokens = tokenizeTitle(pool[i].title);
      let overlap = 0;
      for (const token of resultTokens) {
        if (imageTokens.includes(token)) overlap += 1;
      }
      if (overlap > bestScore) {
        bestScore = overlap;
        bestIdx = i;
      }
    }

    if (bestIdx >= 0 && bestScore > 0) {
      const matched = pool[bestIdx].imageUrl;
      used.add(matched);
      return { ...result, imageUrl: matched };
    }

    const fallback = pool.find((item) => !used.has(item.imageUrl));
    if (fallback) {
      used.add(fallback.imageUrl);
      return { ...result, imageUrl: fallback.imageUrl };
    }
    return result;
  });
}

export function attachMultipleImages(
  results: SerperResult[],
  images: SerperImageResult[],
  maxPerResult: number = 5,
): SerperResult[] {
  const imagePool = images
    .filter((img) => img.imageUrl)
    .map((img) => ({
      title: sanitizeWebText(img.title ?? "").toLowerCase(),
      url: img.link,
      imageUrl: img.imageUrl!,
    }));

  const usedImages = new Set<string>();

  return results.map((result) => {
    const matchedImages: string[] = [];
    const resultTokens = tokenizeTitle(result.title);

    for (const img of imagePool) {
      if (matchedImages.length >= maxPerResult) break;
      if (img.url === result.externalUrl && !usedImages.has(img.imageUrl)) {
        matchedImages.push(img.imageUrl);
        usedImages.add(img.imageUrl);
      }
    }

    if (matchedImages.length < maxPerResult) {
      const scored = imagePool
        .filter((img) => !usedImages.has(img.imageUrl))
        .map((img) => {
          const imgTokens = tokenizeTitle(img.title);
          const overlap = resultTokens.filter((t) =>
            imgTokens.includes(t),
          ).length;
          return { img, score: overlap };
        })
        .sort((a, b) => b.score - a.score);

      for (const { img } of scored) {
        if (matchedImages.length >= maxPerResult) break;
        matchedImages.push(img.imageUrl);
        usedImages.add(img.imageUrl);
      }
    }

    if (matchedImages.length < maxPerResult) {
      for (const img of imagePool) {
        if (matchedImages.length >= maxPerResult) break;
        if (!usedImages.has(img.imageUrl)) {
          matchedImages.push(img.imageUrl);
          usedImages.add(img.imageUrl);
        }
      }
    }

    const validImages = validateAndFilterImageUrls(matchedImages);

    return {
      ...result,
      imageUrl: validImages[0] ?? result.imageUrl,
      imageUrls: validImages.length > 0 ? validImages : undefined,
    };
  });
}
