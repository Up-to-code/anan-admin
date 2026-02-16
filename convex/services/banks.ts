/**
 * Bank service - list, getById, getBySlug, getBundles.
 */

import { query } from "../_generated/server";
import { v } from "convex/values";
import { bankValidator, bankBundleValidator } from "../domain/validators";

export const list = query({
  args: { limit: v.optional(v.number()) },
  returns: v.array(bankValidator),
  handler: async (ctx, { limit = 50 }) => {
    return ctx.db.query("banks").order("desc").take(limit);
  },
});

export const getById = query({
  args: { id: v.id("banks") },
  returns: v.union(bankValidator, v.null()),
  handler: async (ctx, { id }) => ctx.db.get(id),
});

export const getBySlug = query({
  args: { slug: v.string() },
  returns: v.union(bankValidator, v.null()),
  handler: async (ctx, { slug }) => {
    return ctx.db
      .query("banks")
      .withIndex("slug", (q) => q.eq("slug", slug))
      .first();
  },
});

export const getBundles = query({
  args: { bankId: v.optional(v.id("banks")) },
  returns: v.array(bankBundleValidator),
  handler: async (ctx, { bankId }) => {
    const banks = bankId
      ? [await ctx.db.get(bankId)].filter(Boolean)
      : await ctx.db.query("banks").take(50);
    return (banks as NonNullable<typeof banks[0]>[]).flatMap((b) =>
      (b?.products ?? []).map((p) => ({
        bankName: b.name,
        bankSlug: b.slug,
        bankId: b._id,
        ...p,
      }))
    );
  },
});
