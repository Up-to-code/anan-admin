/**
 * WhatsApp webhook handler.
 * Verify signature, parse payload, process messages (OTP, agent, send).
 */

import type { DataModel } from "../../_generated/dataModel";
import type { GenericActionCtx } from "convex/server";
import { api, internal } from "../../_generated/api";
import { isOtpLike } from "../../lib/phone";
import type { OfferBlock } from "../formatters";
import { WhatsAppService } from "./service";

type Ctx = GenericActionCtx<DataModel>;
const WHATSAPP_SEND_GAP_MS = 200;

// --- Verify signature (see channels/whatsapp/api.ts for full implementation) ---
async function verifySignature(payload: string, signature: string, secret?: string): Promise<boolean> {
  if (!signature.startsWith("sha256=")) return false;
  const appSecret = secret ?? process.env.WHATSAPP_APP_SECRET;
  if (!appSecret) return false;
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(appSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(payload));
  const actual = "sha256=" + Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
  return actual === signature;
}

// --- Parse webhook payload (see channels/whatsapp/api.ts for full implementation) ---
interface ParsedMessage {
  from: string;
  messageId?: string;
  text: string;
  phoneNumberId?: string;
  displayName?: string;
}

interface ParsedReaction {
  from: string;
  messageId?: string;
  reactionMessageId: string;
  emoji?: string;
  phoneNumberId?: string;
}

export function normalizeWhatsAppImageUrls(
  imageUrl?: string,
  imageUrls?: string[],
  maxImages = 5
): string[] {
  return Array.from(
    new Set(
      (Array.isArray(imageUrls) && imageUrls.length > 0
        ? imageUrls
        : imageUrl
          ? [imageUrl]
          : []
      ).filter((url): url is string => Boolean(url))
    )
  ).slice(0, maxImages);
}

export function normalizeWhatsAppOfferBlocks(
  offerBlocks?: OfferBlock[],
  maxOffers = 5
): OfferBlock[] {
  if (!Array.isArray(offerBlocks) || offerBlocks.length === 0) return [];
  return offerBlocks
    .map((block) => ({
      text: (block.text ?? "").trim(),
      imageUrl: block.imageUrl?.trim() || undefined,
      imageUrls: Array.from(
        new Set(
          [
            block.imageUrl?.trim() ?? "",
            ...((block.imageUrls ?? []).map((url) => String(url ?? "").trim())),
          ].filter(Boolean)
        )
      ).slice(0, 5),
    }))
    .filter((block) => block.text.length > 0)
    .slice(0, maxOffers);
}

/** Rule 1: Per property, send all images first, then one contact (details + link) message. */
export type WhatsAppOfferQueueItem =
  | { type: "image"; imageUrl: string }
  | { type: "image_with_caption"; text: string; imageUrl: string; extraImageUrls?: string[] }
  | { type: "text"; text: string };

const MAX_OFFERS_PER_TURN = 5;
const MAX_IMAGES_PER_OFFER = 5;

function buildCompactOfferCta(text: string): string {
  const isArabic = /[\u0600-\u06FF]/.test(text);
  return isArabic
    ? "إذا مناسب لك هذا العرض، اكتب: مهتم وأرتب لك الخطوة التالية."
    : "If this option fits you, reply with interested and I will arrange the next step.";
}

/** Build queue: per offer use first image+caption, then extra images, then optional compact text CTA. */
export function buildWhatsAppOfferSendQueue(
  offerBlocks?: OfferBlock[],
  maxOffers = MAX_OFFERS_PER_TURN
): WhatsAppOfferQueueItem[] {
  const normalized = normalizeWhatsAppOfferBlocks(offerBlocks, maxOffers);
  const queue: WhatsAppOfferQueueItem[] = [];
  for (const block of normalized) {
    const imageUrls = Array.from(
      new Set([
        block.imageUrl ?? "",
        ...(block.imageUrls ?? []),
      ].filter(Boolean))
    ).slice(0, MAX_IMAGES_PER_OFFER);
    if (imageUrls.length > 0) {
      const [firstImage, ...extraImages] = imageUrls;
      queue.push({
        type: "image_with_caption",
        text: block.text,
        imageUrl: firstImage,
        extraImageUrls: extraImages,
      });
      queue.push({ type: "text", text: buildCompactOfferCta(block.text) });
      continue;
    }
    queue.push({ type: "text", text: block.text });
  }
  return queue;
}

export function ensureOfferQueueHasImageFallback(
  queue: WhatsAppOfferQueueItem[],
  imageUrls?: string[]
): WhatsAppOfferQueueItem[] {
  if (!Array.isArray(queue) || queue.length === 0) return [];
  const hasAnyImage = queue.some(
    (item) => item.type === "image" || item.type === "image_with_caption"
  );
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
    extraImageUrls: (imageUrls ?? []).filter((url) => url !== firstFallbackImage).slice(0, 4),
  };
  return updated;
}

function extractAllWebhookEvents(body: string): {
  messages: ParsedMessage[];
  reactions: ParsedReaction[];
} {
  const data = JSON.parse(body) as {
    entry?: Array<{
      changes?: Array<{
        value?: {
          metadata?: { phone_number_id?: string };
          contacts?: Array<{ profile?: { name?: string } }>;
          messages?: Array<{
            from: string;
            id?: string;
            type?: string;
            text?: { body: string };
            image?: { caption?: string };
            video?: { caption?: string };
            document?: { filename?: string };
            reaction?: { message_id: string; emoji?: string };
          }>;
        };
      }>;
    }>;
  };

  const messages: ParsedMessage[] = [];
  const reactions: ParsedReaction[] = [];

  for (const entry of data.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const value = change.value;
      if (!value?.messages) continue;

      const metadata = value.metadata ?? {};
      const contact = value.contacts?.[0];
      const phoneNumberId = metadata.phone_number_id ?? "";
      const displayName = contact?.profile?.name ?? "";
      const base = { phoneNumberId, displayName };

      for (const msg of value.messages) {
        if (msg.type === "reaction" && msg.reaction) {
          reactions.push({
            from: msg.from,
            messageId: msg.id,
            reactionMessageId: msg.reaction.message_id,
            emoji: msg.reaction.emoji,
            ...base,
          });
          continue;
        }

        const msgBase = { from: msg.from, messageId: msg.id, ...base };
        if (msg.text?.body) {
          messages.push({ ...msgBase, text: msg.text.body });
          continue;
        }
        if (msg.image) {
          const caption = msg.image.caption ?? "";
          messages.push({
            ...msgBase,
            text: caption ? `[User sent an image. Caption: ${caption}]` : "User sent an image. Ask them to describe it if you need details.",
          });
          continue;
        }
        if (msg.video) {
          const caption = msg.video.caption ?? "";
          messages.push({
            ...msgBase,
            text: caption ? `[User sent a video. Caption: ${caption}]` : "User sent a video message. Ask them to type the key points if you need details.",
          });
          continue;
        }
        if (msg.document) {
          const fn = msg.document.filename ?? "document";
          messages.push({ ...msgBase, text: `User sent a document (${fn}). Ask them to paste relevant text if you need to analyze it.` });
        }
      }
    }
  }
  return { messages, reactions };
}

// --- Handlers ---

/** GET /api/webhook/whatsapp - Meta verification */
export async function handleWhatsAppWebhookGet(_ctx: Ctx, request: Request): Promise<Response> {
  const url = new URL(request.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");
  if (mode === "subscribe" && token === process.env.WHATSAPP_VERIFY_TOKEN && challenge) {
    return new Response(challenge);
  }
  return new Response("Forbidden", { status: 403 });
}

/** POST /api/webhook/whatsapp - Incoming messages */
export async function handleWhatsAppWebhookPost(ctx: Ctx, request: Request): Promise<Response> {
  const body = await request.text();
  const sig = request.headers.get("x-hub-signature-256") ?? "";
  const secret = process.env.WHATSAPP_APP_SECRET;
  const skipVerification = process.env.WHATSAPP_SKIP_VERIFICATION === "true";

  if (secret && !skipVerification) {
    const valid = await verifySignature(body, sig, secret);
    if (!valid) return new Response("Invalid signature", { status: 401 });
  }

  const { messages: events, reactions } = extractAllWebhookEvents(body);
  const phoneNumberId =
    process.env.WHATSAPP_PHONE_NUMBER_ID ?? events[0]?.phoneNumberId ?? reactions[0]?.phoneNumberId ?? "";
  const wa = new WhatsAppService(phoneNumberId);

  for (const reaction of reactions) {
    const pid = reaction.phoneNumberId || phoneNumberId;
    if (pid && reaction.messageId) {
      await wa.markRead(reaction.messageId);
    }
  }

  for (const event of events) {
    const pid = event.phoneNumberId || phoneNumberId;
    const userId = event.from;

    if (pid && event.messageId) {
      await wa.markRead(event.messageId);
    }

    const messageText = event.text.trim();
    if (isOtpLike(messageText)) {
      const otpResult = await ctx.runMutation(internal.features.auth.actions.completeVerification, {
        phoneNumber: userId,
        otp: messageText,
      });

      if (otpResult.success) {
        const successMsg = "تم التحقق بنجاح. يمكنك العودة للتطبيق وإنشاء جلسة جديدة.";
        if (pid) await wa.sendText(userId, successMsg, event.messageId);
        continue;
      }
      if (otpResult.error === "INVALID_OTP") {
        if (pid) await wa.sendText(userId, "رمز التحقق غير صحيح. يرجى المحاولة مرة أخرى.", event.messageId);
        continue;
      }
      if (otpResult.error === "EXPIRED") {
        if (pid) await wa.sendText(userId, "انتهت صلاحية رمز التحقق. يرجى طلب رمز جديد.", event.messageId);
        continue;
      }
    }

    const apiAny = api as any;
    await ctx.runMutation(apiAny.services.users.ensureWhatsAppUser, {
      userId,
      displayName: event.displayName,
    });

    if (pid && event.messageId) {
      await wa.sendTyping(event.messageId);
    }

    const internalAny = internal as any;
    const { text: replyText, imageUrl, imageUrls, offerBlocks } = await ctx.runAction(
      internalAny.agents.actions.generateReplyAndReturnText,
      { userId, message: event.text, channel: "whatsapp" }
    );

    if (pid) {
      const normalizedImageUrls = normalizeWhatsAppImageUrls(imageUrl, imageUrls, 5);
      const offerQueue = ensureOfferQueueHasImageFallback(
        buildWhatsAppOfferSendQueue(offerBlocks, 5),
        normalizedImageUrls
      );
      if (offerQueue.length > 0) {
        for (let idx = 0; idx < offerQueue.length; idx += 1) {
          const item = offerQueue[idx];
          const replyTo = idx === 0 ? event.messageId : undefined;
          if (item.type === "image") {
            await wa.sendImage(userId, item.imageUrl, undefined, replyTo);
          } else if (item.type === "image_with_caption") {
            await wa.sendTextWithImage(userId, item.text, item.imageUrl, replyTo);
            for (const extraImage of item.extraImageUrls ?? []) {
              await wa.sendImage(userId, extraImage, undefined, event.messageId);
            }
          } else {
            await wa.sendText(userId, item.text, replyTo);
          }
          if (idx < offerQueue.length - 1) {
            await new Promise((resolve) => setTimeout(resolve, WHATSAPP_SEND_GAP_MS));
          }
        }
        continue;
      }

      if (normalizedImageUrls.length > 0) {
        const [firstImage, ...remainingImages] = normalizedImageUrls;
        if (replyText) {
          await wa.sendTextWithImage(userId, replyText, firstImage, event.messageId);
        } else {
          await wa.sendImage(userId, firstImage, undefined, event.messageId);
        }
        for (const extraImage of remainingImages) {
          await wa.sendImage(userId, extraImage);
        }
      } else if (replyText) {
        await wa.sendText(userId, replyText, event.messageId);
      }
    }
  }

  return new Response("OK");
}
