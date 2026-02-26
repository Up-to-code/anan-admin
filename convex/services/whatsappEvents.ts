import { internalMutation, internalQuery } from "../_generated/server";
import { v } from "convex/values";

export const getInboundStatusByProviderEventId = internalQuery({
  args: { providerEventId: v.string() },
  returns: v.union(
    v.null(),
    v.object({
      status: v.union(
        v.literal("processing"),
        v.literal("done"),
        v.literal("failed"),
      ),
    }),
  ),
  handler: async (ctx, { providerEventId }) => {
    const row = await ctx.db
      .query("whatsappInboundEvents")
      .withIndex("providerEventId", (q) => q.eq("providerEventId", providerEventId))
      .first();
    if (!row) return null;
    return { status: row.status };
  },
});

export const markInboundProcessing = internalMutation({
  args: {
    providerEventId: v.string(),
    userId: v.optional(v.string()),
    eventType: v.union(v.literal("message"), v.literal("reaction")),
    messageId: v.optional(v.string()),
  },
  returns: v.object({ accepted: v.boolean() }),
  handler: async (ctx, { providerEventId, userId, eventType, messageId }) => {
    const existing = await ctx.db
      .query("whatsappInboundEvents")
      .withIndex("providerEventId", (q) => q.eq("providerEventId", providerEventId))
      .first();
    if (existing) {
      return { accepted: existing.status !== "done" };
    }
    const now = Date.now();
    await ctx.db.insert("whatsappInboundEvents", {
      providerEventId,
      userId,
      eventType,
      status: "processing",
      messageId,
      createdAt: now,
      updatedAt: now,
    });
    return { accepted: true };
  },
});

export const markInboundDone = internalMutation({
  args: { providerEventId: v.string() },
  returns: v.null(),
  handler: async (ctx, { providerEventId }) => {
    const row = await ctx.db
      .query("whatsappInboundEvents")
      .withIndex("providerEventId", (q) => q.eq("providerEventId", providerEventId))
      .first();
    if (!row) return null;
    await ctx.db.patch(row._id, { status: "done", updatedAt: Date.now(), error: undefined });
    return null;
  },
});

export const insertWhatsAppInboundMessage = internalMutation({
  args: {
    userId: v.string(),
    providerEventId: v.string(),
    messageId: v.optional(v.string()),
    text: v.string(),
    mediaType: v.optional(
      v.union(
        v.literal("text"),
        v.literal("audio"),
        v.literal("image"),
        v.literal("video"),
        v.literal("document"),
      ),
    ),
    mediaId: v.optional(v.string()),
    phoneNumberId: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("whatsappInboundMessages")
      .withIndex("providerEventId", (q) => q.eq("providerEventId", args.providerEventId))
      .first();
    if (existing) return null;
    await ctx.db.insert("whatsappInboundMessages", {
      ...args,
      createdAt: Date.now(),
    });
    return null;
  },
});

export const markInboundFailed = internalMutation({
  args: { providerEventId: v.string(), error: v.string() },
  returns: v.null(),
  handler: async (ctx, { providerEventId, error }) => {
    const row = await ctx.db
      .query("whatsappInboundEvents")
      .withIndex("providerEventId", (q) => q.eq("providerEventId", providerEventId))
      .first();
    if (!row) return null;
    await ctx.db.patch(row._id, {
      status: "failed",
      updatedAt: Date.now(),
      error: error.slice(0, 600),
    });
    return null;
  },
});

export const logDeliveryTurn = internalMutation({
  args: {
    userId: v.string(),
    threadId: v.optional(v.string()),
    sourceMessageId: v.optional(v.string()),
    sendPolicyUsed: v.union(
      v.literal("normal_search"),
      v.literal("single_property_detail"),
      v.literal("general_info"),
    ),
    responseMode: v.optional(
      v.union(
        v.literal("search_list"),
        v.literal("single_property_detail"),
        v.literal("general_info"),
      ),
    ),
    messagesSentPerTurn: v.number(),
    offersSentPerTurn: v.number(),
    imagesSentPerTurn: v.number(),
    retryCount: v.number(),
    deliveryFailures: v.number(),
    silentRetryAttempts: v.optional(v.number()),
    transcriptionStatus: v.optional(
      v.union(
        v.literal("not_applicable"),
        v.literal("success"),
        v.literal("failed"),
        v.literal("timeout"),
      ),
    ),
    transcriptionLatencyMs: v.optional(v.number()),
    voiceConfirmationShown: v.optional(v.boolean()),
    voiceConfirmed: v.optional(v.boolean()),
    voiceCorrectionApplied: v.optional(v.boolean()),
    voiceIntentConfidence: v.optional(v.number()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.insert("whatsappDeliveryLogs", {
      ...args,
      createdAt: Date.now(),
    });
    return null;
  },
});

const VOICE_CONFIRM_TTL_MS = 10 * 60 * 1000;

export const getVoiceConfirmationByUser = internalQuery({
  args: { userId: v.string() },
  returns: v.union(
    v.null(),
    v.object({
      _id: v.id("whatsappVoiceConfirmations"),
      transcriptText: v.string(),
      intentSummary: v.string(),
      status: v.union(
        v.literal("pending"),
        v.literal("confirmed"),
        v.literal("corrected"),
        v.literal("expired"),
        v.literal("cancelled"),
      ),
      createdAt: v.number(),
      expiresAt: v.number(),
      sourceMessageId: v.optional(v.string()),
    }),
  ),
  handler: async (ctx, { userId }) => {
    const row = await ctx.db
      .query("whatsappVoiceConfirmations")
      .withIndex("userId", (q) => q.eq("userId", userId))
      .order("desc")
      .first();
    if (!row) return null;
    if (row.status !== "pending") return null;
    if (row.expiresAt <= Date.now()) return null;
    return {
      _id: row._id,
      transcriptText: row.transcriptText,
      intentSummary: row.intentSummary,
      status: row.status,
      createdAt: row.createdAt,
      expiresAt: row.expiresAt,
      sourceMessageId: row.sourceMessageId,
    };
  },
});

export const createVoiceConfirmation = internalMutation({
  args: {
    userId: v.string(),
    transcriptText: v.string(),
    intentSummary: v.string(),
    sourceMessageId: v.optional(v.string()),
  },
  returns: v.id("whatsappVoiceConfirmations"),
  handler: async (ctx, { userId, transcriptText, intentSummary, sourceMessageId }) => {
    const now = Date.now();
    const existing = await ctx.db
      .query("whatsappVoiceConfirmations")
      .withIndex("userId", (q) => q.eq("userId", userId))
      .order("desc")
      .take(10);
    for (const row of existing) {
      if (row.status === "pending") {
        await ctx.db.patch(row._id, { status: "cancelled" });
      }
    }
    return await ctx.db.insert("whatsappVoiceConfirmations", {
      userId,
      transcriptText,
      intentSummary,
      status: "pending",
      createdAt: now,
      expiresAt: now + VOICE_CONFIRM_TTL_MS,
      sourceMessageId,
    });
  },
});

export const resolveVoiceConfirmation = internalMutation({
  args: {
    id: v.id("whatsappVoiceConfirmations"),
    resolution: v.union(v.literal("confirmed"), v.literal("corrected"), v.literal("cancelled")),
    correctedText: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, { id, resolution, correctedText }) => {
    const patch: Record<string, unknown> = { status: resolution, confirmedAt: Date.now() };
    if (resolution === "corrected" && correctedText?.trim()) {
      patch.correctedText = correctedText.trim();
    }
    await ctx.db.patch(id, patch);
    return null;
  },
});
