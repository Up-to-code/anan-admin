/**
 * Admin auth - verified phones, pending verifications, OTP requests, session tokens.
 */

import { mutation, query } from "../_generated/server";
import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { requireAdmin } from "../lib/auth";

export const verifiedPhonesList = query({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    return ctx.db
      .query("verifiedPhones")
      .order("desc")
      .paginate(args.paginationOpts);
  },
});

export const pendingVerificationsList = query({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    return ctx.db
      .query("pendingVerifications")
      .order("desc")
      .paginate(args.paginationOpts);
  },
});

export const otpRequestsList = query({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    return ctx.db
      .query("otpRequests")
      .order("desc")
      .paginate(args.paginationOpts);
  },
});

export const sessionTokensList = query({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    return ctx.db
      .query("sessionTokens")
      .order("desc")
      .paginate(args.paginationOpts);
  },
});

export const verifiedPhoneAdd = mutation({
  args: {
    phoneNumber: v.string(),
    userId: v.optional(v.string()),
  },
  handler: async (ctx, { phoneNumber, userId }) => {
    await requireAdmin(ctx);
    const existing = await ctx.db
      .query("verifiedPhones")
      .withIndex("phoneNumber", (q) => q.eq("phoneNumber", phoneNumber))
      .first();
    if (existing) {
      if (userId !== undefined) {
        await ctx.db.patch(existing._id, { userId });
      }
      return existing._id;
    }
    return await ctx.db.insert("verifiedPhones", {
      phoneNumber,
      verifiedAt: Date.now(),
      userId,
    });
  },
});

export const verifiedPhoneRemove = mutation({
  args: { id: v.id("verifiedPhones") },
  handler: async (ctx, { id }) => {
    await requireAdmin(ctx);
    await ctx.db.delete(id);
    return null;
  },
});

export const verifiedPhonesCombine = mutation({
  args: {
    userId: v.string(),
    phoneIds: v.array(v.id("verifiedPhones")),
  },
  handler: async (ctx, { userId, phoneIds }) => {
    await requireAdmin(ctx);
    for (const id of phoneIds) {
      const doc = await ctx.db.get(id);
      if (doc) await ctx.db.patch(id, { userId });
    }
    return null;
  },
});
