import { detectPreferredLanguage, hasArabicChars, hasLatinChars, type PreferredLanguage } from "../../../lib/language";
import type { OfferBlock } from "../../../channels/formatters";

type FormatOfferAgentInput = {
  offerBlocks: OfferBlock[];
  preferredLanguage: PreferredLanguage;
  query: string;
  maxImagesPerOffer?: number;
};

type FormatOfferAgentOutput = {
  leadText: string;
  offerBlocks: OfferBlock[];
};

function parseQueryBudget(query: string): number | undefined {
  const normalized = query.replace(/,/g, "");
  const budgetMatch = normalized.match(/\b(\d{4,9})\b/);
  if (!budgetMatch) return undefined;
  const value = Number(budgetMatch[1]);
  return Number.isFinite(value) ? value : undefined;
}

function normalizeLocation(value: string, preferredLanguage: PreferredLanguage): string {
  const trimmed = value.trim();
  const lower = trimmed.toLowerCase();
  if (!trimmed) return preferredLanguage === "ar" ? "غير محدد" : "Not specified";
  if (/(^|\s)ar\s+riyadh($|\s)|\briyadh\b/.test(lower)) {
    return preferredLanguage === "ar" ? "الرياض" : "Riyadh";
  }
  return trimmed;
}

function normalizePrice(
  value: string,
  preferredLanguage: PreferredLanguage,
  fallbackBudget?: number
): string {
  const trimmed = value.trim();
  if (!trimmed && fallbackBudget) {
    return preferredLanguage === "ar" ? `${fallbackBudget} ريال` : `${fallbackBudget} SAR`;
  }
  if (!trimmed) return preferredLanguage === "ar" ? "غير محدد" : "Not specified";
  const numeric = trimmed.replace(/[^\d]/g, "");
  const hasCurrency = /sar|usd|aed|ريال|k|m|ألف|مليون/i.test(trimmed);
  if (!hasCurrency && numeric.length > 0 && numeric.length <= 3 && fallbackBudget) {
    return preferredLanguage === "ar" ? `${fallbackBudget} ريال` : `${fallbackBudget} SAR`;
  }
  return trimmed;
}

function cleanDescription(
  value: string,
  preferredLanguage: PreferredLanguage
): string {
  const noUrls = value.replace(/https?:\/\/[^\s]+/g, "").trim();
  const segments = noUrls
    .split(/;|·|\||\u2022/)
    .map((part) => part.trim())
    .filter(Boolean);
  const firstUseful = segments.find((segment) => segment.length >= 12) ?? segments[0] ?? "";
  const compact = firstUseful.replace(/\s+/g, " ").trim();
  if (!compact) {
    return preferredLanguage === "ar"
      ? "تفاصيل العقار متاحة عند الطلب."
      : "Property details are available on request.";
  }

  if (preferredLanguage === "ar" && hasLatinChars(compact) && !hasArabicChars(compact)) {
    return "تفاصيل العقار متاحة عند الطلب.";
  }
  if (preferredLanguage === "en" && hasArabicChars(compact) && !hasLatinChars(compact)) {
    return "Property details are available on request.";
  }
  return compact.slice(0, 180);
}

function parseOfferBlockText(text: string): {
  title: string;
  price: string;
  location: string;
  description: string;
} {
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const firstLine = lines[0] ?? "";
  const title = firstLine.replace(/^\d+\.\s*/, "").trim();
  let price = "";
  let location = "";
  const detailLines: string[] = [];

  for (const line of lines.slice(1)) {
    const cleaned = line.replace(/^-+\s*/, "").trim();
    const priceMatch = cleaned.match(/^(?:Price|السعر)\s*:\s*(.+)$/i);
    if (priceMatch) {
      price = priceMatch[1].trim();
      continue;
    }
    const locationMatch = cleaned.match(/^(?:Location|الموقع)\s*:\s*(.+)$/i);
    if (locationMatch) {
      location = locationMatch[1].trim();
      continue;
    }
    detailLines.push(cleaned);
  }

  return {
    title,
    price,
    location,
    description: detailLines.join(" "),
  };
}

function buildOfferText(params: {
  index: number;
  preferredLanguage: PreferredLanguage;
  title: string;
  price: string;
  location: string;
  description: string;
}): string {
  const {
    index,
    preferredLanguage,
    title,
    price,
    location,
    description,
  } = params;
  const fallbackTitle = preferredLanguage === "ar" ? "عرض عقاري" : "Property offer";
  const priceLabel = preferredLanguage === "ar" ? "السعر" : "Price";
  const locationLabel = preferredLanguage === "ar" ? "الموقع" : "Location";
  return [
    `${index + 1}. ${title || fallbackTitle}`,
    `- ${priceLabel}: ${price}`,
    `- ${locationLabel}: ${location}`,
    `- ${description}`,
  ].join("\n");
}

export function runOfferFormatterAgent(input: FormatOfferAgentInput): FormatOfferAgentOutput {
  const preferredLanguage = input.preferredLanguage ?? detectPreferredLanguage(input.query);
  const fallbackBudget = parseQueryBudget(input.query);
  const maxImages = Math.max(1, Math.min(input.maxImagesPerOffer ?? 5, 5));
  const cleanedBlocks = input.offerBlocks.map((block, idx) => {
    const parsed = parseOfferBlockText(block.text ?? "");
    const title =
      (parsed.title || "").trim() ||
      (preferredLanguage === "ar" ? "عرض عقاري" : "Property offer");
    const price = normalizePrice(parsed.price, preferredLanguage, fallbackBudget);
    const location = normalizeLocation(parsed.location, preferredLanguage);
    const description = cleanDescription(parsed.description, preferredLanguage);
    const imageUrls = Array.from(
      new Set([block.imageUrl ?? "", ...(block.imageUrls ?? [])].filter(Boolean))
    ).slice(0, maxImages);
    return {
      text: buildOfferText({
        index: idx,
        preferredLanguage,
        title,
        price,
        location,
        description,
      }),
      imageUrl: imageUrls[0],
      imageUrls,
    };
  });

  const leadText =
    preferredLanguage === "ar"
      ? "أبشر، رتبت لك عروض أنظف وبصور أكثر. إذا تبغى عرض أي خيار بالتفصيل أو موعد معاينة، قلّي رقم العرض."
      : "I cleaned and refined the offers for you with richer image sets. If you want full details or to book a viewing, tell me the offer number.";

  return {
    leadText,
    offerBlocks: cleanedBlocks,
  };
}
