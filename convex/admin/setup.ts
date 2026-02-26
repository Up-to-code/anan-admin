/**
 * Admin setup - first admin, isAdmin check, admin profile, conversations.
 */

import { mutation, query } from "../_generated/server";
import { ConvexError, v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { api } from "../_generated/api";
import {
  requireAuth,
  requireAdmin,
  isAdmin as checkIsAdmin,
} from "../lib/auth";

export const addFirstAdmin = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await requireAuth(ctx);
    const existing = await ctx.db.query("adminUsers").first();
    if (existing) {
      throw new Error(
        'Admin list already has members. Ask an existing admin to run: npx convex run seed:addAdmin \'{"userId":"YOUR_USER_ID"}\'',
      );
    }
    await ctx.db.insert("adminUsers", { userId });
    return { ok: true };
  },
});

export const isAdmin = query({
  args: {},
  returns: v.union(v.boolean(), v.null()),
  handler: async (ctx) => {
    try {
      const result = await checkIsAdmin(ctx);
      return result;
    } catch (e: any) {
      // Handle various auth error formats
      if (e instanceof ConvexError) {
        // Unauthenticated or auth errors
        if (
          e.data === "Unauthenticated" ||
          e.data?.code === "AUTH_ERROR" ||
          e.data?.message?.includes("Authentication")
        ) {
          return null;
        }
      }
      // Any other error means not admin
      return false;
    }
  },
});

export const adminProfileGet = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireAdmin(ctx);
    const profile = await ctx.db
      .query("adminProfiles")
      .withIndex("userId", (q) => q.eq("userId", userId))
      .first();
    return profile ?? { userId, avatarStorageId: undefined as undefined };
  },
});

export const adminProfileSetAvatar = mutation({
  args: { avatarStorageId: v.optional(v.id("_storage")) },
  handler: async (ctx, { avatarStorageId }) => {
    const userId = await requireAdmin(ctx);
    const existing = await ctx.db
      .query("adminProfiles")
      .withIndex("userId", (q) => q.eq("userId", userId))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, { avatarStorageId });
    } else {
      await ctx.db.insert("adminProfiles", { userId, avatarStorageId });
    }
    return null;
  },
});

export const conversationsListThreads = query({
  args: {
    userId: v.optional(v.string()),
    paginationOpts: paginationOptsValidator,
  },
  returns: v.any(),
  handler: async (ctx, args): Promise<unknown> => {
    await requireAdmin(ctx);
    return ctx.runQuery(api.agents.actions.listThreads, {
      userId: args.userId,
      paginationOpts: args.paginationOpts,
    });
  },
});

export const conversationsListUsersWithThreads = query({
  args: { paginationOpts: paginationOptsValidator },
  returns: v.any(),
  handler: async (ctx, args): Promise<unknown> => {
    await requireAdmin(ctx);
    return ctx.runQuery(api.agents.actions.listUsersWithThreads, {
      paginationOpts: args.paginationOpts,
    });
  },
});

export const conversationsGetThreadMessages = query({
  args: {
    threadId: v.string(),
    paginationOpts: paginationOptsValidator,
  },
  returns: v.any(),
  handler: async (ctx, args): Promise<unknown> => {
    await requireAdmin(ctx);
    return ctx.runQuery(api.agents.actions.getThreadMessages, {
      threadId: args.threadId,
      paginationOpts: args.paginationOpts,
      allowAdmin: true,
    });
  },
});

export const conversationsGetThreadTraces = query({
  args: {
    threadId: v.string(),
    limit: v.optional(v.number()),
  },
  returns: v.any(),
  handler: async (ctx, { threadId, limit = 20 }): Promise<unknown> => {
    await requireAdmin(ctx);
    return await ctx.db
      .query("agentTraces")
      .withIndex("threadId", (q) => q.eq("threadId", threadId))
      .order("desc")
      .take(Math.max(1, Math.min(limit, 100)));
  },
});
