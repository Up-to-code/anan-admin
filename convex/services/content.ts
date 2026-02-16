/**
 * Content service - knowledge pages, prompts, handoffs.
 */

import { mutation, query } from "../_generated/server";
import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { api, internal } from "../_generated/api";
import { buildSalesSummaryFields, extractTopics } from "../domain/order";

const PROMPT_KEYS = ["system", "realEstate", "tools"] as const;

/** Get merged instructions from prompts table. */
export const getMergedInstructions = query({
  args: {},
  handler: async (ctx) => {
    const docs = await ctx.db.query("prompts").collect();
    const byKey = Object.fromEntries(docs.map((d) => [d.key, d.value]));
    const parts = PROMPT_KEYS.map((k) => byKey[k]).filter(Boolean);
    return parts.length > 0 ? parts.join("\n\n") : null;
  },
});

/** Get knowledge page by slug. */
export const getBySlug = query({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    return ctx.db
      .query("knowledgePages")
      .withIndex("slug", (q) => q.eq("slug", slug))
      .first();
  },
});

/** List knowledge pages. */
export const list = query({
  args: { category: v.optional(v.string()) },
  handler: async (ctx, { category }) => {
    if (category) {
      return ctx.db
        .query("knowledgePages")
        .withIndex("category", (q) => q.eq("category", category))
        .collect();
    }
    return ctx.db.query("knowledgePages").collect();
  },
});

/** List handoffs. */
export const listHandoffs = query({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, { paginationOpts }) => {
    return ctx.db
      .query("humanHandoffs")
      .order("desc")
      .paginate(paginationOpts);
  },
});

/** Create handoff request. */
export const create = mutation({
  args: {
    userId: v.string(),
    intent: v.string(),
    aiHandoffReason: v.optional(v.string()),
    customerNeedsSummary: v.optional(v.string()),
    salesTalkingPoints: v.optional(v.string()),
    recommendationSummary: v.optional(v.string()),
    threadId: v.optional(v.string()),
  },
  handler: async (
    ctx,
    {
      userId,
      intent,
      aiHandoffReason,
      customerNeedsSummary,
      salesTalkingPoints,
      recommendationSummary,
      threadId,
    }
  ) => {
    const summary = buildSalesSummaryFields({
      intent,
      aiHandoffReason,
      customerNeedsSummary,
      salesTalkingPoints,
      recommendationSummary,
    });
    const handoffId = await ctx.db.insert("humanHandoffs", {
      userId,
      intent,
      status: "pending",
      aiHandoffReason: summary.aiHandoffReason,
      customerNeedsSummary: summary.customerNeedsSummary,
      salesTalkingPoints: summary.salesTalkingPoints,
      recommendationSummary: summary.recommendationSummary,
      threadId,
    });
    const type = intent === "ready_to_buy" ? "property" : "loan";
    const serviceCategory =
      intent === "ready_to_buy" ? "buy_property" : intent === "ready_to_sell" ? "sell_property" : "other";

    await ctx.runMutation(api.admin.orders.createDraftOrderFromAgent, {
      userId,
      type,
      confidenceScore: 0.8,
      intent,
      sourceChannel: "whatsapp",
      serviceCategory,
      handoffId,
      notes: "Auto-created from human handoff request.",
      threadId,
      aiHandoffReason: summary.aiHandoffReason,
      customerNeedsSummary: summary.customerNeedsSummary,
      salesTalkingPoints: summary.salesTalkingPoints,
      recommendationSummary: summary.recommendationSummary,
    });

    await ctx.runMutation(internal.services.notifications.createSalesNotification, {
      userId: "sales-team",
      title: "New human handoff request",
      body:
        summary.aiHandoffReason ??
        summary.customerNeedsSummary ??
        `A user requested human handoff with intent: ${intent}.`,
      type: "handoff",
      audience: "sales",
      entityType: "handoff",
      entityId: String(handoffId),
      linkId: String(handoffId),
      priority: "high",
      actionRequired: true,
      status: "new",
      metadata: {
        handoffId,
        userId,
        intent,
        threadId,
        discussedTopics: extractTopics({
          intent,
          customerNeedsSummary: summary.customerNeedsSummary,
          salesTalkingPoints: summary.salesTalkingPoints,
        }),
        aiHandoffReason: summary.aiHandoffReason,
        customerNeedsSummary: summary.customerNeedsSummary,
        salesTalkingPoints: summary.salesTalkingPoints,
        recommendationSummary: summary.recommendationSummary,
      },
    });

    return handoffId;
  },
});
