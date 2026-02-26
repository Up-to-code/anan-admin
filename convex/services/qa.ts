import { query } from "../_generated/server";
import { v } from "convex/values";

export const getValidationConfig = query({
  args: {},
  handler: async () => ({
    AGENT_ENV: process.env.AGENT_ENV ?? "",
    AGENT_TEST_ACTIONS: process.env.AGENT_TEST_ACTIONS ?? "",
    AGENT_PROD_PRIMARY_MODEL: process.env.AGENT_PROD_PRIMARY_MODEL ?? "",
    OPENROUTER_MODEL: process.env.OPENROUTER_MODEL ?? "",
    AGENT_MODEL_FALLBACKS: process.env.AGENT_MODEL_FALLBACKS ?? "",
    LLM_MODE: process.env.LLM_MODE ?? "",
    WA_TEST_WHITELIST: process.env.WA_TEST_WHITELIST ?? "",
    WA_ENGAGEMENT_V2_ENABLED: process.env.WA_ENGAGEMENT_V2_ENABLED ?? "",
    WA_VOICE_CONFIRMATION_ENABLED: process.env.WA_VOICE_CONFIRMATION_ENABLED ?? "",
    WA_QUICK_REPLY_INTENTS_ENABLED: process.env.WA_QUICK_REPLY_INTENTS_ENABLED ?? "",
  }),
});

export const getValidationSignals = query({
  args: {
    userIds: v.array(v.string()),
    sinceMs: v.number(),
  },
  handler: async (ctx, { userIds, sinceMs }) => {
    const uniqueUserIds = Array.from(new Set(userIds));

    const whatsappDeliveryLogs = [] as Array<{
      userId: string;
      sendPolicyUsed: "normal_search" | "single_property_detail" | "general_info";
      responseMode?: "search_list" | "single_property_detail" | "general_info";
      messagesSentPerTurn: number;
      offersSentPerTurn: number;
      imagesSentPerTurn: number;
      retryCount: number;
      deliveryFailures: number;
      silentRetryAttempts?: number;
      transcriptionStatus?: "not_applicable" | "success" | "failed" | "timeout";
      voiceConfirmationShown?: boolean;
      voiceConfirmed?: boolean;
      voiceCorrectionApplied?: boolean;
      createdAt: number;
    }>;

    const knowledgeResearch = [] as Array<{
      userId: string;
      query: string;
      status: "completed" | "partial" | "failed";
      sourceRuns: Array<{ url: string }>;
      propertyFindings: Array<{
        detailFetched?: boolean;
        imageUrls: string[];
        propertyUrl?: string;
      }>;
      createdAt: number;
    }>;

    const userPropertyExposure = [] as Array<{
      userId: string;
      queryKey: string;
      propertyUrlKey: string;
      createdAt: number;
    }>;

    const aiTokenUsage = [] as Array<{
      userId?: string;
      model: string;
      provider: string;
      promptTokens: number;
      completionTokens: number;
      totalTokens: number;
      _creationTime: number;
    }>;

    const voiceConfirmations = [] as Array<{
      userId: string;
      status: "pending" | "confirmed" | "corrected" | "expired" | "cancelled";
      createdAt: number;
      confirmedAt?: number;
    }>;

    for (const userId of uniqueUserIds) {
      const deliveryRows = await ctx.db
        .query("whatsappDeliveryLogs")
        .withIndex("userId", (q) => q.eq("userId", userId))
        .order("desc")
        .take(300);
      for (const row of deliveryRows) {
        if (row.createdAt < sinceMs) continue;
        whatsappDeliveryLogs.push({
          userId: row.userId,
          sendPolicyUsed: row.sendPolicyUsed,
          responseMode: row.responseMode,
          messagesSentPerTurn: row.messagesSentPerTurn,
          offersSentPerTurn: row.offersSentPerTurn,
          imagesSentPerTurn: row.imagesSentPerTurn,
          retryCount: row.retryCount,
          deliveryFailures: row.deliveryFailures,
          silentRetryAttempts: row.silentRetryAttempts,
          transcriptionStatus: row.transcriptionStatus,
          voiceConfirmationShown: row.voiceConfirmationShown,
          voiceConfirmed: row.voiceConfirmed,
          voiceCorrectionApplied: row.voiceCorrectionApplied,
          createdAt: row.createdAt,
        });
      }

      const knowledgeRows = await ctx.db
        .query("knowledgeResearch")
        .withIndex("by_userId_and_createdAt", (q) =>
          q.eq("userId", userId).gte("createdAt", sinceMs),
        )
        .order("desc")
        .take(150);
      for (const row of knowledgeRows) {
        knowledgeResearch.push({
          userId: row.userId,
          query: row.query,
          status: row.status,
          sourceRuns: row.sourceRuns.map((source) => ({ url: source.url })),
          propertyFindings: row.propertyFindings.map((finding) => ({
            detailFetched: finding.detailFetched,
            imageUrls: finding.imageUrls,
            propertyUrl: finding.propertyUrl,
          })),
          createdAt: row.createdAt,
        });
      }

      const exposureRows = await ctx.db
        .query("userPropertyExposure")
        .withIndex("userId_and_createdAt", (q) =>
          q.eq("userId", userId).gte("createdAt", sinceMs),
        )
        .order("desc")
        .take(300);
      for (const row of exposureRows) {
        userPropertyExposure.push({
          userId: row.userId,
          queryKey: row.queryKey,
          propertyUrlKey: row.propertyUrlKey,
          createdAt: row.createdAt,
        });
      }

      const tokenRows = await ctx.db
        .query("aiTokenUsage")
        .withIndex("userId", (q) => q.eq("userId", userId))
        .order("desc")
        .take(400);
      for (const row of tokenRows) {
        if (row._creationTime < sinceMs) continue;
        aiTokenUsage.push({
          userId: row.userId,
          model: row.model,
          provider: row.provider,
          promptTokens: row.promptTokens,
          completionTokens: row.completionTokens,
          totalTokens: row.totalTokens,
          _creationTime: row._creationTime,
        });
      }

      const voiceRows = await ctx.db
        .query("whatsappVoiceConfirmations")
        .withIndex("userId", (q) => q.eq("userId", userId))
        .order("desc")
        .take(120);
      for (const row of voiceRows) {
        if (row.createdAt < sinceMs) continue;
        voiceConfirmations.push({
          userId: row.userId,
          status: row.status,
          createdAt: row.createdAt,
          confirmedAt: row.confirmedAt,
        });
      }
    }

    const statusCounts = {
      processing: 0,
      done: 0,
      failed: 0,
    };

    for (const status of ["processing", "done", "failed"] as const) {
      const rows = await ctx.db
        .query("whatsappInboundEvents")
        .withIndex("status", (q) => q.eq("status", status))
        .order("desc")
        .take(1000);
      statusCounts[status] = rows.filter((row) => row.createdAt >= sinceMs).length;
    }

    return {
      userIds: uniqueUserIds,
      sinceMs,
      whatsappDeliveryLogs,
      knowledgeResearch,
      userPropertyExposure,
      aiTokenUsage,
      voiceConfirmations,
      inboundStatusCounts: statusCounts,
    };
  },
});
