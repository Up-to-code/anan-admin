/**
 * Admin content - prompts, knowledge pages, handoffs.
 */

import { mutation, query } from "../_generated/server";
import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { api, internal } from "../_generated/api";
import { requireAdmin } from "../lib/auth";
import { buildSalesSummaryFields, extractTopics } from "../domain/order";

export const handoffsList = query({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    return ctx.db
      .query("humanHandoffs")
      .order("desc")
      .paginate(args.paginationOpts);
  },
});

export const handoffUpdateStatus = mutation({
  args: {
    handoffId: v.id("humanHandoffs"),
    status: v.string(),
  },
  handler: async (ctx, { handoffId, status }) => {
    await requireAdmin(ctx);
    const handoff = await ctx.db.get(handoffId);
    if (!handoff) throw new Error("Handoff not found");
    const summary = buildSalesSummaryFields({
      intent: handoff.intent,
      aiHandoffReason: handoff.aiHandoffReason,
      customerNeedsSummary: handoff.customerNeedsSummary,
      salesTalkingPoints: handoff.salesTalkingPoints,
      recommendationSummary: handoff.recommendationSummary,
    });
    await ctx.db.patch(handoffId, { status });
    if (status === "accepted" || status === "in_progress" || status === "qualified") {
      // @ts-ignore: Type instantiation is excessively deep and possibly infinite
      await ctx.runMutation(api.admin.orders.createDraftOrderFromAgent, {
        userId: handoff.userId,
        type: handoff.intent === "ready_to_buy" ? "property" : "loan",
        confidenceScore: 0.85,
        intent: handoff.intent,
        serviceCategory:
          handoff.intent === "ready_to_buy"
            ? "buy_property"
            : handoff.intent === "ready_to_sell"
              ? "sell_property"
              : "other",
        handoffId,
        threadId: handoff.threadId,
        notes: `Order drafted from handoff status update: ${status}`,
        aiHandoffReason: summary.aiHandoffReason,
        customerNeedsSummary: summary.customerNeedsSummary,
        salesTalkingPoints: summary.salesTalkingPoints,
        recommendationSummary: summary.recommendationSummary,
      });
    }
    // @ts-ignore: Type instantiation is excessively deep and possibly infinite
    await ctx.runMutation(internal.services.notifications.createSalesNotification, {
      userId: "sales-team",
      title: "Handoff status updated",
      body: `Handoff ${handoffId} moved to ${status}.`,
      type: "handoff_status",
      audience: "sales",
      entityType: "handoff",
      entityId: String(handoffId),
      linkId: String(handoffId),
      priority: "medium",
      actionRequired: status !== "resolved" && status !== "closed",
      status: "new",
      metadata: {
        handoffId,
        status,
        userId: handoff.userId,
        threadId: handoff.threadId,
        discussedTopics: extractTopics({
          intent: handoff.intent,
          customerNeedsSummary: summary.customerNeedsSummary,
          salesTalkingPoints: summary.salesTalkingPoints,
        }),
        aiHandoffReason: summary.aiHandoffReason,
        customerNeedsSummary: summary.customerNeedsSummary,
        salesTalkingPoints: summary.salesTalkingPoints,
        recommendationSummary: summary.recommendationSummary,
      },
    });
    return null;
  },
});

export const promptsList = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    return ctx.db.query("prompts").collect();
  },
});

export const promptUpdate = mutation({
  args: { key: v.string(), value: v.string() },
  handler: async (ctx, { key, value }) => {
    await requireAdmin(ctx);
    const existing = await ctx.db
      .query("prompts")
      .withIndex("key", (q) => q.eq("key", key))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, { value });
      return existing._id;
    }
    return await ctx.db.insert("prompts", { key, value });
  },
});

export const knowledgeList = query({
  args: { category: v.optional(v.string()) },
  returns: v.any(),
  handler: async (ctx, args): Promise<unknown> => {
    await requireAdmin(ctx);
    return ctx.runQuery(api.services.content.list, {
      category: args.category,
    });
  },
});

export const knowledgeCreate = mutation({
  args: {
    slug: v.string(),
    title: v.string(),
    content: v.string(),
    category: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const existing = await ctx.db
      .query("knowledgePages")
      .withIndex("slug", (q) => q.eq("slug", args.slug))
      .first();
    if (existing)
      throw new Error("Knowledge page with this slug already exists");
    return ctx.db.insert("knowledgePages", args);
  },
});

export const knowledgeUpdate = mutation({
  args: {
    id: v.id("knowledgePages"),
    slug: v.optional(v.string()),
    title: v.optional(v.string()),
    content: v.optional(v.string()),
    category: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const { id, ...updates } = args;
    const doc = await ctx.db.get(id);
    if (!doc) throw new Error("Knowledge page not found");
    if (Object.keys(updates).length > 0) await ctx.db.patch(id, updates);
    return null;
  },
});

export const knowledgeRemove = mutation({
  args: { id: v.id("knowledgePages") },
  handler: async (ctx, { id }) => {
    await requireAdmin(ctx);
    await ctx.db.delete(id);
    return null;
  },
});

export const knowledgeResearchList = query({
  args: {
    paginationOpts: paginationOptsValidator,
    userId: v.optional(v.string()),
  },
  returns: v.any(),
  handler: async (ctx, { paginationOpts, userId }) => {
    await requireAdmin(ctx);
    if (userId) {
      return ctx.db
        .query("knowledgeResearch")
        .withIndex("by_userId_and_createdAt", (q) => q.eq("userId", userId))
        .order("desc")
        .paginate(paginationOpts);
    }
    return ctx.db.query("knowledgeResearch").order("desc").paginate(paginationOpts);
  },
});
