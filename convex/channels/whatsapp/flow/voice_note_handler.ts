/**
 * Handles voice note (audio) messages: transcription, optional confirmation, and fallback.
 * Single responsibility: orchestrate transcription + voice confirmation flow.
 */

import type { Ctx } from "./inbound_dedup";
import type { VoiceConfirmationState } from "./voice_confirmation";
import { buildVoiceConfirmationPrompt, createPendingVoiceConfirmation } from "./voice_confirmation";
import { transformVoiceToText } from "../../../services/transcription";
import type { WhatsAppService } from "../service";
import { logDeliveryTurnSafe } from "./delivery_metrics";
import { VOICE_FALLBACK_MESSAGE_AR } from "../constants";

export type ProcessVoiceNoteResult =
  | { handled: true; textForStorage: string }
  | { handled: false; userMessage: string };

export async function processVoiceNote(params: {
  ctx: Ctx;
  wa: WhatsAppService;
  userId: string;
  mediaId: string;
  messageId: string | undefined;
  pid: string | undefined;
  voiceState: VoiceConfirmationState;
  voiceConfirmationEnabled: boolean;
}): Promise<ProcessVoiceNoteResult> {
  const {
    ctx,
    wa,
    userId,
    mediaId,
    messageId,
    pid,
    voiceState,
    voiceConfirmationEnabled,
  } = params;

  const tx = await transformVoiceToText(mediaId);
  voiceState.transcriptionStatus = tx.status;
  voiceState.transcriptionLatencyMs = tx.latencyMs ?? 0;

  if (tx.status === "failed") {
    const sanitized = (tx.error ?? "unknown")
      .replace(/[^\w\s\-:.]/gi, "")
      .slice(0, 80);
    console.warn("[WhatsApp] Voice transcription failed", {
      mediaId,
      reason: sanitized,
      failureStep: tx.failureStep,
    });
  }

  if (tx.status === "success" && tx.text) {
    const userMessage = tx.text;
    if (voiceConfirmationEnabled) {
      const confirm = buildVoiceConfirmationPrompt(userMessage);
      await createPendingVoiceConfirmation(ctx, {
        userId,
        transcriptText: userMessage,
        intentSummary: confirm.summary,
        sourceMessageId: messageId,
      });
      voiceState.voiceConfirmationShown = true;
      voiceState.voiceIntentConfidence = confirm.confidence;
      if (pid) await wa.sendText(userId, confirm.prompt, messageId);
      await logDeliveryTurnSafe(ctx, {
        userId,
        sourceMessageId: messageId,
        transcriptionStatus: voiceState.transcriptionStatus,
        transcriptionLatencyMs: voiceState.transcriptionLatencyMs,
        voiceConfirmationShown: true,
        voiceConfirmed: voiceState.voiceConfirmed,
        voiceCorrectionApplied: voiceState.voiceCorrectionApplied,
        voiceIntentConfidence: confirm.confidence,
        sendPolicyUsed: "general_info",
        responseMode: "general_info",
        messagesSentPerTurn: 1,
        offersSentPerTurn: 0,
        imagesSentPerTurn: 0,
        retryCount: 0,
        deliveryFailures: 0,
        silentRetryAttempts: 0,
      });
      return { handled: true, textForStorage: userMessage };
    }
    return { handled: false, userMessage };
  }

  if (pid) {
    await wa.sendText(userId, VOICE_FALLBACK_MESSAGE_AR, messageId);
  }
  await logDeliveryTurnSafe(ctx, {
    userId,
    sourceMessageId: messageId,
    transcriptionStatus: voiceState.transcriptionStatus,
    transcriptionLatencyMs: voiceState.transcriptionLatencyMs,
    voiceConfirmationShown: false,
    voiceConfirmed: voiceState.voiceConfirmed,
    voiceCorrectionApplied: voiceState.voiceCorrectionApplied,
    sendPolicyUsed: "general_info",
    responseMode: "general_info",
    messagesSentPerTurn: 1,
    offersSentPerTurn: 0,
    imagesSentPerTurn: 0,
    retryCount: 0,
    deliveryFailures: 0,
    silentRetryAttempts: 0,
  });
  return { handled: true, textForStorage: "[Voice transcription failed]" };
}
