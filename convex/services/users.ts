/**
 * User service - profiles, favorites.
 * Merged from features/users/profiles and features/users/favorites.
 */

import { mutation, query, internalQuery } from "../_generated/server";
import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import {
  requireAdmin,
  optionalAuth,
  getAuthUserId,
  getAuthUserIdOptional,
} from "../lib/auth";
import { userProfileReturnValidator } from "../domain/user";

/** List all user profiles. Admin only. */
export const list = query({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, { paginationOpts }) => {
    await requireAdmin(ctx);
    return ctx.db.query("userProfiles").order("desc").paginate(paginationOpts);
  },
});

/** Get profile by userId. */
export const getByUserId = query({
  args: { userId: v.string() },
  returns: v.union(userProfileReturnValidator, v.null()),
  handler: async (ctx, { userId }) => {
    const currentUserId = await optionalAuth(ctx);
    if (currentUserId && currentUserId !== userId) {
      await requireAdmin(ctx);
    }
    return ctx.db
      .query("userProfiles")
      .withIndex("userId", (q) => q.eq("userId", userId))
      .first();
  },
});

/** Internal: get profile by userId (no auth check). */
export const getByUserIdInternal = internalQuery({
  args: { userId: v.string() },
  returns: v.union(userProfileReturnValidator, v.null()),
  handler: async (ctx, { userId }) => {
    return ctx.db
      .query("userProfiles")
      .withIndex("userId", (q) => q.eq("userId", userId))
      .first();
  },
});

/** Ensure WhatsApp user exists. Creates or updates. */
export const ensureWhatsAppUser = mutation({
  args: {
    userId: v.string(),
    displayName: v.optional(v.string()),
  },
  returns: v.id("userProfiles"),
  handler: async (ctx, { userId, displayName }) => {
    const existing = await ctx.db
      .query("userProfiles")
      .withIndex("userId", (q) => q.eq("userId", userId))
      .first();
    if (existing) {
      if (displayName && existing.name !== displayName) {
        await ctx.db.patch(existing._id, {
          name: displayName,
          phone: existing.phone ?? userId,
          verified: true,
          source: "whatsapp",
        });
      } else if (!existing.verified) {
        await ctx.db.patch(existing._id, {
          phone: existing.phone ?? userId,
          verified: true,
          source: "whatsapp",
        });
      } else if (!existing.phone) {
        await ctx.db.patch(existing._id, { phone: userId, source: "whatsapp" });
      }
      return existing._id;
    }
    return await ctx.db.insert("userProfiles", {
      userId,
      name: displayName,
      phone: userId,
      verified: true,
      source: "whatsapp",
    });
  },
});

/** Upsert profile. Used by agent tool. */
export const upsert = mutation({
  args: {
    userId: v.string(),
    name: v.optional(v.string()),
    salary: v.optional(v.number()),
    employment: v.optional(v.string()),
    employer: v.optional(v.string()),
    firstTimeBuyer: v.optional(v.boolean()),
    kids: v.optional(v.number()),
    minBeds: v.optional(v.number()),
    maxBudget: v.optional(v.number()),
    preferredLocation: v.optional(v.string()),
    preferredFloor: v.optional(v.string()),
    needsParking: v.optional(v.boolean()),
    propertyType: v.optional(v.string()),
    finishes: v.optional(v.string()),
    notes: v.optional(v.string()),
    planType: v.optional(v.union(v.literal("free"), v.literal("paid"))),
    planExpiresAt: v.optional(v.number()),
    chatLimit: v.optional(v.number()),
  },
  returns: v.id("userProfiles"),
  handler: async (ctx, args) => {
    const { userId, ...updates } = args;
    const existing = await ctx.db
      .query("userProfiles")
      .withIndex("userId", (q) => q.eq("userId", userId))
      .first();
    const patchData = Object.fromEntries(
      Object.entries(updates).filter(([, v]) => v !== undefined),
    ) as Record<string, unknown>;
    if (existing) {
      if (Object.keys(patchData).length > 0) {
        await ctx.db.patch(existing._id, patchData);
      }
      return existing._id;
    }
    return await ctx.db.insert("userProfiles", { userId, ...patchData });
  },
});

/** Log user activity for analytics and usage limits. */
export const logActivity = mutation({
  args: {
    userId: v.string(),
    action: v.union(
      v.literal("message_sent"),
      v.literal("search"),
      v.literal("order_created"),
      v.literal("login"),
      v.literal("property_viewed"),
    ),
    channel: v.optional(
      v.union(v.literal("whatsapp"), v.literal("app"), v.literal("web")),
    ),
    metadata: v.optional(v.any()),
  },
  returns: v.id("userActivity"),
  handler: async (ctx, { userId, action, channel, metadata }) => {
    return ctx.db.insert("userActivity", {
      userId,
      action,
      channel,
      metadata,
    });
  },
});

/** Count sent messages for a user within a time window. */
export const getRecentMessageCount = query({
  args: {
    userId: v.string(),
    sinceMs: v.number(),
  },
  returns: v.number(),
  handler: async (ctx, { userId, sinceMs }) => {
    const activities = await ctx.db
      .query("userActivity")
      .withIndex("userId_and_action", (q) =>
        q.eq("userId", userId).eq("action", "message_sent"),
      )
      .collect();
    return activities.filter((item) => item._creationTime >= sinceMs).length;
  },
});

/** Add property to favorites. */
export const addFavorite = mutation({
  args: { propertyId: v.id("properties") },
  returns: v.id("favorites"),
  handler: async (ctx, { propertyId }) => {
    const userId = await getAuthUserId(ctx);
    const property = await ctx.db.get(propertyId);
    if (!property) throw new Error("Property not found");
    const existing = await ctx.db
      .query("favorites")
      .withIndex("userId_and_propertyId", (q) =>
        q.eq("userId", userId).eq("propertyId", propertyId),
      )
      .first();
    if (existing) return existing._id;
    return await ctx.db.insert("favorites", { userId, propertyId });
  },
});

/** Remove property from favorites. */
export const removeFavorite = mutation({
  args: { propertyId: v.id("properties") },
  returns: v.null(),
  handler: async (ctx, { propertyId }) => {
    const userId = await getAuthUserId(ctx);
    const doc = await ctx.db
      .query("favorites")
      .withIndex("userId_and_propertyId", (q) =>
        q.eq("userId", userId).eq("propertyId", propertyId),
      )
      .first();
    if (doc) await ctx.db.delete(doc._id);
    return null;
  },
});

/** List favorited property IDs for current user. */
export const listFavorites = query({
  args: {},
  returns: v.array(v.id("properties")),
  handler: async (ctx) => {
    const userId = await getAuthUserIdOptional(ctx);
    if (!userId) return [];
    const docs = await ctx.db
      .query("favorites")
      .withIndex("userId", (q) => q.eq("userId", userId))
      .collect();
    return docs.map((d) => d.propertyId);
  },
});
