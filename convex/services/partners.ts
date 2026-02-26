/**
 * Partner service - list, addProperty, listPropertiesByPartner, getPartnerByApiKeyHash.
 */

import { mutation, query, internalQuery } from "../_generated/server";
import { v } from "convex/values";

/** Internal: find partner by API key hash. Used by HTTP action. */
export const getPartnerByApiKeyHash = internalQuery({
  args: { apiKeyHash: v.string() },
  returns: v.union(v.id("partners"), v.null()),
  handler: async (ctx, { apiKeyHash }) => {
    const partners = await ctx.db.query("partners").collect();
    const partner = partners.find(
      (p) =>
        p.apiKeyHash === apiKeyHash && (p.status === "active" || !p.status)
    );
    return partner?._id ?? null;
  },
});

/** Add a property for a partner. Used via Partner API. */
export const addProperty = mutation({
  args: {
    partnerId: v.id("partners"),
    title: v.string(),
    address: v.string(),
    price: v.number(),
    beds: v.number(),
    baths: v.number(),
    sqft: v.optional(v.number()),
    description: v.string(),
    body: v.optional(v.any()),
  },
  returns: v.id("properties"),
  handler: async (ctx, args) => {
    const partner = await ctx.db.get(args.partnerId);
    if (!partner) throw new Error("Partner not found");
    if (partner.status === "pending") {
      throw new Error("Partner is pending approval. Properties cannot be added yet.");
    }
    return ctx.db.insert("properties", {
      ...args,
      partnerId: args.partnerId,
    });
  },
});

/** List all partners. */
export const list = query({
  args: {},
  returns: v.array(v.any()), // Assuming standard table shape here without creating a deep validator
  handler: async (ctx) => {
    return ctx.db.query("partners").collect();
  },
});

/** List properties by partner. */
export const listPropertiesByPartner = query({
  args: {
    partnerId: v.id("partners"),
    limit: v.optional(v.number()),
  },
  returns: v.array(v.any()),
  handler: async (ctx, { partnerId, limit = 50 }) => {
    return ctx.db
      .query("properties")
      .withIndex("partnerId", (q) => q.eq("partnerId", partnerId))
      .order("desc")
      .take(limit);
  },
});
