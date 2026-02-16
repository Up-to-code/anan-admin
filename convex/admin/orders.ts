/**
 * Admin orders - list, get, create, update, remove.
 */

import { mutation, query } from "../_generated/server";
import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { internal } from "../_generated/api";
import { requireAdmin } from "../lib/auth";
import {
  buildSalesSummaryFields,
  extractTopics,
  inferReasonCategory,
  isValidStatusTransition,
  orderPriorityValidator,
  orderRecommendationSourceValidator,
  orderServiceCategoryValidator,
  orderSourceChannelValidator,
  orderStatusValidator,
  orderTypeValidator,
} from "../domain/order";

type OrderDoc = Doc<"orders">;
type ConversationReasonDoc = Doc<"conversationReasons">;

async function getProfileByUserId(ctx: QueryCtx | MutationCtx, userId: string) {
  return ctx.db
    .query("userProfiles")
    .withIndex("userId", (q) => q.eq("userId", userId))
    .first();
}

function isClosed(status: OrderDoc["status"]) {
  return status === "closed_won" || status === "closed_lost";
}

function toArabicReasonLabel(category: string): string {
  switch (category) {
    case "buy_property":
      return "يرغب بشراء عقار";
    case "sell_property":
      return "يرغب ببيع عقار";
    case "property_search":
      return "يرغب بالبحث عن عقار";
    case "property_financing":
      return "يرغب بتمويل عقاري";
    case "loan_consultation":
      return "يرغب باستشارة قرض";
    default:
      return "سبب مبيعات عام";
  }
}

function toArabicNextAction(summary: string, talkingPoints: string): string {
  const action = talkingPoints.trim() || summary.trim();
  return action ? `الخطوة التالية: ${action}` : "الخطوة التالية: التواصل مع العميل وتأكيد الاحتياج.";
}

async function listReasonsForOrder(
  ctx: QueryCtx | MutationCtx,
  order: OrderDoc
): Promise<ConversationReasonDoc[]> {
  if (order.threadId) {
    return ctx.db
      .query("conversationReasons")
      .withIndex("threadId", (q) => q.eq("threadId", order.threadId!))
      .order("desc")
      .take(8);
  }
  return ctx.db
    .query("conversationReasons")
    .withIndex("userId", (q) => q.eq("userId", order.userId))
    .order("desc")
    .take(8);
}

async function enrichOrder(ctx: QueryCtx | MutationCtx, order: OrderDoc) {
  const [profile, property, bank, partner, bankProduct, reasons] = await Promise.all([
    getProfileByUserId(ctx, order.userId),
    order.propertyId ? ctx.db.get(order.propertyId) : Promise.resolve(null),
    order.bankId ? ctx.db.get(order.bankId) : Promise.resolve(null),
    order.partnerId ? ctx.db.get(order.partnerId) : Promise.resolve(null),
    order.bankProductId ? ctx.db.get(order.bankProductId) : Promise.resolve(null),
    listReasonsForOrder(ctx, order),
  ]);
  const ageHours = Math.max(1, Math.floor((Date.now() - order._creationTime) / (60 * 60 * 1000)));
  return {
    ...order,
    userName: order.userNameSnapshot ?? profile?.name ?? null,
    userPhone: order.userPhoneSnapshot ?? profile?.phone ?? null,
    budget: order.budgetSnapshot ?? profile?.maxBudget ?? null,
    preferredLocation: order.preferredLocationSnapshot ?? profile?.preferredLocation ?? null,
    source: order.sourceChannel ?? profile?.source ?? null,
    propertyTitle: property?.title ?? null,
    bankName: bank?.name ?? null,
    bankProductName: bankProduct?.name ?? null,
    partnerName: partner?.name ?? null,
    reasons,
    latestReason: reasons[0] ?? null,
    ageHours,
    isStale: !isClosed(order.status) && ageHours >= 48,
  };
}

async function createConversationReason(
  ctx: MutationCtx,
  input: {
    userId: string;
    threadId?: string;
    orderId?: Id<"orders">;
    handoffId?: Id<"humanHandoffs">;
    type?: OrderDoc["type"];
    serviceCategory?: OrderDoc["serviceCategory"];
    intent?: string;
    recommendationSource?: OrderDoc["recommendationSource"];
    summary: ReturnType<typeof buildSalesSummaryFields>;
    propertyId?: Id<"properties">;
    bankId?: Id<"banks">;
    bankProductId?: Id<"bankProducts">;
  }
) {
  const reasonCategory = inferReasonCategory({
    type: input.type,
    serviceCategory: input.serviceCategory ?? undefined,
    intent: input.intent,
  });
  const discussedTopics = extractTopics({
    intent: input.intent,
    customerNeedsSummary: input.summary.customerNeedsSummary,
    salesTalkingPoints: input.summary.salesTalkingPoints,
  });
  await ctx.db.insert("conversationReasons", {
    userId: input.userId,
    threadId: input.threadId,
    orderId: input.orderId,
    handoffId: input.handoffId,
    reasonCategory,
    intent: input.intent,
    summaryArabic: `${toArabicReasonLabel(reasonCategory)}. ${input.summary.customerNeedsSummary}`,
    nextActionArabic: toArabicNextAction(
      input.summary.recommendationSummary,
      input.summary.salesTalkingPoints
    ),
    discussedTopics,
    propertyId: input.propertyId,
    bankId: input.bankId,
    bankProductId: input.bankProductId,
    recommendationSource: input.recommendationSource,
    recommendationSummary: input.summary.recommendationSummary,
  });
}

async function emitOrderSignals(
  ctx: MutationCtx,
  order: OrderDoc,
  event: "order_created" | "order_status_changed",
  metadata?: Record<string, unknown>
) {
  if (event === "order_created") {
    await ctx.db.insert("userActivity", {
      userId: order.userId,
      action: "order_created",
      channel: order.sourceChannel,
      metadata: {
        orderId: order._id,
        type: order.type,
        status: order.status,
        ...metadata,
      },
    });
  }

  await ctx.runMutation(internal.services.notifications.createSalesNotification, {
    userId: order.assignedTo ?? "sales-team",
    title: event === "order_created" ? "New sales order created" : "Order status updated",
    body:
      event === "order_created"
        ? `Order for user ${order.userId} is ready for sales follow-up.`
        : `Order ${order._id} changed status to ${order.status}.`,
    type: "sales_order",
    linkId: String(order._id),
    audience: "sales",
    entityType: "order",
    entityId: String(order._id),
    priority: order.priority ?? "medium",
    actionRequired: !isClosed(order.status),
    status: "new",
    metadata: {
      orderId: order._id,
      userId: order.userId,
      status: order.status,
      threadId: order.threadId,
      reasonCategory: inferReasonCategory({
        type: order.type,
        serviceCategory: order.serviceCategory,
        intent: order.intent,
      }),
      aiHandoffReason: order.aiHandoffReason,
      customerNeedsSummary: order.customerNeedsSummary,
      salesTalkingPoints: order.salesTalkingPoints,
      recommendationSummary: order.recommendationSummary,
      ...metadata,
    },
  });
}

export const listOrders = query({
  args: {
    limit: v.optional(v.number()),
    status: v.optional(orderStatusValidator),
    type: v.optional(orderTypeValidator),
    assignedTo: v.optional(v.string()),
  },
  handler: async (ctx, { limit = 50, status, type, assignedTo }) => {
    await requireAdmin(ctx);
    let orders = await ctx.db.query("orders").order("desc").take(limit);
    if (status) orders = orders.filter((o) => o.status === status);
    if (type) orders = orders.filter((o) => o.type === type);
    if (assignedTo) orders = orders.filter((o) => o.assignedTo === assignedTo);
    return Promise.all(orders.map((o) => enrichOrder(ctx, o)));
  },
});

export const ordersList = query({
  args: {
    paginationOpts: paginationOptsValidator,
    status: v.optional(orderStatusValidator),
    type: v.optional(orderTypeValidator),
    assignedTo: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    let q;
    if (args.status) {
      q = ctx.db
        .query("orders")
        .withIndex("status", (q) => q.eq("status", args.status!));
    } else if (args.type) {
      q = ctx.db
        .query("orders")
        .withIndex("type", (q) => q.eq("type", args.type!));
    } else if (args.assignedTo) {
      q = ctx.db
        .query("orders")
        .withIndex("assignedTo", (q) => q.eq("assignedTo", args.assignedTo!));
    } else {
      q = ctx.db.query("orders").order("desc");
    }
    const result = await q.paginate(args.paginationOpts);
    let page = result.page;
    if (args.status) page = page.filter((o) => o.status === args.status);
    if (args.type) page = page.filter((o) => o.type === args.type);
    if (args.assignedTo) page = page.filter((o) => o.assignedTo === args.assignedTo);
    return {
      ...result,
      page: await Promise.all(page.map((o) => enrichOrder(ctx, o))),
    };
  },
});

export const ordersForUser = query({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) => {
    await requireAdmin(ctx);
    return ctx.db
      .query("orders")
      .withIndex("userId", (q) => q.eq("userId", userId))
      .collect();
  },
});

export const ordersForProperty = query({
  args: { propertyId: v.id("properties") },
  handler: async (ctx, { propertyId }) => {
    await requireAdmin(ctx);
    return ctx.db
      .query("orders")
      .withIndex("propertyId", (q) => q.eq("propertyId", propertyId))
      .collect();
  },
});

export const ordersForBank = query({
  args: { bankId: v.id("banks") },
  handler: async (ctx, { bankId }) => {
    await requireAdmin(ctx);
    return ctx.db
      .query("orders")
      .withIndex("bankId", (q) => q.eq("bankId", bankId))
      .collect();
  },
});

export const orderGet = query({
  args: { id: v.id("orders") },
  handler: async (ctx, { id }) => {
    await requireAdmin(ctx);
    const order = await ctx.db.get(id);
    if (!order) return null;
    return enrichOrder(ctx, order);
  },
});

/** Alias for admin UI (accepts orderId). */
export const getOrder = query({
  args: { orderId: v.id("orders") },
  handler: async (ctx, { orderId }) => {
    await requireAdmin(ctx);
    const order = await ctx.db.get(orderId);
    if (!order) return null;
    const enriched = await enrichOrder(ctx, order);
    const [profile, property, bank, bankProduct] = await Promise.all([
      getProfileByUserId(ctx, order.userId),
      order.propertyId ? ctx.db.get(order.propertyId) : Promise.resolve(null),
      order.bankId ? ctx.db.get(order.bankId) : Promise.resolve(null),
      order.bankProductId ? ctx.db.get(order.bankProductId) : Promise.resolve(null),
    ]);
    return {
      ...enriched,
      profile,
      property,
      bank,
      bankProduct,
    };
  },
});

export const pipelineSummary = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const orders = await ctx.db.query("orders").collect();
    const stageCounts = {
      new_lead: 0,
      contacted: 0,
      qualified: 0,
      offer_made: 0,
      under_contract: 0,
      closed_won: 0,
      closed_lost: 0,
    } as Record<OrderDoc["status"], number>;
    let stale = 0;
    let unassigned = 0;
    for (const order of orders) {
      stageCounts[order.status] += 1;
      if (!order.assignedTo) unassigned += 1;
      if (!isClosed(order.status) && Date.now() - order._creationTime >= 48 * 60 * 60 * 1000) {
        stale += 1;
      }
    }
    const started = orders.length - stageCounts.new_lead;
    const conversionRate = started > 0 ? stageCounts.closed_won / started : 0;
    return {
      total: orders.length,
      stale,
      unassigned,
      stageCounts,
      conversionRate,
    };
  },
});

export const pipelineBoard = query({
  args: { limitPerStage: v.optional(v.number()) },
  handler: async (ctx, { limitPerStage = 30 }) => {
    await requireAdmin(ctx);
    const orders = await ctx.db.query("orders").order("desc").take(500);
    const enriched = await Promise.all(orders.map((o) => enrichOrder(ctx, o)));
    const statuses: OrderDoc["status"][] = [
      "new_lead",
      "contacted",
      "qualified",
      "offer_made",
      "under_contract",
      "closed_won",
      "closed_lost",
    ];
    return statuses.map((status) => ({
      status,
      items: enriched.filter((o) => o.status === status).slice(0, limitPerStage),
    }));
  },
});

export const orderCreate = mutation({
  args: {
    userId: v.string(),
    type: orderTypeValidator,
    status: v.optional(orderStatusValidator),
    propertyId: v.optional(v.id("properties")),
    bankId: v.optional(v.id("banks")),
    partnerId: v.optional(v.id("partners")),
    bankProductId: v.optional(v.id("bankProducts")),
    intent: v.optional(v.string()),
    notes: v.optional(v.string()),
    userNameSnapshot: v.optional(v.string()),
    userPhoneSnapshot: v.optional(v.string()),
    budgetSnapshot: v.optional(v.number()),
    preferredLocationSnapshot: v.optional(v.string()),
    sourceChannel: v.optional(orderSourceChannelValidator),
    confidenceScore: v.optional(v.number()),
    serviceCategory: v.optional(orderServiceCategoryValidator),
    recommendationSource: v.optional(orderRecommendationSourceValidator),
    recommendationSummary: v.optional(v.string()),
    aiHandoffReason: v.optional(v.string()),
    customerNeedsSummary: v.optional(v.string()),
    salesTalkingPoints: v.optional(v.string()),
    recommendedPropertyIds: v.optional(v.array(v.id("properties"))),
    recommendedBankProductIds: v.optional(v.array(v.id("bankProducts"))),
    assignedTo: v.optional(v.string()),
    priority: v.optional(orderPriorityValidator),
    nextAction: v.optional(v.string()),
    nextActionAt: v.optional(v.number()),
    handoffId: v.optional(v.id("humanHandoffs")),
    threadId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const summary = buildSalesSummaryFields({
      intent: args.intent,
      type: args.type,
      serviceCategory: args.serviceCategory,
      aiHandoffReason: args.aiHandoffReason,
      customerNeedsSummary: args.customerNeedsSummary,
      salesTalkingPoints: args.salesTalkingPoints,
      recommendationSummary: args.recommendationSummary,
    });
    const orderId = await ctx.db.insert("orders", {
      userId: args.userId,
      type: args.type,
      status: args.status ?? "new_lead",
      propertyId: args.propertyId,
      bankId: args.bankId,
      partnerId: args.partnerId,
      bankProductId: args.bankProductId,
      intent: args.intent,
      notes: args.notes,
      userNameSnapshot: args.userNameSnapshot,
      userPhoneSnapshot: args.userPhoneSnapshot,
      budgetSnapshot: args.budgetSnapshot,
      preferredLocationSnapshot: args.preferredLocationSnapshot,
      sourceChannel: args.sourceChannel,
      confidenceScore: args.confidenceScore,
      serviceCategory: args.serviceCategory,
      recommendationSource: args.recommendationSource,
      recommendationSummary: summary.recommendationSummary,
      aiHandoffReason: summary.aiHandoffReason,
      customerNeedsSummary: summary.customerNeedsSummary,
      salesTalkingPoints: summary.salesTalkingPoints,
      recommendedPropertyIds: args.recommendedPropertyIds,
      recommendedBankProductIds: args.recommendedBankProductIds,
      assignedTo: args.assignedTo,
      priority: args.priority ?? "medium",
      nextAction: args.nextAction,
      nextActionAt: args.nextActionAt,
      handoffId: args.handoffId,
      threadId: args.threadId,
    });
    await createConversationReason(ctx, {
      userId: args.userId,
      threadId: args.threadId,
      orderId,
      handoffId: args.handoffId,
      type: args.type,
      serviceCategory: args.serviceCategory,
      intent: args.intent,
      recommendationSource: args.recommendationSource,
      summary,
      propertyId: args.propertyId,
      bankId: args.bankId,
      bankProductId: args.bankProductId,
    });
    const order = await ctx.db.get(orderId);
    if (order) {
      await emitOrderSignals(ctx, order, "order_created", { createdBy: "admin" });
    }
    return orderId;
  },
});

export const orderUpdate = mutation({
  args: {
    id: v.id("orders"),
    status: v.optional(orderStatusValidator),
    notes: v.optional(v.string()),
    intent: v.optional(v.string()),
    propertyId: v.optional(v.id("properties")),
    bankId: v.optional(v.id("banks")),
    partnerId: v.optional(v.id("partners")),
    bankProductId: v.optional(v.id("bankProducts")),
    assignedTo: v.optional(v.string()),
    priority: v.optional(orderPriorityValidator),
    nextAction: v.optional(v.string()),
    nextActionAt: v.optional(v.number()),
    recommendationSummary: v.optional(v.string()),
    recommendationSource: v.optional(orderRecommendationSourceValidator),
    aiHandoffReason: v.optional(v.string()),
    customerNeedsSummary: v.optional(v.string()),
    salesTalkingPoints: v.optional(v.string()),
    threadId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const { id, ...updates } = args;
    const doc = await ctx.db.get(id);
    if (!doc) throw new Error("Order not found");
    if (updates.status && updates.status !== doc.status) {
      if (!isValidStatusTransition(doc.status, updates.status)) {
        throw new Error(`Invalid status transition from ${doc.status} to ${updates.status}`);
      }
    }
    const patch: Record<string, unknown> = {};
    if (updates.status !== undefined) patch.status = updates.status;
    if (updates.notes !== undefined) patch.notes = updates.notes;
    if (updates.intent !== undefined) patch.intent = updates.intent;
    if (updates.propertyId !== undefined) patch.propertyId = updates.propertyId;
    if (updates.bankId !== undefined) patch.bankId = updates.bankId;
    if (updates.partnerId !== undefined) patch.partnerId = updates.partnerId;
    if (updates.bankProductId !== undefined) patch.bankProductId = updates.bankProductId;
    if (updates.assignedTo !== undefined) patch.assignedTo = updates.assignedTo;
    if (updates.priority !== undefined) patch.priority = updates.priority;
    if (updates.nextAction !== undefined) patch.nextAction = updates.nextAction;
    if (updates.nextActionAt !== undefined) patch.nextActionAt = updates.nextActionAt;
    if (updates.recommendationSummary !== undefined) patch.recommendationSummary = updates.recommendationSummary;
    if (updates.recommendationSource !== undefined) patch.recommendationSource = updates.recommendationSource;
    if (updates.aiHandoffReason !== undefined) patch.aiHandoffReason = updates.aiHandoffReason;
    if (updates.customerNeedsSummary !== undefined)
      patch.customerNeedsSummary = updates.customerNeedsSummary;
    if (updates.salesTalkingPoints !== undefined)
      patch.salesTalkingPoints = updates.salesTalkingPoints;
    if (updates.threadId !== undefined) patch.threadId = updates.threadId;
    if (Object.keys(patch).length > 0) await ctx.db.patch(id, patch);
    const updated = await ctx.db.get(id);
    if (updated && updates.status && updates.status !== doc.status) {
      await emitOrderSignals(ctx, updated, "order_status_changed", {
        previousStatus: doc.status,
        nextStatus: updates.status,
      });
    }
    return null;
  },
});

/**
 * Agent-facing draft order creation.
 * Creates a sales draft when intent confidence is high enough.
 */
export const createDraftOrderFromAgent = mutation({
  args: {
    userId: v.string(),
    type: orderTypeValidator,
    confidenceScore: v.number(),
    intent: v.optional(v.string()),
    notes: v.optional(v.string()),
    sourceChannel: v.optional(orderSourceChannelValidator),
    serviceCategory: v.optional(orderServiceCategoryValidator),
    recommendationSource: v.optional(orderRecommendationSourceValidator),
    recommendationSummary: v.optional(v.string()),
    aiHandoffReason: v.optional(v.string()),
    customerNeedsSummary: v.optional(v.string()),
    salesTalkingPoints: v.optional(v.string()),
    userNameSnapshot: v.optional(v.string()),
    userPhoneSnapshot: v.optional(v.string()),
    budgetSnapshot: v.optional(v.number()),
    preferredLocationSnapshot: v.optional(v.string()),
    propertyId: v.optional(v.id("properties")),
    bankId: v.optional(v.id("banks")),
    bankProductId: v.optional(v.id("bankProducts")),
    partnerId: v.optional(v.id("partners")),
    recommendedPropertyIds: v.optional(v.array(v.id("properties"))),
    recommendedBankProductIds: v.optional(v.array(v.id("bankProducts"))),
    handoffId: v.optional(v.id("humanHandoffs")),
    threadId: v.optional(v.string()),
  },
  returns: v.object({
    created: v.boolean(),
    orderId: v.optional(v.id("orders")),
    reason: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    if (args.confidenceScore < 0.55) {
      return { created: false, reason: "confidence_too_low" };
    }
    const summary = buildSalesSummaryFields({
      intent: args.intent,
      type: args.type,
      serviceCategory: args.serviceCategory,
      aiHandoffReason: args.aiHandoffReason,
      customerNeedsSummary: args.customerNeedsSummary,
      salesTalkingPoints: args.salesTalkingPoints,
      recommendationSummary: args.recommendationSummary,
    });

    const reasonCategory = inferReasonCategory({
      type: args.type,
      serviceCategory: args.serviceCategory,
      intent: args.intent,
    });
    const existing = (
      await ctx.db
        .query("orders")
        .withIndex("userId", (q) => q.eq("userId", args.userId))
        .collect()
    ).find(
      (o) =>
        !isClosed(o.status) &&
        inferReasonCategory({
          type: o.type,
          serviceCategory: o.serviceCategory,
          intent: o.intent,
        }) === reasonCategory
    );

    if (existing) {
      await ctx.db.patch(existing._id, {
        type: args.type,
        intent: args.intent ?? existing.intent,
        notes: args.notes ?? existing.notes,
        sourceChannel: args.sourceChannel ?? existing.sourceChannel,
        confidenceScore: Math.max(existing.confidenceScore ?? 0, args.confidenceScore),
        serviceCategory: args.serviceCategory ?? existing.serviceCategory,
        recommendationSource: args.recommendationSource ?? existing.recommendationSource,
        recommendationSummary: summary.recommendationSummary ?? existing.recommendationSummary,
        aiHandoffReason: summary.aiHandoffReason ?? existing.aiHandoffReason,
        customerNeedsSummary: summary.customerNeedsSummary ?? existing.customerNeedsSummary,
        salesTalkingPoints: summary.salesTalkingPoints ?? existing.salesTalkingPoints,
        userNameSnapshot: args.userNameSnapshot ?? existing.userNameSnapshot,
        userPhoneSnapshot: args.userPhoneSnapshot ?? existing.userPhoneSnapshot,
        budgetSnapshot: args.budgetSnapshot ?? existing.budgetSnapshot,
        preferredLocationSnapshot:
          args.preferredLocationSnapshot ?? existing.preferredLocationSnapshot,
        propertyId: args.propertyId ?? existing.propertyId,
        bankId: args.bankId ?? existing.bankId,
        bankProductId: args.bankProductId ?? existing.bankProductId,
        partnerId: args.partnerId ?? existing.partnerId,
        recommendedPropertyIds:
          args.recommendedPropertyIds ?? existing.recommendedPropertyIds,
        recommendedBankProductIds:
          args.recommendedBankProductIds ?? existing.recommendedBankProductIds,
        handoffId: args.handoffId ?? existing.handoffId,
        threadId: args.threadId ?? existing.threadId,
      });
      await createConversationReason(ctx, {
        userId: args.userId,
        threadId: args.threadId ?? existing.threadId,
        orderId: existing._id,
        handoffId: args.handoffId ?? existing.handoffId,
        type: args.type,
        serviceCategory: args.serviceCategory ?? existing.serviceCategory,
        intent: args.intent ?? existing.intent,
        recommendationSource: args.recommendationSource ?? existing.recommendationSource,
        summary,
        propertyId: args.propertyId ?? existing.propertyId,
        bankId: args.bankId ?? existing.bankId,
        bankProductId: args.bankProductId ?? existing.bankProductId,
      });
      return { created: false, orderId: existing._id, reason: "reused_existing_open_order" };
    }

    const priority =
      args.confidenceScore >= 0.9
        ? "urgent"
        : args.confidenceScore >= 0.75
          ? "high"
          : "medium";
    const orderId = await ctx.db.insert("orders", {
      userId: args.userId,
      type: args.type,
      status: "new_lead",
      intent: args.intent,
      notes: args.notes,
      sourceChannel: args.sourceChannel,
      confidenceScore: args.confidenceScore,
      serviceCategory: args.serviceCategory,
      recommendationSource: args.recommendationSource,
      recommendationSummary: summary.recommendationSummary,
      aiHandoffReason: summary.aiHandoffReason,
      customerNeedsSummary: summary.customerNeedsSummary,
      salesTalkingPoints: summary.salesTalkingPoints,
      userNameSnapshot: args.userNameSnapshot,
      userPhoneSnapshot: args.userPhoneSnapshot,
      budgetSnapshot: args.budgetSnapshot,
      preferredLocationSnapshot: args.preferredLocationSnapshot,
      propertyId: args.propertyId,
      bankId: args.bankId,
      bankProductId: args.bankProductId,
      partnerId: args.partnerId,
      recommendedPropertyIds: args.recommendedPropertyIds,
      recommendedBankProductIds: args.recommendedBankProductIds,
      handoffId: args.handoffId,
      threadId: args.threadId,
      priority,
    });
    await createConversationReason(ctx, {
      userId: args.userId,
      threadId: args.threadId,
      orderId,
      handoffId: args.handoffId,
      type: args.type,
      serviceCategory: args.serviceCategory,
      intent: args.intent,
      recommendationSource: args.recommendationSource,
      summary,
      propertyId: args.propertyId,
      bankId: args.bankId,
      bankProductId: args.bankProductId,
    });
    const order = await ctx.db.get(orderId);
    if (order) {
      await emitOrderSignals(ctx, order, "order_created", {
        createdBy: "agent",
        confidenceScore: args.confidenceScore,
      });
    }
    return { created: true, orderId };
  },
});

export const conversationReasonsForUser = query({
  args: { userId: v.string(), limit: v.optional(v.number()) },
  handler: async (ctx, { userId, limit = 20 }) => {
    await requireAdmin(ctx);
    return ctx.db
      .query("conversationReasons")
      .withIndex("userId", (q) => q.eq("userId", userId))
      .order("desc")
      .take(limit);
  },
});

export const conversationReasonsForOrder = query({
  args: { orderId: v.id("orders"), limit: v.optional(v.number()) },
  handler: async (ctx, { orderId, limit = 20 }) => {
    await requireAdmin(ctx);
    const order = await ctx.db.get(orderId);
    if (!order) return [];
    if (order.threadId) {
      return ctx.db
        .query("conversationReasons")
        .withIndex("threadId", (q) => q.eq("threadId", order.threadId!))
        .order("desc")
        .take(limit);
    }
    return ctx.db
      .query("conversationReasons")
      .withIndex("userId", (q) => q.eq("userId", order.userId))
      .order("desc")
      .take(limit);
  },
});

export const orderRemove = mutation({
  args: { id: v.id("orders") },
  handler: async (ctx, { id }) => {
    await requireAdmin(ctx);
    await ctx.db.delete(id);
    return null;
  },
});
