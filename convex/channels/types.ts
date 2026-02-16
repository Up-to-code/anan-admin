/**
 * Channel types and detection.
 * Entry point determines channel: webhook = WhatsApp, api/chat = app/web.
 */

import type { Channel as DomainChannel } from "../domain/types";

export type Channel = DomainChannel;

export interface ChannelContext {
  channel: Channel;
  userId: string;
  messageId?: string;
  phoneNumberId?: string;
  displayName?: string;
}

export interface ChannelMessage {
  text: string;
  imageUrl?: string;
  templateName?: string;
  templateParams?: string[];
  buttons?: Array<{ label: string; action: string }>;
}

export type DetectChannelSource =
  | { type: "webhook_whatsapp" }
  | { type: "api_chat"; headers: Headers }
  | { type: "convex_client" };

/**
 * Detect channel from request source.
 * - POST /api/webhook/whatsapp -> "whatsapp"
 * - POST /api/chat with headers -> "app" or "web" (from header if present)
 * - Convex client direct calls -> "app"
 */
export function detectChannel(source: DetectChannelSource): Channel {
  if (source.type === "webhook_whatsapp") return "whatsapp";
  if (source.type === "convex_client") return "app";
  if (source.type === "api_chat") {
    const origin = source.headers.get("origin") ?? source.headers.get("referer") ?? "";
    if (origin.includes("localhost") || origin.includes("127.0.0.1")) return "app";
    return "web";
  }
  return "app";
}
