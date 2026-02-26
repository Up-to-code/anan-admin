/**
 * Admin entities - partners, banks, bank products, properties, property-banks.
 */

import { mutation, query } from "../_generated/server";
import { v } from "convex/values";
import { requireAdmin } from "../lib/auth";

const partnerStatusValidator = v.union(
  v.literal("active"),
  v.literal("pending")
);

const bankProductValidator = v.object({
  name: v.string(),
  type: v.string(),
  description: v.optional(v.string()),
  rules: v.optional(v.any()),
});

const bankStatusValidator = v.union(
  v.literal("active"),
  v.literal("inactive"),
  v.literal("suspended")
);

const propertyStatusValidator = v.union(
  v.literal("available"),
  v.literal("sold"),
  v.literal("reserved")
);

// ---- Partners ----
export const partnersList = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    return ctx.db.query("partners").order("desc").collect();
  },
});

export const partnerGet = query({
  args: { id: v.id("partners") },
  handler: async (ctx, { id }) => {
    await requireAdmin(ctx);
    return await ctx.db.get(id);
  },
});

export const partnerCreate = mutation({
  args: {
    name: v.string(),
    slug: v.string(),
    status: v.optional(partnerStatusValidator),
    contactEmail: v.optional(v.string()),
    phone: v.optional(v.string()),
    logoId: v.optional(v.id("_storage")),
    description: v.optional(v.string()),
    website: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const existing = await ctx.db
      .query("partners")
      .withIndex("slug", (q) => q.eq("slug", args.slug))
      .first();
    if (existing) throw new Error("Partner with this slug already exists");
    const { contactEmail, phone, logoId, description, website, ...rest } =
      args;
    return ctx.db.insert("partners", {
      ...rest,
      status: args.status ?? "pending",
      contactEmail,
      phone,
      logoId,
      description,
      website,
    });
  },
});

export const partnerUpdate = mutation({
  args: {
    id: v.id("partners"),
    name: v.optional(v.string()),
    slug: v.optional(v.string()),
    status: v.optional(partnerStatusValidator),
    contactEmail: v.optional(v.string()),
    phone: v.optional(v.string()),
    logoId: v.optional(v.id("_storage")),
    description: v.optional(v.string()),
    website: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const { id, ...updates } = args;
    const doc = await ctx.db.get(id);
    if (!doc) throw new Error("Partner not found");
    const patch: Record<string, unknown> = {};
    if (updates.name !== undefined) patch.name = updates.name;
    if (updates.slug !== undefined) patch.slug = updates.slug;
    if (updates.status !== undefined) patch.status = updates.status;
    if (updates.contactEmail !== undefined)
      patch.contactEmail = updates.contactEmail;
    if (updates.phone !== undefined) patch.phone = updates.phone;
    if (updates.logoId !== undefined) patch.logoId = updates.logoId;
    if (updates.description !== undefined)
      patch.description = updates.description;
    if (updates.website !== undefined) patch.website = updates.website;
    if (Object.keys(patch).length > 0) await ctx.db.patch(id, patch);
    return null;
  },
});

export const partnerRemove = mutation({
  args: { id: v.id("partners") },
  handler: async (ctx, { id }) => {
    await requireAdmin(ctx);
    await ctx.db.delete(id);
    return null;
  },
});

// ---- Banks ----
export const banksList = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit = 100 }) => {
    await requireAdmin(ctx);
    return ctx.db.query("banks").order("desc").take(limit);
  },
});

export const bankGet = query({
  args: { id: v.id("banks") },
  handler: async (ctx, { id }) => {
    await requireAdmin(ctx);
    return await ctx.db.get(id);
  },
});

export const bankCreate = mutation({
  args: {
    name: v.string(),
    slug: v.string(),
    contactEmail: v.string(),
    rules: v.optional(v.any()),
    products: v.optional(v.array(bankProductValidator)),
    state: v.optional(v.string()),
    status: v.optional(bankStatusValidator),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const existing = await ctx.db
      .query("banks")
      .withIndex("slug", (q) => q.eq("slug", args.slug))
      .first();
    if (existing) throw new Error("Bank with this slug already exists");
    return ctx.db.insert("banks", {
      name: args.name,
      slug: args.slug,
      contactEmail: args.contactEmail,
      rules: args.rules,
      products: args.products ?? [],
      state: args.state,
      status: args.status,
      description: args.description,
    });
  },
});

export const bankUpdate = mutation({
  args: {
    id: v.id("banks"),
    name: v.optional(v.string()),
    slug: v.optional(v.string()),
    contactEmail: v.optional(v.string()),
    rules: v.optional(v.any()),
    products: v.optional(v.array(bankProductValidator)),
    state: v.optional(v.string()),
    status: v.optional(bankStatusValidator),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const { id, ...updates } = args;
    const doc = await ctx.db.get(id);
    if (!doc) throw new Error("Bank not found");
    const patch: Record<string, unknown> = {};
    if (updates.name !== undefined) patch.name = updates.name;
    if (updates.slug !== undefined) patch.slug = updates.slug;
    if (updates.contactEmail !== undefined)
      patch.contactEmail = updates.contactEmail;
    if (updates.rules !== undefined) patch.rules = updates.rules;
    if (updates.products !== undefined) patch.products = updates.products;
    if (updates.state !== undefined) patch.state = updates.state;
    if (updates.status !== undefined) patch.status = updates.status;
    if (updates.description !== undefined)
      patch.description = updates.description;
    if (Object.keys(patch).length > 0) await ctx.db.patch(id, patch);
    return null;
  },
});

export const bankRemove = mutation({
  args: { id: v.id("banks") },
  handler: async (ctx, { id }) => {
    await requireAdmin(ctx);
    await ctx.db.delete(id);
    return null;
  },
});

// ---- Bank Products ----
export const bankProductsList = query({
  args: { bankId: v.optional(v.id("banks")) },
  handler: async (ctx, { bankId }) => {
    await requireAdmin(ctx);
    if (bankId) {
      return ctx.db
        .query("bankProducts")
        .withIndex("bankId", (q) => q.eq("bankId", bankId))
        .collect();
    }
    return ctx.db.query("bankProducts").collect();
  },
});

export const bankProductGet = query({
  args: { id: v.id("bankProducts") },
  handler: async (ctx, { id }) => {
    await requireAdmin(ctx);
    return await ctx.db.get(id);
  },
});

export const bankProductCreate = mutation({
  args: {
    bankId: v.id("banks"),
    name: v.string(),
    type: v.string(),
    description: v.optional(v.string()),
    rules: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    return ctx.db.insert("bankProducts", args);
  },
});

export const bankProductUpdate = mutation({
  args: {
    id: v.id("bankProducts"),
    name: v.optional(v.string()),
    type: v.optional(v.string()),
    description: v.optional(v.string()),
    rules: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const { id, ...updates } = args;
    const doc = await ctx.db.get(id);
    if (!doc) throw new Error("Bank product not found");
    if (Object.keys(updates).length > 0) await ctx.db.patch(id, updates);
    return null;
  },
});

export const bankProductRemove = mutation({
  args: { id: v.id("bankProducts") },
  handler: async (ctx, { id }) => {
    await requireAdmin(ctx);
    await ctx.db.delete(id);
    return null;
  },
});

// ---- Properties ----
export const propertiesList = query({
  args: {
    limit: v.optional(v.number()),
    bankId: v.optional(v.id("banks")),
    partnerId: v.optional(v.id("partners")),
  },
  returns: v.any(),
  handler: async (ctx, args): Promise<unknown> => {
    await requireAdmin(ctx);
    const limit = args.limit ?? 50;
    if (args.bankId) {
      return ctx.db
        .query("properties")
        .withIndex("bankId", (q) => q.eq("bankId", args.bankId!))
        .order("desc")
        .take(limit);
    }
    if (args.partnerId) {
      return ctx.db
        .query("properties")
        .withIndex("partnerId", (q) => q.eq("partnerId", args.partnerId!))
        .order("desc")
        .take(limit);
    }
    return ctx.db.query("properties").order("desc").take(limit);
  },
});

export const propertyCreate = mutation({
  args: {
    title: v.string(),
    address: v.string(),
    price: v.number(),
    beds: v.number(),
    baths: v.number(),
    sqft: v.optional(v.number()),
    description: v.string(),
    body: v.optional(v.any()),
    bankId: v.optional(v.id("banks")),
    bankIds: v.optional(v.array(v.id("banks"))),
    partnerId: v.optional(v.id("partners")),
    imageId: v.optional(v.id("_storage")),
    location: v.optional(v.string()),
    area: v.optional(v.string()),
    status: v.optional(propertyStatusValidator),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const { bankIds, ...rest } = args;
    const bankId =
      rest.bankId ??
      (bankIds && bankIds.length > 0 ? bankIds[0] : undefined);
    const id = await ctx.db.insert("properties", { ...rest, bankId });
    if (bankIds && bankIds.length > 0) {
      const seen = new Set<string>();
      for (const bid of bankIds) {
        if (seen.has(bid)) continue;
        seen.add(bid);
        await ctx.db.insert("propertyBanks", { propertyId: id, bankId: bid });
      }
    }
    return id;
  },
});

export const propertyUpdate = mutation({
  args: {
    id: v.id("properties"),
    title: v.optional(v.string()),
    address: v.optional(v.string()),
    price: v.optional(v.number()),
    beds: v.optional(v.number()),
    baths: v.optional(v.number()),
    sqft: v.optional(v.number()),
    description: v.optional(v.string()),
    body: v.optional(v.any()),
    bankId: v.optional(v.id("banks")),
    bankIds: v.optional(v.array(v.id("banks"))),
    partnerId: v.optional(v.id("partners")),
    imageId: v.optional(v.id("_storage")),
    location: v.optional(v.string()),
    area: v.optional(v.string()),
    status: v.optional(propertyStatusValidator),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const { id, bankIds, ...updates } = args;
    const doc = await ctx.db.get(id);
    if (!doc) throw new Error("Property not found");
    const patch: Record<string, unknown> = { ...updates };
    if (bankIds !== undefined) {
      const existing = await ctx.db
        .query("propertyBanks")
        .withIndex("propertyId", (q) => q.eq("propertyId", id))
        .collect();
      for (const row of existing) await ctx.db.delete(row._id);
      const seen = new Set<string>();
      for (const bankId of bankIds) {
        if (seen.has(bankId)) continue;
        seen.add(bankId);
        await ctx.db.insert("propertyBanks", { propertyId: id, bankId });
      }
      patch.bankId = bankIds.length > 0 ? bankIds[0] : undefined;
    }
    if (Object.keys(patch).length > 0) await ctx.db.patch(id, patch);
    return null;
  },
});

export const propertyRemove = mutation({
  args: { id: v.id("properties") },
  handler: async (ctx, { id }) => {
    await requireAdmin(ctx);
    await ctx.db.delete(id);
    return null;
  },
});

export const propertyGet = query({
  args: { id: v.id("properties") },
  handler: async (ctx, { id }) => {
    await requireAdmin(ctx);
    return await ctx.db.get(id);
  },
});

export const propertyBanksListByProperty = query({
  args: { propertyId: v.id("properties") },
  handler: async (ctx, { propertyId }) => {
    await requireAdmin(ctx);
    return ctx.db
      .query("propertyBanks")
      .withIndex("propertyId", (q) => q.eq("propertyId", propertyId))
      .collect();
  },
});

export const propertyBanksSet = mutation({
  args: {
    propertyId: v.id("properties"),
    bankIds: v.array(v.id("banks")),
  },
  handler: async (ctx, { propertyId, bankIds }) => {
    await requireAdmin(ctx);
    const existing = await ctx.db
      .query("propertyBanks")
      .withIndex("propertyId", (q) => q.eq("propertyId", propertyId))
      .collect();
    for (const row of existing) {
      await ctx.db.delete(row._id);
    }
    const seen = new Set<string>();
    for (const bankId of bankIds) {
      if (seen.has(bankId)) continue;
      seen.add(bankId);
      await ctx.db.insert("propertyBanks", { propertyId, bankId });
    }
    return null;
  },
});
