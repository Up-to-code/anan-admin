import type { SendResult, WhatsAppService } from "../service";
import { MAX_SEND_ATTEMPTS, WHATSAPP_SEND_GAP_MS } from "../constants";
import type { WhatsAppOfferQueueItem } from "./send_policy";

export function shouldRetrySend(error?: string): boolean {
  if (!error) return false;
  return /429|5\d\d|timeout|network|temporarily|rate limit/i.test(error);
}

export async function sendWithRetry(
  sender: () => Promise<SendResult>,
): Promise<{ result: SendResult; retries: number }> {
  let retries = 0;
  for (let attempt = 0; attempt < MAX_SEND_ATTEMPTS; attempt += 1) {
    const result = await sender();
    if (result.success || attempt === MAX_SEND_ATTEMPTS - 1) {
      return { result, retries };
    }
    if (!shouldRetrySend(result.error)) {
      return { result, retries };
    }
    retries += 1;
    const delayMs = Math.min(200 * (attempt + 1), 1200);
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
  return { result: { success: false, error: "send failed" }, retries };
}

export async function sendQueue(
  wa: WhatsAppService,
  userId: string,
  sourceMessageId: string | undefined,
  queue: WhatsAppOfferQueueItem[],
): Promise<{ sentMessages: number; sentImages: number; retryCount: number; failures: number }> {
  let sentMessages = 0;
  let sentImages = 0;
  let retryCount = 0;
  let failures = 0;

  for (let idx = 0; idx < queue.length; idx += 1) {
    const item = queue[idx];
    const replyTo = idx === 0 ? sourceMessageId : undefined;
    if (item.type === "image") {
      const sent = await sendWithRetry(() => wa.sendImage(userId, item.imageUrl, undefined, replyTo));
      retryCount += sent.retries;
      if (!sent.result.success) failures += 1;
      if (sent.result.success) {
        sentMessages += 1;
        sentImages += 1;
      }
    } else if (item.type === "image_with_caption") {
      const sent = await sendWithRetry(() => wa.sendTextWithImage(userId, item.text, item.imageUrl, replyTo));
      retryCount += sent.retries;
      if (!sent.result.success) failures += 1;
      if (sent.result.success) {
        sentMessages += 1;
        sentImages += 1;
      }
    } else {
      const sent = await sendWithRetry(() => wa.sendText(userId, item.text, replyTo));
      retryCount += sent.retries;
      if (!sent.result.success) failures += 1;
      if (sent.result.success) sentMessages += 1;
    }
    if (idx < queue.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, WHATSAPP_SEND_GAP_MS));
    }
  }
  return { sentMessages, sentImages, retryCount, failures };
}
