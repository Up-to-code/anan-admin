/**
 * Agent usage persistence – internal mutation to store AI token usage for dashboard analytics.
 */

import { internalMutation } from "../_generated/server";
import { v } from "convex/values";

export const insertAgentUsage = internalMutation({
  args: {
    userId: v.optional(v.string()),
    threadId: v.optional(v.string()),
    model: v.string(),
    provider: v.string(),
    promptTokens: v.number(),
    completionTokens: v.number(),
    totalTokens: v.number(),
    cachedInputTokens: v.optional(v.number()),
    reasoningTokens: v.optional(v.number()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.insert("aiTokenUsage", {
      userId: args.userId,
      threadId: args.threadId,
      model: args.model,
      provider: args.provider,
      promptTokens: args.promptTokens,
      completionTokens: args.completionTokens,
      totalTokens: args.totalTokens,
      cachedInputTokens: args.cachedInputTokens,
      reasoningTokens: args.reasoningTokens,
    });
    return null;
  },
});
