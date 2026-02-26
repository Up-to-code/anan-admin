/**
 * Admin WhatsApp - inbound messages list and queries.
 */

import { query } from "../_generated/server";
import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { requireAdmin } from "../lib/auth";

export const listWhatsAppInboundMessages = query({
  args: {
    paginationOpts: paginationOptsValidator,
    userId: v.optional(v.string()),
  },
  handler: async (ctx, { paginationOpts, userId }) => {
    await requireAdmin(ctx);
    const q = userId
      ? ctx.db
          .query("whatsappInboundMessages")
          .withIndex("userId_createdAt", (index) => index.eq("userId", userId))
          .order("desc")
      : ctx.db
          .query("whatsappInboundMessages")
          .withIndex("createdAt")
          .order("desc");
    return await q.paginate(paginationOpts);
  },
});
