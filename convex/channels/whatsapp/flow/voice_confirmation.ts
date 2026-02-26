import type { Ctx } from "./inbound_dedup";
import { getServiceRef } from "./inbound_dedup";
import { compactLine, detectArabic } from "./intent_normalization";

export type VoiceConfirmationState = {
  transcriptionStatus: "not_applicable" | "success" | "failed" | "timeout";
  transcriptionLatencyMs?: number;
  voiceConfirmationShown: boolean;
  voiceConfirmed: boolean;
  voiceCorrectionApplied: boolean;
  voiceIntentConfidence?: number;
};

export function createDefaultVoiceState(): VoiceConfirmationState {
  return {
    transcriptionStatus: "not_applicable",
    voiceConfirmationShown: false,
    voiceConfirmed: false,
    voiceCorrectionApplied: false,
  };
}

export function buildVoiceConfirmationPrompt(transcript: string): {
  prompt: string;
  summary: string;
  confidence: number;
} {
  const summary = compactLine(transcript, 90);
  const isArabic = detectArabic(transcript);
  const prompt = isArabic
    ? `فهمت منك: "${summary}"\nنعم، كمل\nتعديل`
    : `I understood: "${summary}"\nYes, continue\nEdit`;
  return { prompt, summary, confidence: 0.85 };
}

export async function createPendingVoiceConfirmation(
  ctx: Ctx,
  args: {
    userId: string;
    transcriptText: string;
    intentSummary: string;
    sourceMessageId?: string;
  },
): Promise<void> {
  const ref = getServiceRef("services.whatsappEvents.createVoiceConfirmation");
  if (!ref) return;
  await ctx.runMutation(ref, args);
}

export async function getPendingVoiceConfirmation(
  ctx: Ctx,
  userId: string,
): Promise<{ _id: unknown; transcriptText: string } | null> {
  const ref = getServiceRef("services.whatsappEvents.getVoiceConfirmationByUser");
  if (!ref) return null;
  const pending = await ctx.runQuery(ref, { userId });
  if (!pending || typeof pending !== "object") return null;
  const value = pending as { _id?: unknown; transcriptText?: unknown };
  if (!value._id || typeof value.transcriptText !== "string") return null;
  return { _id: value._id, transcriptText: value.transcriptText };
}

export async function resolvePendingVoiceConfirmation(
  ctx: Ctx,
  args: { id: any; resolution: "confirmed" | "corrected" | "cancelled"; correctedText?: string },
): Promise<void> {
  const ref = getServiceRef("services.whatsappEvents.resolveVoiceConfirmation");
  if (!ref) return;
  await ctx.runMutation(ref, args);
}
