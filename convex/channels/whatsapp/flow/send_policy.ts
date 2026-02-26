import type { OfferBlock } from "../../formatters";
import {
  type SuggestedAction,
  type WhatsAppResponseMode,
  NORMAL_SEARCH_MAX_OFFERS,
} from "../constants";
import {
  buildContextAwareCta,
  enforceWhatsAppMessageContract,
} from "./intent_normalization";

export type WhatsAppOfferQueueItem =
  | { type: "image"; imageUrl: string }
  | { type: "image_with_caption"; text: string; imageUrl: string; extraImageUrls?: string[] }
  | { type: "text"; text: string };

export function normalizeWhatsAppImageUrls(
  imageUrl?: string,
  imageUrls?: string[],
  maxImages = 8,
): string[] {
  return Array.from(
    new Set(
      (Array.isArray(imageUrls) && imageUrls.length > 0
        ? imageUrls
        : imageUrl
          ? [imageUrl]
          : []
      ).filter((url): url is string => Boolean(url)),
    ),
  ).slice(0, maxImages);
}

export function normalizeWhatsAppOfferBlocks(
  offerBlocks?: OfferBlock[],
  maxOffers = NORMAL_SEARCH_MAX_OFFERS,
): OfferBlock[] {
  if (!Array.isArray(offerBlocks) || offerBlocks.length === 0) return [];
  return offerBlocks
    .map((block) => ({
      text: (block.text ?? "").trim(),
      imageUrl: block.imageUrl?.trim() || undefined,
      imageUrls: Array.from(
        new Set(
          [block.imageUrl?.trim() ?? "", ...((block.imageUrls ?? []).map((url) => String(url ?? "").trim()))]
            .filter(Boolean),
        ),
      ).slice(0, 8),
    }))
    .filter((block) => block.text.length > 0)
    .slice(0, maxOffers);
}

export function buildSinglePropertyDetailQueue(
  block: OfferBlock,
  options?: { ctaText?: string },
): WhatsAppOfferQueueItem[] {
  const imageUrls = normalizeWhatsAppImageUrls(block.imageUrl, block.imageUrls, 8);
  const queue: WhatsAppOfferQueueItem[] = imageUrls.map((url) => ({ type: "image", imageUrl: url }));
  const cta =
    options?.ctaText?.trim() ||
    buildContextAwareCta({
      text: block.text,
      responseMode: "single_property_detail",
    });
  queue.push({
    type: "text",
    text: enforceWhatsAppMessageContract(`${block.text.trim()}\n${cta}`),
  });
  return queue;
}

export function buildWhatsAppOfferSendQueue(
  offerBlocks?: OfferBlock[],
  maxOffers = NORMAL_SEARCH_MAX_OFFERS,
  options?: {
    responseMode?: WhatsAppResponseMode;
    suggestedActions?: SuggestedAction[];
  },
): WhatsAppOfferQueueItem[] {
  const normalized = normalizeWhatsAppOfferBlocks(offerBlocks, maxOffers);
  return normalized.slice(0, maxOffers).map((block) => {
    const cta = buildContextAwareCta({
      text: block.text,
      responseMode: options?.responseMode ?? "search_list",
      suggestedActions: options?.suggestedActions,
    });
    const composedText = enforceWhatsAppMessageContract(`${block.text}\n${cta}`);
    if (block.imageUrl) {
      return {
        type: "image_with_caption",
        text: composedText,
        imageUrl: block.imageUrl,
      } as const;
    }
    return { type: "text", text: composedText } as const;
  });
}

export function ensureOfferQueueHasImageFallback(
  queue: WhatsAppOfferQueueItem[],
  imageUrls?: string[],
): WhatsAppOfferQueueItem[] {
  if (!Array.isArray(queue) || queue.length === 0) return [];
  const hasAnyImage = queue.some((item) => item.type === "image" || item.type === "image_with_caption");
  if (hasAnyImage) return queue;
  const firstFallbackImage = (imageUrls ?? []).find(Boolean);
  if (!firstFallbackImage) return queue;
  const firstTextIndex = queue.findIndex((item) => item.type === "text");
  if (firstTextIndex < 0) return queue;
  const updated = [...queue];
  const firstTextItem = updated[firstTextIndex] as { type: "text"; text: string };
  updated[firstTextIndex] = {
    type: "image_with_caption",
    text: firstTextItem.text,
    imageUrl: firstFallbackImage,
  };
  return updated;
}
