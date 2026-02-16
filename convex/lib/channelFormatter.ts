/**
 * Response formatter for channel-specific delivery.
 * Extracts image URLs from agent text or tool output for WhatsApp image messages.
 */

/** Convex storage URL pattern (cloud or site) */
const CONVEX_STORAGE_URL_REGEX =
  /https:\/\/[^\s"'<>]+\.convex\.(cloud|site)\/api\/storage\/[^\s"'<>]+/gi;

/**
 * Extract first Convex storage image URL from text (agent reply or tool output).
 * Returns undefined if no URL found.
 */
export function extractImageUrlFromText(text: string): string | undefined {
  const match = text.match(CONVEX_STORAGE_URL_REGEX);
  return match?.[0];
}

/**
 * Extract first image URL from tool result strings (e.g. searchProperties TOON output).
 */
export function extractImageUrlFromToolOutput(output: unknown): string | undefined {
  const str = typeof output === "string" ? output : JSON.stringify(output ?? "");
  return extractImageUrlFromText(str);
}

/**
 * Strip image URLs from text to avoid duplicating in caption.
 * Useful when sending image with caption - remove URL from caption.
 */
export function stripImageUrlsFromText(text: string): string {
  return text.replace(CONVEX_STORAGE_URL_REGEX, "").replace(/\n{3,}/g, "\n\n").trim();
}

import type { Channel } from "../domain/types";
export type { Channel } from "../domain/types";

export interface ChannelFormattedResponse {
  text: string;
  imageUrl?: string;
}

/**
 * Format agent response for channel-specific delivery.
 * For WhatsApp: extracts imageUrl if present for image+caption sending.
 */
export function formatResponseForChannel(
  text: string,
  channel: Channel
): ChannelFormattedResponse {
  if (channel !== "whatsapp") {
    return { text };
  }
  const imageUrl = extractImageUrlFromText(text);
  if (!imageUrl) {
    return { text };
  }
  const textWithoutUrl = stripImageUrlsFromText(text);
  return {
    text: textWithoutUrl || text,
    imageUrl,
  };
}
