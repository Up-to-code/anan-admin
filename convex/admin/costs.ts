/**
 * Admin cost queries – AI and tool costs per user.
 */
import { query } from "../_generated/server";
import { v } from "convex/values";
import { requireAdmin } from "../lib/auth";
import { getTotalAICostsByUser, getToolCostsByUser } from "../costs";

export const getTotalAICostsByUserId = query({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) => {
    await requireAdmin(ctx);
    return getTotalAICostsByUser(ctx, userId);
  },
});

export const getToolCostsByUserId = query({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) => {
    await requireAdmin(ctx);
    return getToolCostsByUser(ctx, userId);
  },
});
