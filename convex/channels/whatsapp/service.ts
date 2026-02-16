/**
 * WhatsApp Cloud API service.
 * Wraps all send/read/typing operations with optional 429 retry.
 */

const WHATSAPP_API_VERSION = "v21.0";
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

export interface SendResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

async function fetchWithRetry(
  url: string,
  options: RequestInit
): Promise<{ ok: boolean; status: number; data: unknown }> {
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const res = await fetch(url, options);
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (res.status === 429 && attempt < MAX_RETRIES - 1) {
      const retryAfter = (data.error as { retry_after?: number })?.retry_after ?? 1;
      await new Promise((r) => setTimeout(r, Math.min(retryAfter * 1000, 5000)));
      continue;
    }
    return { ok: res.ok, status: res.status, data };
  }
  return { ok: false, status: 429, data: { error: { message: "Rate limit exceeded" } } };
}

export class WhatsAppService {
  constructor(
    private readonly phoneNumberId: string,
    private readonly token: string = process.env.WHATSAPP_ACCESS_TOKEN ?? ""
  ) {}

  private get baseUrl(): string {
    return `https://graph.facebook.com/${WHATSAPP_API_VERSION}/${this.phoneNumberId}/messages`;
  }

  private async post(body: Record<string, unknown>): Promise<SendResult> {
    if (!this.token) {
      return { success: false, error: "WHATSAPP_ACCESS_TOKEN not set" };
    }
    const { ok, data } = await fetchWithRetry(this.baseUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.token}`,
      },
      body: JSON.stringify(body),
    });
    const err = (data as { error?: { message?: string } })?.error;
    if (!ok) {
      return {
        success: false,
        error: err?.message ?? `HTTP error`,
      };
    }
    const messages = (data as { messages?: Array<{ id: string }> })?.messages;
    return { success: true, messageId: messages?.[0]?.id };
  }

  async markRead(messageId: string): Promise<SendResult> {
    return this.post({
      messaging_product: "whatsapp",
      status: "read",
      message_id: messageId,
    });
  }

  async sendTyping(messageId: string): Promise<SendResult> {
    return this.post({
      messaging_product: "whatsapp",
      status: "read",
      message_id: messageId,
      typing_indicator: { type: "text" },
    });
  }

  async sendText(to: string, text: string, replyTo?: string): Promise<SendResult> {
    const body: Record<string, unknown> = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: to.replace(/\D/g, ""),
      type: "text",
      text: { body: text, preview_url: false },
    };
    if (replyTo) body.context = { message_id: replyTo };
    return this.post(body);
  }

  async sendImage(
    to: string,
    imageUrl: string,
    caption?: string,
    replyTo?: string
  ): Promise<SendResult> {
    const imagePayload: Record<string, string> = { link: imageUrl };
    if (caption) imagePayload.caption = caption;
    const body: Record<string, unknown> = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: to.replace(/\D/g, ""),
      type: "image",
      image: imagePayload,
    };
    if (replyTo) body.context = { message_id: replyTo };
    return this.post(body);
  }

  async sendTextWithImage(
    to: string,
    text: string,
    imageUrl: string,
    replyTo?: string
  ): Promise<SendResult> {
    const MAX_CAPTION = 1024;
    if (text.length <= MAX_CAPTION) {
      return this.sendImage(to, imageUrl, text, replyTo);
    }
    const img = await this.sendImage(to, imageUrl, undefined, replyTo);
    if (!img.success) return img;
    return this.sendText(to, text, replyTo);
  }

  async sendTemplate(
    to: string,
    templateName: string,
    params: string[] = [],
    languageCode = "en"
  ): Promise<SendResult> {
    const components =
      params.length > 0
        ? [
            {
              type: "body" as const,
              parameters: params.map((t) => ({ type: "text" as const, text: t })),
            },
          ]
        : undefined;
    return this.sendTemplateWithComponents(to, templateName, languageCode, components);
  }

  /** Send template with full component structure (body, button). Used for OTP. */
  async sendTemplateWithComponents(
    to: string,
    templateName: string,
    languageCode = "en",
    components?: Array<Record<string, unknown>>
  ): Promise<SendResult> {
    const body: Record<string, unknown> = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: to.replace(/\D/g, ""),
      type: "template",
      template: {
        name: templateName,
        language: { code: languageCode },
        ...(components && components.length > 0 && { components }),
      },
    };
    return this.post(body);
  }

  async sendReaction(to: string, messageId: string, emoji: string): Promise<SendResult> {
    return this.post({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: to.replace(/\D/g, ""),
      type: "reaction",
      reaction: { message_id: messageId, emoji },
    });
  }
}
