/**
 * WhatsApp webhook handler.
 * Uses canonical parser/verification from channels/whatsapp/api.
 */

import { api, internal } from "../../_generated/api";
import type { OfferBlock } from "../formatters";
import { isOtpLike } from "../../lib/phone";
import { extractAllWebhookEvents, verifyWhatsAppSignature } from "./api";
import { WhatsAppService } from "./service";
import { processVoiceNote } from "./flow/voice_note_handler";
import {
  AGENT_FALLBACK_MESSAGE_AR,
  MAX_NORMAL_MESSAGES_PER_TURN,
  NORMAL_SEARCH_MAX_OFFERS,
  VOICE_FALLBACK_MESSAGE_AR,
  WA_SILENT_RETRY_MAX_ATTEMPTS,
  WA_SILENT_RETRY_MAX_BUDGET_MS,
  type SuggestedAction,
  type WhatsAppResponseMode,
} from "./constants";
import {
  buildContextAwareCta,
  enforceWhatsAppMessageContract,
  parseQuickReplyIntent,
  parseVoiceConfirmationDecision,
} from "./flow/intent_normalization";
import {
  buildSinglePropertyDetailQueue,
  buildWhatsAppOfferSendQueue,
  ensureOfferQueueHasImageFallback,
  normalizeWhatsAppImageUrls,
  normalizeWhatsAppOfferBlocks,
  type WhatsAppOfferQueueItem,
} from "./flow/send_policy";
import { sendQueue } from "./flow/send_executor";
import {
  insertInboundMessage,
  markEventKey,
  markInboundDone,
  markInboundFailed,
  markInboundProcessing,
  type Ctx,
} from "./flow/inbound_dedup";
import {
  createDefaultVoiceState,
  getPendingVoiceConfirmation,
  resolvePendingVoiceConfirmation,
  type VoiceConfirmationState,
} from "./flow/voice_confirmation";
import { logDeliveryTurnSafe } from "./flow/delivery_metrics";

export {
  normalizeWhatsAppImageUrls,
  normalizeWhatsAppOfferBlocks,
  buildWhatsAppOfferSendQueue,
  buildSinglePropertyDetailQueue,
  ensureOfferQueueHasImageFallback,
  parseQuickReplyIntent,
  parseVoiceConfirmationDecision,
};

type AgentReply = {
  text: string;
  imageUrl?: string;
  imageUrls?: string[];
  offerBlocks?: OfferBlock[];
  responseMode?: WhatsAppResponseMode;
  suggestedActions?: SuggestedAction[];
  threadId: string;
};

function buildCompactOfferCta(text: string): string {
  const isArabic = /[\u0600-\u06FF]/.test(text);
  return isArabic
    ? "إذا مناسب لك هذا العرض، اكتب: مهتم."
    : "If this fits, reply: interested.";
}

function baseTurnMetrics(
  userId: string,
  sourceMessageId: string | undefined,
  voiceState: VoiceConfirmationState,
) {
  return {
    userId,
    sourceMessageId,
    transcriptionStatus: voiceState.transcriptionStatus,
    transcriptionLatencyMs: voiceState.transcriptionLatencyMs,
    voiceConfirmationShown: voiceState.voiceConfirmationShown,
    voiceConfirmed: voiceState.voiceConfirmed,
    voiceCorrectionApplied: voiceState.voiceCorrectionApplied,
    voiceIntentConfidence: voiceState.voiceIntentConfidence,
  };
}

async function logGeneralInfoTurn(
  ctx: Ctx,
  userId: string,
  sourceMessageId: string | undefined,
  voiceState: VoiceConfirmationState,
  args?: { failures?: number; silentRetryAttempts?: number; messagesSent?: number },
): Promise<void> {
  await logDeliveryTurnSafe(ctx, {
    ...baseTurnMetrics(userId, sourceMessageId, voiceState),
    sendPolicyUsed: "general_info",
    responseMode: "general_info",
    messagesSentPerTurn: args?.messagesSent ?? 1,
    offersSentPerTurn: 0,
    imagesSentPerTurn: 0,
    retryCount: 0,
    deliveryFailures: args?.failures ?? 0,
    silentRetryAttempts: args?.silentRetryAttempts ?? 0,
  });
}

async function generateReplyWithSilentRetry(
  ctx: Ctx,
  args: { userId: string; message: string },
): Promise<{ reply?: AgentReply; attempts: number; lastError?: unknown }> {
  const startedAt = Date.now();
  let attempts = 0;
  let lastError: unknown;
  for (let attempt = 0; attempt <= WA_SILENT_RETRY_MAX_ATTEMPTS; attempt += 1) {
    try {
      const reply = await ctx.runAction(internal.agents.actions.generateReplyAndReturnText, {
        userId: args.userId,
        message: args.message,
        channel: "whatsapp",
      });
      return { reply: reply as AgentReply, attempts };
    } catch (error) {
      lastError = error;
      if (attempt >= WA_SILENT_RETRY_MAX_ATTEMPTS) break;
      if (Date.now() - startedAt > WA_SILENT_RETRY_MAX_BUDGET_MS) break;
      attempts += 1;
      await new Promise((resolve) => setTimeout(resolve, 250 * (attempt + 1)));
    }
  }
  return { attempts, lastError };
}

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
  const bodyBytes = await request.arrayBuffer();
  const body = new TextDecoder().decode(bodyBytes);
  const signature = request.headers.get("x-hub-signature-256") ?? "";
  const secret = process.env.WHATSAPP_APP_SECRET;
  const skipVerification = process.env.WHATSAPP_SKIP_VERIFICATION === "true";
  if (secret && !skipVerification) {
    const valid = await verifyWhatsAppSignature(bodyBytes, signature, secret);
    if (!valid) {
      console.warn("[WhatsApp] signature verification failed", {
        hasSignature: signature.length > 0,
        hasSecret: Boolean(secret),
        bodyLength: bodyBytes.byteLength,
      });
      return new Response("Invalid signature", { status: 401 });
    }
  }

  const { messages: events, reactions } = extractAllWebhookEvents(body);
  const phoneNumberId =
    process.env.WHATSAPP_PHONE_NUMBER_ID ??
    events[0]?.phoneNumberId ??
    reactions[0]?.phoneNumberId ??
    "";
  if (events.length === 0 && reactions.length === 0) {
    console.warn("[WhatsApp] webhook body had no processable messages or reactions", {
      bodyPreview: body.slice(0, 200),
    });
  }
  if (!phoneNumberId) {
    console.warn("[WhatsApp] phoneNumberId missing", {
      fromEnv: Boolean(process.env.WHATSAPP_PHONE_NUMBER_ID),
      eventsCount: events.length,
      reactionsCount: reactions.length,
    });
  }
  const wa = new WhatsAppService(phoneNumberId);
  const engagementV2Enabled = process.env.WA_ENGAGEMENT_V2_ENABLED !== "false";
  const voiceConfirmationEnabled = process.env.WA_VOICE_CONFIRMATION_ENABLED !== "false";
  const quickReplyIntentsEnabled = process.env.WA_QUICK_REPLY_INTENTS_ENABLED !== "false";

  for (const reaction of reactions) {
    const providerEventId = markEventKey({
      type: "reaction",
      id: reaction.messageId ?? reaction.reactionMessageId,
      fallback: `${reaction.from}:${reaction.reactionMessageId}`,
    });
    const accepted = await markInboundProcessing(ctx, {
      providerEventId,
      userId: reaction.from,
      eventType: "reaction",
      messageId: reaction.messageId,
    });
    if (!accepted) continue;
    try {
      if (reaction.phoneNumberId && reaction.messageId) {
        await wa.markRead(reaction.messageId);
      }
      await markInboundDone(ctx, providerEventId);
    } catch (error) {
      await markInboundFailed(
        ctx,
        providerEventId,
        error instanceof Error ? error.message : "reaction handling failed",
      );
    }
  }

  for (const event of events) {
    const providerEventId = markEventKey({
      type: "message",
      id: event.messageId,
      fallback: `${event.from}:${event.text.slice(0, 40)}`,
    });
    const accepted = await markInboundProcessing(ctx, {
      providerEventId,
      userId: event.from,
      eventType: "message",
      messageId: event.messageId,
    });
    if (!accepted) continue;

    const pid = event.phoneNumberId || phoneNumberId;
    const userId = event.from;
    const voiceState = createDefaultVoiceState();

    try {
      if (pid && event.messageId) {
        await wa.markRead(event.messageId);
      }

      const rawInputText = event.text.trim();
      if (isOtpLike(rawInputText)) {
        const otpResult = await ctx.runMutation(internal.features.auth.actions.completeVerification, {
          phoneNumber: userId,
          otp: rawInputText,
        });
        if (otpResult.success) {
          if (pid) await wa.sendText(userId, "تم التحقق بنجاح. يمكنك العودة للتطبيق.", event.messageId);
          await markInboundDone(ctx, providerEventId);
          continue;
        }
        if (pid) {
          const otpErrorText =
            otpResult.error === "EXPIRED"
              ? "انتهت صلاحية رمز التحقق. اطلب رمز جديد."
              : "رمز التحقق غير صحيح. حاول مرة ثانية.";
          await wa.sendText(userId, otpErrorText, event.messageId);
        }
        await markInboundDone(ctx, providerEventId);
        continue;
      }

      if (pid && event.messageId) {
        await wa.sendTyping(event.messageId);
      }

      await ctx.runMutation(api.services.users.ensureWhatsAppUser, {
        userId,
        displayName: event.displayName,
      });

      let userMessage = rawInputText;
      if (event.mediaType === "audio" && event.mediaId) {
        try {
          const voiceResult = await processVoiceNote({
            ctx,
            wa,
            userId,
            mediaId: event.mediaId,
            messageId: event.messageId,
            pid,
            voiceState,
            voiceConfirmationEnabled,
          });
          if (voiceResult.handled) {
            await insertInboundMessage(ctx, {
              userId,
              providerEventId,
              messageId: event.messageId,
              text: voiceResult.textForStorage,
              mediaType: "audio",
              mediaId: event.mediaId,
              phoneNumberId: pid,
            });
            await markInboundDone(ctx, providerEventId);
            continue;
          }
          userMessage = voiceResult.userMessage;
        } catch (voiceError) {
          const reason =
            voiceError instanceof Error ? voiceError.message : "voice handling threw";
          console.warn("[WhatsApp] Voice note handling failed", {
            userId,
            mediaId: event.mediaId,
            reason: reason.slice(0, 80),
          });
          await insertInboundMessage(ctx, {
            userId,
            providerEventId,
            messageId: event.messageId,
            text: "[Voice transcription failed]",
            mediaType: "audio",
            mediaId: event.mediaId,
            phoneNumberId: pid,
          });
          if (pid) {
            await wa.sendText(userId, VOICE_FALLBACK_MESSAGE_AR, event.messageId);
          }
          await markInboundDone(ctx, providerEventId);
          continue;
        }
      }

      await insertInboundMessage(ctx, {
        userId,
        providerEventId,
        messageId: event.messageId,
        text: userMessage,
        mediaType: (event.mediaType ?? "text") as "text" | "audio" | "image" | "video" | "document",
        mediaId: event.mediaId,
        phoneNumberId: pid,
      });

      if (voiceConfirmationEnabled) {
        const pendingVoice = await getPendingVoiceConfirmation(ctx, userId);
        if (pendingVoice) {
          const decision = parseVoiceConfirmationDecision(userMessage);
          if (decision.decision === "confirm") {
            voiceState.voiceConfirmed = true;
            userMessage = pendingVoice.transcriptText;
            await resolvePendingVoiceConfirmation(ctx, {
              id: pendingVoice._id,
              resolution: "confirmed",
            });
          } else if (decision.decision === "correct") {
            voiceState.voiceCorrectionApplied = true;
            const correctedText = decision.correctedText?.trim() || "";
            if (!correctedText) {
              if (pid) {
                await wa.sendText(
                  userId,
                  "تمام، اكتب التعديل بجملة قصيرة (مثال: أبي شقة غرفتين في جدة بحدود 900 ألف).",
                  event.messageId,
                );
              }
              await logGeneralInfoTurn(ctx, userId, event.messageId, voiceState);
              await markInboundDone(ctx, providerEventId);
              continue;
            }
            await resolvePendingVoiceConfirmation(ctx, {
              id: pendingVoice._id,
              resolution: "corrected",
              correctedText,
            });
            userMessage = correctedText;
          } else {
            if (pid) {
              await wa.sendText(userId, "قبل ما أكمل: اكتب (نعم، كمل) أو (تعديل: ...).", event.messageId);
            }
            voiceState.voiceConfirmationShown = true;
            await logGeneralInfoTurn(ctx, userId, event.messageId, voiceState);
            await markInboundDone(ctx, providerEventId);
            continue;
          }
        }
      }

      if (quickReplyIntentsEnabled) {
        userMessage = parseQuickReplyIntent(userMessage).normalizedMessage;
      }

      const generated = await generateReplyWithSilentRetry(ctx, {
        userId,
        message: userMessage,
      });
      if (!generated.reply) {
        if (pid) {
          await wa.sendText(userId, AGENT_FALLBACK_MESSAGE_AR, event.messageId);
        }
        await logGeneralInfoTurn(ctx, userId, event.messageId, voiceState, {
          failures: 1,
          silentRetryAttempts: generated.attempts,
        });
        await markInboundFailed(
          ctx,
          providerEventId,
          generated.lastError instanceof Error ? generated.lastError.message : "agent reply failed",
        );
        continue;
      }

      const reply = generated.reply;
      const normalizedImageUrls = normalizeWhatsAppImageUrls(reply.imageUrl, reply.imageUrls, 8);
      const responseMode = reply.responseMode ?? "general_info";
      const sendPolicyUsed =
        responseMode === "single_property_detail"
          ? "single_property_detail"
          : responseMode === "search_list"
            ? "normal_search"
            : "general_info";

      let queue: WhatsAppOfferQueueItem[] = [];
      if (responseMode === "single_property_detail" && reply.offerBlocks?.[0]) {
        const ctaText = engagementV2Enabled
          ? buildContextAwareCta({
              text: reply.offerBlocks[0].text,
              responseMode,
              suggestedActions: reply.suggestedActions,
            })
          : buildCompactOfferCta(reply.offerBlocks[0].text);
        queue = buildSinglePropertyDetailQueue(reply.offerBlocks[0], { ctaText });
      } else if (responseMode === "search_list") {
        const coreQueue = buildWhatsAppOfferSendQueue(reply.offerBlocks, NORMAL_SEARCH_MAX_OFFERS, {
          responseMode: engagementV2Enabled ? responseMode : "search_list",
          suggestedActions: engagementV2Enabled ? reply.suggestedActions : undefined,
        });
        queue = ensureOfferQueueHasImageFallback(coreQueue, normalizedImageUrls).slice(
          0,
          MAX_NORMAL_MESSAGES_PER_TURN,
        );
      } else if (reply.text) {
        queue = [
          {
            type: "text",
            text: engagementV2Enabled
              ? enforceWhatsAppMessageContract(reply.text)
              : reply.text,
          },
        ];
      }

      const sent = pid
        ? await sendQueue(wa, userId, event.messageId, queue)
        : { sentMessages: 0, sentImages: 0, retryCount: 0, failures: 0 };

      await logDeliveryTurnSafe(ctx, {
        ...baseTurnMetrics(userId, event.messageId, voiceState),
        threadId: reply.threadId,
        sendPolicyUsed,
        responseMode,
        messagesSentPerTurn: sent.sentMessages,
        offersSentPerTurn:
          responseMode === "search_list"
            ? Math.min(reply.offerBlocks?.length ?? 0, NORMAL_SEARCH_MAX_OFFERS)
            : responseMode === "single_property_detail"
              ? 1
              : 0,
        imagesSentPerTurn: sent.sentImages,
        retryCount: sent.retryCount,
        deliveryFailures: sent.failures,
        silentRetryAttempts: generated.attempts,
      });
      await markInboundDone(ctx, providerEventId);
    } catch (error) {
      if (pid && wa) {
        try {
          await wa.sendText(userId, AGENT_FALLBACK_MESSAGE_AR, event.messageId);
        } catch (_) {
          /* best-effort fallback; ignore send failure */
        }
      }
      await markInboundFailed(
        ctx,
        providerEventId,
        error instanceof Error ? error.message : "webhook event failed",
      );
    }
  }

  return new Response("OK");
}
