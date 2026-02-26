import type { Ctx } from "./inbound_dedup";
import { getServiceRef } from "./inbound_dedup";

export type DeliveryTurnMetricsV2 = {
  userId: string;
  threadId?: string;
  sourceMessageId?: string;
  sendPolicyUsed: "normal_search" | "single_property_detail" | "general_info";
  responseMode?: "search_list" | "single_property_detail" | "general_info";
  messagesSentPerTurn: number;
  offersSentPerTurn: number;
  imagesSentPerTurn: number;
  retryCount: number;
  deliveryFailures: number;
  silentRetryAttempts?: number;
  transcriptionStatus?: "not_applicable" | "success" | "failed" | "timeout";
  transcriptionLatencyMs?: number;
  voiceConfirmationShown?: boolean;
  voiceConfirmed?: boolean;
  voiceCorrectionApplied?: boolean;
  voiceIntentConfidence?: number;
};

export async function logDeliveryTurnSafe(
  ctx: Ctx,
  args: DeliveryTurnMetricsV2,
): Promise<void> {
  const ref = getServiceRef("services.whatsappEvents.logDeliveryTurn");
  if (!ref) return;
  await ctx.runMutation(ref, args);
}
