/**
 * Handoff and sales order tools.
 */
import { createTool } from "@convex-dev/agent";
import { toonEncode } from "../../../lib/toon";
import { buildSalesSummaryFields } from "../../../domain/order";
import { z } from "zod";
import type { Id } from "../../../_generated/dataModel";
import type { AgentToolsApi } from "./types";

export function createHandoffTools(appApi: AgentToolsApi) {
  const requestHumanHandoff = createTool({
    description:
      "When user is ready to proceed (buy/sell) and wants human contact. Call when user says they want to proceed, complete the sale, or speak to someone.",
    args: z.object({
      intent: z.enum(["ready_to_buy", "ready_to_sell", "other"]).describe("User intent"),
      aiHandoffReason: z
        .string()
        .optional()
        .describe("Why this user should be handed to sales now"),
      customerNeedsSummary: z
        .string()
        .optional()
        .describe("Short summary of customer needs and constraints"),
      salesTalkingPoints: z
        .string()
        .optional()
        .describe("What sales team should discuss with this customer"),
      recommendationSummary: z
        .string()
        .optional()
        .describe("Summary of recommendations already shared with the user"),
    }),
    handler: async (
      ctx,
      { intent, aiHandoffReason, customerNeedsSummary, salesTalkingPoints, recommendationSummary }
    ) => {
      const userId = (ctx as { userId?: string }).userId;
      const threadId = (ctx as { threadId?: string }).threadId;
      if (!userId) return toonEncode({ error: "No userId in context" });
      const summary = buildSalesSummaryFields({
        intent,
        aiHandoffReason,
        customerNeedsSummary,
        salesTalkingPoints,
        recommendationSummary,
      });
      await ctx.runMutation(appApi.handoffs.create, {
        userId,
        intent,
        aiHandoffReason: summary.aiHandoffReason,
        customerNeedsSummary: summary.customerNeedsSummary,
        salesTalkingPoints: summary.salesTalkingPoints,
        recommendationSummary: summary.recommendationSummary,
        threadId,
      });
      return toonEncode({
        success: true,
        message: "We'll connect you with a human agent shortly to complete your request.",
      });
    },
  });

  const createSalesOrderDraft = createTool({
    description:
      "Create or update a sales draft order when user intent is qualified with confidence. Use for buy/sell/loan intent so sales can continue the journey.",
    args: z.object({
      type: z.enum(["property", "loan"]),
      confidenceScore: z
        .number()
        .min(0)
        .max(1)
        .describe("Intent confidence score between 0 and 1"),
      intent: z.string().optional(),
      notes: z.string().optional(),
      sourceChannel: z.enum(["whatsapp", "app", "web"]).optional(),
      serviceCategory: z
        .enum([
          "buy_property",
          "sell_property",
          "property_financing",
          "loan_consultation",
          "other",
        ])
        .optional(),
      recommendationSource: z.enum(["internal_db", "web_fallback", "mixed"]).optional(),
      recommendationSummary: z.string().optional(),
      aiHandoffReason: z.string().optional(),
      customerNeedsSummary: z.string().optional(),
      salesTalkingPoints: z.string().optional(),
      propertyId: z.string().optional(),
      bankId: z.string().optional(),
      bankProductId: z.string().optional(),
      partnerId: z.string().optional(),
    }),
    handler: async (ctx, args) => {
      const userId = (ctx as { userId?: string }).userId;
      const threadId = (ctx as { threadId?: string }).threadId;
      if (!userId) return toonEncode({ error: "No userId in context" });
      const profile = await ctx.runQuery(appApi.userProfiles.getByUserId, { userId });
      const contextChannel = (ctx as { channel?: "whatsapp" | "app" | "web" }).channel;
      const summary = buildSalesSummaryFields({
        intent: args.intent,
        type: args.type,
        serviceCategory: args.serviceCategory,
        aiHandoffReason: args.aiHandoffReason,
        customerNeedsSummary: args.customerNeedsSummary,
        salesTalkingPoints: args.salesTalkingPoints,
        recommendationSummary: args.recommendationSummary,
      });
      const result = await ctx.runMutation(appApi.orders.createDraftFromAgent, {
        userId,
        type: args.type,
        confidenceScore: args.confidenceScore,
        intent: args.intent,
        notes: args.notes,
        sourceChannel: args.sourceChannel ?? contextChannel,
        serviceCategory: args.serviceCategory,
        recommendationSource: args.recommendationSource,
        recommendationSummary: summary.recommendationSummary,
        aiHandoffReason: summary.aiHandoffReason,
        customerNeedsSummary: summary.customerNeedsSummary,
        salesTalkingPoints: summary.salesTalkingPoints,
        userNameSnapshot: profile?.name,
        userPhoneSnapshot: profile?.phone,
        budgetSnapshot: profile?.maxBudget,
        preferredLocationSnapshot: profile?.preferredLocation,
        propertyId: args.propertyId as Id<"properties"> | undefined,
        bankId: args.bankId as Id<"banks"> | undefined,
        bankProductId: args.bankProductId as Id<"bankProducts"> | undefined,
        partnerId: args.partnerId as Id<"partners"> | undefined,
        threadId,
      });
      return toonEncode(result);
    },
  });

  return { requestHumanHandoff, createSalesOrderDraft };
}
