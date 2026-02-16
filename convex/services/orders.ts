/**
 * Order service - list, create, update, remove.
 */

import { mutation, query } from "../_generated/server";
import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { requireAdmin } from "../lib/auth";

const orderStatusValidator = v.union(
  v.literal("new_lead"),
  v.literal("contacted"),
  v.literal("qualified"),
  v.literal("offer_made"),
  v.literal("under_contract"),
  v.literal("closed_won"),
  v.literal("closed_lost")
);

const orderTypeValidator = v.union(v.literal("property"), v.literal("loan"));

export const list = query({
  args: {
    paginationOpts: paginationOptsValidator,
    status: v.optional(orderStatusValidator),
    type: v.optional(orderTypeValidator),
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
    } else {
      q = ctx.db.query("orders").order("desc");
    }
    return q.paginate(args.paginationOpts);
  },
});

export const getByUser = query({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) => {
    await requireAdmin(ctx);
    return ctx.db
      .query("orders")
      .withIndex("userId", (q) => q.eq("userId", userId))
      .collect();
  },
});

export const getByProperty = query({
  args: { propertyId: v.id("properties") },
  handler: async (ctx, { propertyId }) => {
    await requireAdmin(ctx);
    return ctx.db
      .query("orders")
      .withIndex("propertyId", (q) => q.eq("propertyId", propertyId))
      .collect();
  },
});

export const getByBank = query({
  args: { bankId: v.id("banks") },
  handler: async (ctx, { bankId }) => {
    await requireAdmin(ctx);
    return ctx.db
      .query("orders")
      .withIndex("bankId", (q) => q.eq("bankId", bankId))
      .collect();
  },
});

export const getById = query({
  args: { id: v.id("orders") },
  handler: async (ctx, { id }) => {
    await requireAdmin(ctx);
    return ctx.db.get(id);
  },
});

export const create = mutation({
  args: {
    userId: v.string(),
    type: orderTypeValidator,
    status: v.optional(orderStatusValidator),
    propertyId: v.optional(v.id("properties")),
    bankId: v.optional(v.id("banks")),
    partnerId: v.optional(v.id("partners")),
    intent: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    return ctx.db.insert("orders", {
      userId: args.userId,
      type: args.type,
      status: args.status ?? "new_lead",
      propertyId: args.propertyId,
      bankId: args.bankId,
      partnerId: args.partnerId,
      intent: args.intent,
      notes: args.notes,
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("orders"),
    status: v.optional(orderStatusValidator),
    notes: v.optional(v.string()),
    intent: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const { id, ...updates } = args;
    const patch = Object.fromEntries(
      Object.entries(updates).filter(([, v]) => v !== undefined)
    );
    if (Object.keys(patch).length > 0) {
      await ctx.db.patch(id, patch);
    }
    return null;
  },
});

export const remove = mutation({
  args: { id: v.id("orders") },
  handler: async (ctx, { id }) => {
    await requireAdmin(ctx);
    await ctx.db.delete(id);
    return null;
  },
});
