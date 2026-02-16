/**
 * WhatsApp Cloud API – webhook parsing, verification, and message sending.
 * Adapted from https://github.com/Up-to-code/WhatsApp-Meta-Business-API-Handler
 */

const WHATSAPP_API_VERSION = "v21.0";

export type ExtractedMessageMediaType = "text" | "image" | "audio" | "video" | "document";

export interface ExtractedTextMessage {
  from: string;
  messageId?: string;
  text: string;
  phoneNumberId?: string;
  displayPhoneNumber?: string;
  displayName?: string;
  mediaType?: ExtractedMessageMediaType;
  caption?: string;
}

/** Reaction event from webhook (user reacted to our message) */
export interface ExtractedReactionEvent {
  from: string;
  messageId?: string;
  type: "reaction";
  reactionMessageId: string;
  emoji?: string;
  phoneNumberId?: string;
  displayPhoneNumber?: string;
  displayName?: string;
}

/** Webhook message shape for parsing */
interface WebhookMessage {
  from: string;
  id?: string;
  type?: string;
  text?: { body: string };
  image?: { id?: string; caption?: string; sha256?: string };
  audio?: { id?: string };
  video?: { id?: string; caption?: string };
  document?: { id?: string; filename?: string; caption?: string };
  reaction?: { message_id: string; emoji?: string };
}

/**
 * Extract message events from webhook body (text, image, audio, video, document).
 * Non-text types get a synthesized description for the AI.
 * Parses entry[].changes[].value per WhatsApp Cloud API format.
 */
export function extractWebhookEvents(body: string): ExtractedTextMessage[] {
  const data = JSON.parse(body) as {
    entry?: Array<{
      id?: string;
      changes?: Array<{
        value?: {
          metadata?: { phone_number_id?: string; display_phone_number?: string };
          contacts?: Array<{ wa_id?: string; profile?: { name?: string } }>;
          messages?: WebhookMessage[];
        };
      }>;
    }>;
  };

  const events: ExtractedTextMessage[] = [];

  for (const entry of data.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const value = change.value;
      if (!value?.messages) continue;

      const metadata = value.metadata ?? {};
      const contact = value.contacts?.[0];
      const phoneNumberId = metadata.phone_number_id ?? "";
      const displayPhoneNumber = metadata.display_phone_number ?? "";
      const displayName = contact?.profile?.name ?? "";

      for (const msg of value.messages) {
        const base = {
          from: msg.from,
          messageId: msg.id,
          phoneNumberId,
          displayPhoneNumber,
          displayName,
        };

        if (msg.text?.body) {
          events.push({
            ...base,
            text: msg.text.body,
            mediaType: "text",
          });
          continue;
        }

        if (msg.image) {
          const caption = msg.image.caption ?? "";
          events.push({
            ...base,
            text: caption
              ? `[User sent an image. Caption: ${caption}]`
              : "User sent an image. Ask them to describe it if you need details.",
            mediaType: "image",
            caption,
          });
          continue;
        }

        if (msg.audio) {
          events.push({
            ...base,
            text: "User sent a voice message. Ask them to type the key points if you need details.",
            mediaType: "audio",
          });
          continue;
        }

        if (msg.video) {
          const caption = msg.video.caption ?? "";
          events.push({
            ...base,
            text: caption
              ? `[User sent a video. Caption: ${caption}]`
              : "User sent a video message. Ask them to type the key points if you need details.",
            mediaType: "video",
            caption,
          });
          continue;
        }

        if (msg.document) {
          const fn = msg.document.filename ?? "document";
          events.push({
            ...base,
            text: `User sent a document (${fn}). Ask them to paste relevant text if you need to analyze it.`,
            mediaType: "document",
          });
          continue;
        }
      }
    }
  }

  return events;
}

/**
 * Extract all webhook events: messages and reactions.
 * Use this when you need to handle both in the webhook.
 */
export function extractAllWebhookEvents(body: string): {
  messages: ExtractedTextMessage[];
  reactions: ExtractedReactionEvent[];
} {
  const data = JSON.parse(body) as {
    entry?: Array<{
      id?: string;
      changes?: Array<{
        value?: {
          metadata?: { phone_number_id?: string; display_phone_number?: string };
          contacts?: Array<{ wa_id?: string; profile?: { name?: string } }>;
          messages?: WebhookMessage[];
        };
      }>;
    }>;
  };

  const messages: ExtractedTextMessage[] = [];
  const reactions: ExtractedReactionEvent[] = [];

  for (const entry of data.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const value = change.value as {
        metadata?: { phone_number_id?: string; display_phone_number?: string };
        contacts?: Array<{ wa_id?: string; profile?: { name?: string } }>;
        messages?: WebhookMessage[];
        statuses?: unknown[];
        errors?: unknown[];
      } | undefined;
      if (!value?.messages) {
        if (value?.statuses) {
          console.log("[WhatsApp] skipped status update", { statusCount: value.statuses.length });
        }
        if (value?.errors) {
          console.log("[WhatsApp] received errors", { errors: value.errors });
        }
        continue;
      }

      const metadata = value.metadata ?? {};
      const contact = value.contacts?.[0];
      const phoneNumberId = metadata.phone_number_id ?? "";
      const displayPhoneNumber = metadata.display_phone_number ?? "";
      const displayName = contact?.profile?.name ?? "";

      const base = {
        phoneNumberId,
        displayPhoneNumber,
        displayName,
      };

      for (const msg of value.messages) {
        if (msg.type === "reaction" && msg.reaction) {
          reactions.push({
            from: msg.from,
            messageId: msg.id,
            type: "reaction",
            reactionMessageId: msg.reaction.message_id,
            emoji: msg.reaction.emoji,
            ...base,
          });
          continue;
        }

        const msgBase = { from: msg.from, messageId: msg.id, ...base };

        if (msg.text?.body) {
          messages.push({ ...msgBase, text: msg.text.body, mediaType: "text" });
          continue;
        }
        if (msg.image) {
          const caption = msg.image.caption ?? "";
          messages.push({
            ...msgBase,
            text: caption
              ? `[User sent an image. Caption: ${caption}]`
              : "User sent an image. Ask them to describe it if you need details.",
            mediaType: "image",
            caption,
          });
          continue;
        }
        if (msg.audio) {
          messages.push({
            ...msgBase,
            text: "User sent a voice message. Ask them to type the key points if you need details.",
            mediaType: "audio",
          });
          continue;
        }
        if (msg.video) {
          const caption = msg.video.caption ?? "";
          messages.push({
            ...msgBase,
            text: caption
              ? `[User sent a video. Caption: ${caption}]`
              : "User sent a video message. Ask them to type the key points if you need details.",
            mediaType: "video",
            caption,
          });
          continue;
        }
        if (msg.document) {
          const fn = msg.document.filename ?? "document";
          messages.push({
            ...msgBase,
            text: `User sent a document (${fn}). Ask them to paste relevant text if you need to analyze it.`,
            mediaType: "document",
          });
        }
      }
    }
  }

  return { messages, reactions };
}

/**
 * Verify webhook signature via HMAC-SHA256.
 * Header: x-hub-signature-256 = "sha256=<hex>"
 */
export async function verifyWhatsAppSignature(
  payload: string,
  signature: string,
  secret?: string
): Promise<boolean> {
  if (!signature.startsWith("sha256=")) return false;
  const appSecret = secret ?? process.env.WHATSAPP_APP_SECRET;
  if (!appSecret) return false;
  const expected = signature;
  const actual = "sha256=" + (await hmacSha256Hex(appSecret, payload));
  return actual === expected;
}

async function hmacSha256Hex(secret: string, data: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    enc.encode(data)
  );
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Mark a message as read (double blue ticks).
 * POST to /{phoneNumberId}/messages with status: "read".
 */
export async function markMessageAsRead(
  phoneNumberId: string,
  messageId: string
): Promise<{ success: boolean; error?: string }> {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  if (!token) {
    return { success: false, error: "WHATSAPP_ACCESS_TOKEN not set" };
  }

  const url = `https://graph.facebook.com/${WHATSAPP_API_VERSION}/${phoneNumberId}/messages`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      status: "read",
      message_id: messageId,
    }),
  });

  const data = (await res.json()) as { success?: boolean; error?: { message: string } };

  if (!res.ok) {
    return {
      success: false,
      error: data.error?.message ?? `HTTP ${res.status}`,
    };
  }

  return { success: data.success ?? true };
}

/**
 * Send typing indicator (also marks message as read).
 * Shows "typing..." for ~25s or until a reply is sent.
 */
export async function sendTypingIndicator(
  phoneNumberId: string,
  messageId: string
): Promise<{ success: boolean; error?: string }> {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  if (!token) {
    return { success: false, error: "WHATSAPP_ACCESS_TOKEN not set" };
  }

  const url = `https://graph.facebook.com/${WHATSAPP_API_VERSION}/${phoneNumberId}/messages`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      status: "read",
      message_id: messageId,
      typing_indicator: { type: "text" },
    }),
  });

  const data = (await res.json()) as { success?: boolean; error?: { message: string } };

  if (!res.ok) {
    return {
      success: false,
      error: data.error?.message ?? `HTTP ${res.status}`,
    };
  }

  return { success: data.success ?? true };
}

/**
 * Send a text message via WhatsApp Cloud API.
 * Optional contextMessageId for in-thread reply.
 */
export async function sendWhatsAppMessage(
  phoneNumberId: string,
  to: string,
  text: string,
  contextMessageId?: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  if (!token) {
    return { success: false, error: "WHATSAPP_ACCESS_TOKEN not set" };
  }

  const url = `https://graph.facebook.com/${WHATSAPP_API_VERSION}/${phoneNumberId}/messages`;
  const body: Record<string, unknown> = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: to.replace(/\D/g, ""),
    type: "text",
    text: { body: text, preview_url: false },
  };
  if (contextMessageId) {
    body.context = { message_id: contextMessageId };
  }

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  const data = (await res.json()) as {
    messages?: Array<{ id: string }>;
    error?: { message: string; code?: number };
  };

  if (!res.ok) {
    return {
      success: false,
      error: data.error?.message ?? `HTTP ${res.status}`,
    };
  }

  return {
    success: true,
    messageId: data.messages?.[0]?.id,
  };
}

/**
 * Send an image message via WhatsApp Cloud API.
 * Image URL must be publicly accessible (PNG or JPG).
 * Optional contextMessageId for in-thread reply.
 */
export async function sendWhatsAppImage(
  phoneNumberId: string,
  to: string,
  imageUrl: string,
  caption?: string,
  contextMessageId?: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  if (!token) {
    return { success: false, error: "WHATSAPP_ACCESS_TOKEN not set" };
  }

  const url = `https://graph.facebook.com/${WHATSAPP_API_VERSION}/${phoneNumberId}/messages`;
  const imagePayload: { link: string; caption?: string } = { link: imageUrl };
  if (caption) imagePayload.caption = caption;

  const body: Record<string, unknown> = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: to.replace(/\D/g, ""),
    type: "image",
    image: imagePayload,
  };
  if (contextMessageId) {
    body.context = { message_id: contextMessageId };
  }

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  const data = (await res.json()) as {
    messages?: Array<{ id: string }>;
    error?: { message: string; code?: number };
  };

  if (!res.ok) {
    return {
      success: false,
      error: data.error?.message ?? `HTTP ${res.status}`,
    };
  }

  return {
    success: true,
    messageId: data.messages?.[0]?.id,
  };
}

/**
 * Send image with caption, or image first then text as separate messages.
 * When caption fits (<= 1024 chars), sends single image+caption. Otherwise sends image then text.
 * Optional contextMessageId for in-thread reply.
 */
export async function sendWhatsAppTextWithImage(
  phoneNumberId: string,
  to: string,
  text: string,
  imageUrl: string,
  contextMessageId?: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const MAX_CAPTION = 1024;
  if (text.length <= MAX_CAPTION) {
    return sendWhatsAppImage(phoneNumberId, to, imageUrl, text, contextMessageId);
  }
  const img = await sendWhatsAppImage(phoneNumberId, to, imageUrl, undefined, contextMessageId);
  if (!img.success) return img;
  return sendWhatsAppMessage(phoneNumberId, to, text, contextMessageId);
}

/**
 * Template component for WhatsApp Cloud API.
 * See: https://developers.facebook.com/docs/whatsapp/cloud-api/guides/send-message-templates
 */
export interface WhatsAppTemplateComponent {
  type: "button" | "header" | "body" | "buttons";
  sub_type?: "url" | "quick_reply" | "payload";
  index?: number;
  parameters?: Array<
    | { type: "text"; text: string }
    | { type: "image"; image: { link: string } }
    | { type: "document"; document: { link: string; filename?: string } }
    | { type: "video"; video: { link: string } }
  >;
}

export interface WhatsAppTemplateComponents {
  type: "template";
  template: {
    name: string;
    language: { code: string };
    components?: WhatsAppTemplateComponent[];
  };
}

/**
 * Send a pre-approved template message via WhatsApp Cloud API.
 * Templates must be approved in Meta Business Manager.
 */
export async function sendWhatsAppTemplate(
  phoneNumberId: string,
  to: string,
  templateName: string,
  languageCode: string = "en",
  components?: WhatsAppTemplateComponent[]
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  if (!token) {
    return { success: false, error: "WHATSAPP_ACCESS_TOKEN not set" };
  }

  const url = `https://graph.facebook.com/${WHATSAPP_API_VERSION}/${phoneNumberId}/messages`;
  const body: Record<string, unknown> = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: to.replace(/\D/g, ""),
    type: "template",
    template: {
      name: templateName,
      language: { code: languageCode },
    },
  };
  if (components?.length) {
    (body.template as Record<string, unknown>).components = components;
  }

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  const data = (await res.json()) as {
    messages?: Array<{ id: string }>;
    error?: { message: string; code?: number };
  };

  if (!res.ok) {
    return {
      success: false,
      error: data.error?.message ?? `HTTP ${res.status}`,
    };
  }

  return {
    success: true,
    messageId: data.messages?.[0]?.id,
  };
}
